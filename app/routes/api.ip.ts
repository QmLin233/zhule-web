import type { Route } from "./+types/api.ip";
import type { IpInfo } from "~/lib/ip";

// ============================================================
// IP 查询后端（/api/ip）
//
// 数据源（本机 IP，优先级从高到低）：
//   1. ipchaxun.com.cn（需 API Key）—— 优先，重试 3 次；
//      成功时只用它一家（不混合调用其他服务）
//   2. ip-api.com —— ipchaxun 彻底不可用时的整体回退
//   3. Cloudflare 边缘数据（request.cf）—— 最后兜底
//
// 说明：Location 直接使用 ipchaxun 返回的国家名（中文，不翻译），
// 前端中文行用 countryCode 映射 + region/city 拼接，不做英文行。
// ============================================================

/** Cloudflare 请求自带的边缘地理信息（request.cf） */
type CfGeo = {
	asn?: number;
	asOrganization?: string;
	colo?: string;
	country?: string;
	region?: string;
	regionCode?: string;
	city?: string;
	timezone?: string;
	latitude?: string;
	longitude?: string;
	continent?: string;
};

/** 提取访问者的真实 IP：CF 直连头优先，本地开发时回退到代理头 */
function getClientIp(request: Request): string {
	return (
		request.headers.get("CF-Connecting-IP") ||
		request.headers.get("x-real-ip") ||
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
		""
	);
}

/** 从 CF-Ray 头提取边缘节点代码（免费套餐也可用），形如 "7f2a...-HKG" → "HKG" */
function coloFromRay(ray: string | null): string | undefined {
	if (!ray) return undefined;
	const i = ray.lastIndexOf("-");
	return i >= 0 ? ray.slice(i + 1) : undefined;
}

/** IPv4 校验：四段十进制，每段 0-255 */
function isIpv4(ip: string): boolean {
	const parts = ip.split(".");
	if (parts.length !== 4) return false;
	return parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

// 标准 IPv6 地址校验（完整/压缩形式，含 ::）
const IPV6_RE =
	/^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;

/** IPv6 校验：完整/压缩形式（含 ::），同时接受 IPv4 映射段（如 ::ffff:1.2.3.4） */
function isIpv6(ip: string): boolean {
	if (!ip.includes(":")) return false;
	// 去掉末尾 IPv4 映射段后按纯 IPv6 校验
	const v4 = ip.match(/(\d{1,3}\.){3}\d{1,3}$/);
	const pure = v4 ? ip.slice(0, v4.index) : ip;
	return IPV6_RE.test(pure);
}

/** 同时接受 IPv4 与 IPv6 */
function isValidIp(ip: string): boolean {
	return isIpv4(ip) || isIpv6(ip);
}

/**
 * 方案 1：用 Cloudflare 边缘数据构建「我的 IP」信息。
 * cf 来自入口 fetch 捕获的原始 request.cf（见 workers/app.ts 的 context.cf），
 * country 兜底用 CF-IPCountry 头，colo 兜底用 CF-Ray 头。
 */
function fromCloudflareEdge(
	ip: string,
	cf: CfGeo | undefined,
	countryHeader: string | null,
	ray: string | null,
): IpInfo {
	return {
		ip,
		query: ip,
		countryCode: cf?.country ?? countryHeader ?? undefined,
		region: cf?.region,
		regionCode: cf?.regionCode,
		city: cf?.city,
		latitude: cf?.latitude != null ? Number(cf.latitude) : undefined,
		longitude: cf?.longitude != null ? Number(cf.longitude) : undefined,
		timezone: cf?.timezone,
		isp: cf?.asOrganization,
		asn: cf?.asn ? `AS${cf.asn}` : undefined,
		colo: cf?.colo ?? coloFromRay(ray),
		source: "cf",
	};
}

/** ip-api.com 单条查询的字段列表（免费套餐，支持 IPv4 / IPv6） */
const IP_API_FIELDS =
	"status,message,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org,as,query,mobile,proxy,hosting";

/** 读取 IP 查询缓存（Cloudflare Cache API，24h），未命中返回 null */
async function readIpCache(key: string): Promise<IpInfo | null> {
	const cache = (caches as unknown as { default: Cache }).default;
	const cached = await cache.match(key);
	if (cached) {
		return (await cached.json()) as IpInfo;
	}
	return null;
}

/** 写入 IP 查询缓存（24h），失败时静默忽略 */
async function writeIpCache(key: string, info: IpInfo): Promise<void> {
	try {
		const cache = (caches as unknown as { default: Cache }).default;
		const response = new Response(JSON.stringify(info), {
			headers: {
				"content-type": "application/json",
				"cache-control": "public, max-age=86400, s-maxage=86400",
			},
		});
		await cache.put(key, response);
	} catch {
		// 缓存写入失败不应影响正常响应
	}
}

/** 读取出口 IP 缓存（按机房+协议，1h），未命中返回 null */
async function readEgressCache(key: string): Promise<string | null> {
	const cache = (caches as unknown as { default: Cache }).default;
	const cached = await cache.match(`https://egress-ip/${key}`);
	if (cached) return (await cached.text()) || null;
	return null;
}

/** 写入出口 IP 缓存（1h），失败时静默忽略 */
async function writeEgressCache(key: string, ip: string): Promise<void> {
	try {
		const cache = (caches as unknown as { default: Cache }).default;
		const response = new Response(ip, {
			headers: { "cache-control": "public, max-age=3600, s-maxage=3600" },
		});
		await cache.put(`https://egress-ip/${key}`, response);
	} catch {
		// 缓存写入失败不应影响正常响应
	}
}

/** 请求指定协议的回显服务拿出口 IP，并校验协议族（ver=4 必须 IPv4，ver=6 必须 IPv6） */
async function lookupEgressByEcho(
	colo: string,
	ver: "4" | "6",
	url: string,
): Promise<string | undefined> {
	const cacheKey = `${colo}-${ver}`;
	const cached = await readEgressCache(cacheKey);
	if (cached) return cached;

	try {
		const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
		if (!res.ok) return undefined;
		const ip = (await res.text()).trim();
		// 校验地址族：api4 若返回 IPv6（如 Worker 走 IPv6 出口）则丢弃，避免把 IPv6 当 IPv4 显示
		const valid = ver === "4" ? isIpv4(ip) : isIpv6(ip);
		if (!valid) return undefined;
		await writeEgressCache(cacheKey, ip);
		return ip;
	} catch {
		return undefined;
	}
}

/** 用 CF 自家回显 cdn-cgi/trace 获取出口 IPv4（作为 api4 返回 IPv6 时的兜底） */
async function lookupEgressV4FromTrace(colo: string): Promise<string | undefined> {
	const cacheKey = `${colo}-4`;
	const cached = await readEgressCache(cacheKey);
	if (cached) return cached;

	try {
		const res = await fetch("https://www.cloudflare.com/cdn-cgi/trace", {
			signal: AbortSignal.timeout(3000),
		});
		if (!res.ok) return undefined;
		const text = await res.text();
		const ip = text
			.split("\n")
			.find((line) => line.startsWith("ip="))
			?.slice(3)
			.trim();
		if (ip && isIpv4(ip)) {
			await writeEgressCache(cacheKey, ip);
			return ip;
		}
		return undefined;
	} catch {
		return undefined;
	}
}

/**
 * 获取 Cloudflare Worker 的出口 IP（边缘节点出口地址），只取一个：IPv4 优先，无则 IPv6。
 * api4 / api6 分别强制 IPv4 / IPv6 回显并校验协议族（api4 返回非 IPv4 时回退 cdn-cgi/trace），
 * 按机房缓存 1h，调用量可忽略。
 */
async function lookupEgressIp(colo: string | undefined): Promise<string | undefined> {
	if (!colo) return undefined;
	const [v4, v6] = await Promise.all([
		lookupEgressByEcho(colo, "4", "https://api4.ipify.org").then(
			(ip) => ip ?? lookupEgressV4FromTrace(colo),
		),
		lookupEgressByEcho(colo, "6", "https://api6.ipify.org"),
	]);
	return v4 ?? v6;
}

/**
 * 用 ip-api.com 查询 IP（支持 IPv4 / IPv6）。
 * 命中缓存直接返回，未命中请求第三方，写入 24h 缓存降低调用量。
 * 失败（无效 IP / 网络错误 / 查询失败）时抛出错误，由调用方决定回退。
 */
async function lookupByIpApi(ip: string): Promise<IpInfo> {
	if (!isValidIp(ip)) {
		throw new Error("无效的 IP 地址 · Invalid IP address");
	}

	// 命中缓存直接返回（24h）
	const cacheKey = `https://ip-api.com/${ip}`;
	const cached = await readIpCache(cacheKey);
	if (cached) {
		return cached;
	}

	const url = `https://ip-api.com/json/${encodeURIComponent(ip)}?fields=${IP_API_FIELDS}`;
	const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
	const data = (await res.json()) as Record<string, unknown>;

	if (data.status !== "success") {
		throw new Error((data.message as string) || "查询失败 · Lookup failed");
	}

	const info: IpInfo = {
		ip: (data.query as string) ?? ip,
		query: ip,
		country: data.country as string | undefined,
		countryCode: data.countryCode as string | undefined,
		region: (data.regionName as string) ?? (data.region as string),
		regionCode: data.region as string | undefined,
		city: data.city as string | undefined,
		latitude: typeof data.lat === "number" ? data.lat : undefined,
		longitude: typeof data.lon === "number" ? data.lon : undefined,
		timezone: data.timezone as string | undefined,
		isp: data.isp as string | undefined,
		org: data.org as string | undefined,
		asn: typeof data.as === "string" ? data.as : undefined,
		mobile: data.mobile as boolean | undefined,
		proxy: data.proxy as boolean | undefined,
		hosting: data.hosting as boolean | undefined,
		source: "ip-api",
	};

	// 写入缓存（24h），减少第三方调用
	await writeIpCache(cacheKey, info);
	return info;
}

/**
 * 用 ipchaxun.com.cn 查询 IP（需 X-API-Key 认证，支持 IPv4 / IPv6）。
 *
 * 接口：GET https://api.ipchaxun.com.cn/api/v1/query?ip=<ip>
 * 防御性读取所有可能字段（country/city/region/isp/org/as/timezone/lat/lon）。
 * 国家名统一转成英文存入 country（英文行用），中文行由前端用 countryCode 映射。
 */
async function lookupByIpchaxun(ip: string, apiKey: string): Promise<IpInfo> {
	if (!isValidIp(ip)) {
		throw new Error("无效的 IP 地址 · Invalid IP address");
	}

	// 命中缓存直接返回（24h）
	const cacheKey = `https://ipchaxun.com/${ip}`;
	const cached = await readIpCache(cacheKey);
	if (cached) {
		return cached;
	}

	const res = await fetch(
		`https://api.ipchaxun.com.cn/api/v1/query?ip=${encodeURIComponent(ip)}`,
		{
			headers: { "X-API-Key": apiKey },
			signal: AbortSignal.timeout(3000),
		},
	);

	if (res.status === 401 || res.status === 403) {
		// 不向客户端暴露「存在 API Key」等内部信息
		throw new Error("查询失败 · Lookup failed");
	}
	if (res.status === 429) {
		throw new Error("请求过于频繁 · Rate limited");
	}
	if (!res.ok) {
		throw new Error("查询失败 · Lookup failed");
	}

	const data = (await res.json()) as Record<string, unknown>;
	const country = (data.country ?? {}) as { code?: string; name?: string };
	const as = (data.as ?? {}) as { number?: number; name?: string };

	const info: IpInfo = {
		ip: (data.ip as string) ?? ip,
		query: ip,
		// 直接使用 ipchaxun 返回的国家名（中文，不翻译）
		country: country.name,
		countryCode: country.code,
		// 尽力读取 ipchaxun 可能返回的省市/时区/经纬度/运营商等字段
		region: data.region as string | undefined,
		regionCode: data.regionCode as string | undefined,
		city: data.city as string | undefined,
		latitude: typeof data.lat === "number" ? data.lat : undefined,
		longitude: typeof data.lon === "number" ? data.lon : undefined,
		timezone: data.timezone as string | undefined,
		isp: (data.isp as string) ?? as.name,
		org: data.org as string | undefined,
		asn: typeof as.number === "number" ? `AS${as.number}` : undefined,
		// proxy_score 越高越可能是代理/数据中心
		proxy: typeof data.proxy_score === "number" && data.proxy_score >= 80,
		source: "ipchaxun",
	};

	// 写入缓存（24h），减少第三方调用
	await writeIpCache(cacheKey, info);
	return info;
}

export async function loader({ request, context }: Route.LoaderArgs) {
	// 原始 request.cf 在入口 fetch 已捕获并注入 context（见 workers/app.ts）
	const cf = context.cf as CfGeo | undefined;
	const ip = getClientIp(request);
	const apiKey = context.cloudflare.env.IPCHAXUN_API_KEY;

	// 出口 IP（边缘节点出口地址，IPv4 优先、无则 IPv6，按机房缓存 1h，失败则省略）
	const colo = cf?.colo ?? coloFromRay(request.headers.get("CF-Ray"));
	const egressIp = await lookupEgressIp(colo);

	// 1) ipchaxun.com.cn 主数据源（有 Key 时）：重试 3 次，
	//    成功就只用它一家，不再调用其他服务（不混合）
	if (apiKey) {
		for (let attempt = 0; attempt < 3; attempt++) {
			try {
				const info = await lookupByIpchaxun(ip, apiKey);
				return Response.json({ ...info, egressIp });
			} catch {
				// 指数退避：第1次 100ms，第2次 300ms
				if (attempt < 2) {
					await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
				}
			}
		}
	}

	// 2) ipchaxun 不可用 → ip-api 兜底
	try {
		const info = await lookupByIpApi(ip);
		return Response.json({ ...info, egressIp });
	} catch {
		const info = fromCloudflareEdge(
			ip,
			cf,
			request.headers.get("CF-IPCountry"),
			request.headers.get("CF-Ray"),
		);
		return Response.json({ ...info, egressIp });
	}
}


