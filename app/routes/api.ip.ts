import type { Route } from "./+types/api.ip";
import type { IpInfo } from "~/lib/ip";

// ============================================================
// IP 查询后端（/api/ip）
//
// 数据源（优先级从高到低）：
//  本机 IP：
//   1. ipchaxun.com.cn（需 API Key，国家/ASN/IP 类型较准）
//   2. ip-api.com 补充缺失字段（城市/省份/时区/经纬度等）
//   3. 回退 Cloudflare 边缘数据（request.cf + CF-IPCountry 头）
//  任意 IP 查询：由 ARBITRARY_IP_SOURCE 控制（当前 none，功能已取消）
//
// 扩展点：
//   1. lookupByIpchaxun() —— ipchaxun.com.cn 查询实现
//   2. lookupByIpApi() —— ip-api.com 查询实现（补充/兜底共用）
//   3. enrichWithIpApi() —— 用 ip-api 补充 ipchaxun 缺失字段
//   4. lookupArbitraryIp() —— 任意 IP 查询入口（方案 3 d1-geolite2 待接入）
// 前端页面与数据契约见 app/lib/ip.ts，接入新方案时无需改动。
// ============================================================

/** 任意 IP 查询当前的数据源（扩展点 1：切换方案 2 / 3 的开关；当前取消该功能，置为 none） */
const ARBITRARY_IP_SOURCE: "none" | "ip-api" | "d1-geolite2" = "none";

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

/** 写入 IP 查询缓存（24h） */
async function writeIpCache(key: string, info: IpInfo): Promise<void> {
	const cache = (caches as unknown as { default: Cache }).default;
	const response = new Response(JSON.stringify(info), {
		headers: {
			"content-type": "application/json",
			"cache-control": "public, max-age=86400, s-maxage=86400",
		},
	});
	await cache.put(key, response);
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

	const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${IP_API_FIELDS}`;
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
 * 返回主要字段：country（中文名+代码）、as（number/name）、type、proxy_score 等。
 * 不返回城市/时区/经纬度等字段，缺失部分由 lookupByIpApi 补充。
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
			signal: AbortSignal.timeout(5000),
		},
	);

	if (res.status === 401 || res.status === 403) {
		throw new Error("API Key 无效 · Invalid API key");
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
		country: country.name,
		countryCode: country.code,
		asn: typeof as.number === "number" ? `AS${as.number}` : undefined,
		isp: as.name,
		// proxy_score 越高越可能是代理/数据中心
		proxy: typeof data.proxy_score === "number" && data.proxy_score >= 80,
		source: "ipchaxun",
	};

	// 写入缓存（24h），减少第三方调用
	await writeIpCache(cacheKey, info);
	return info;
}

/**
 * 用 ip-api.com 补充 ipchaxun 缺失的字段（城市/省份/时区/经纬度/组织等）。
 * region/city 优先用 ip-api（英文名），与前端 REGION_CN/CITY_CN 映射兼容。
 */
async function enrichWithIpApi(base: IpInfo, ip: string): Promise<IpInfo> {
	const extra = await lookupByIpApi(ip);
	return {
		...base,
		// 国家用 ip-api 英文名（英文行显示），countryCode 供中文映射
		country: extra.country ?? base.country,
		countryCode: extra.countryCode ?? base.countryCode,
		region: extra.region ?? base.region,
		regionCode: extra.regionCode ?? base.regionCode,
		city: extra.city ?? base.city,
		latitude: extra.latitude ?? base.latitude,
		longitude: extra.longitude ?? base.longitude,
		timezone: extra.timezone ?? base.timezone,
		isp: base.isp ?? extra.isp,
		org: extra.org ?? base.org,
		mobile: extra.mobile ?? base.mobile,
		hosting: extra.hosting ?? base.hosting,
	};
}

/**
 * 扩展点 2：「任意 IP 查询」的数据源实现。
 * 方案 2（ip-api.com）已实现；方案 3（d1-geolite2）待接入。
 * 返回 null 表示当前数据源不支持该查询。
 */
async function lookupArbitraryIp(ip: string): Promise<IpInfo | null> {
	switch (ARBITRARY_IP_SOURCE) {
		case "ip-api":
			return lookupByIpApi(ip);
		case "d1-geolite2":
			// TODO(方案3): 查询已导入 GeoLite2 数据的 D1 表
			return null;
		case "none":
		default:
			return null;
	}
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const url = new URL(request.url);
	const query = url.searchParams.get("ip")?.trim();
	// 原始 request.cf 在入口 fetch 已捕获并注入 context（见 workers/app.ts）
	const cf = context.cf as CfGeo | undefined;

	// 我的 IP：优先 ipchaxun.com.cn（需 API Key），ip-api 补充缺失字段，
	// 都失败时回退 Cloudflare 边缘数据
	if (!query) {
		const ip = getClientIp(request);
		const apiKey = (
			context.cloudflare.env as unknown as { IPCHAXUN_API_KEY?: string }
		).IPCHAXUN_API_KEY;

		// 1) ipchaxun.com.cn 主查询（有 Key 时）
		if (apiKey) {
			try {
				const info = await lookupByIpchaxun(ip, apiKey);
				// 2) ip-api 补充缺失字段
				try {
					return Response.json(await enrichWithIpApi(info, ip));
				} catch {
					return Response.json(info);
				}
			} catch {
				// Key 无效/超限/网络异常 → 回退到 ip-api
			}
		}

		// 3) ip-api 兜底，再失败回退 Cloudflare 边缘数据
		try {
			return Response.json(await lookupByIpApi(ip));
		} catch {
			return Response.json(
				fromCloudflareEdge(
					ip,
					cf,
					request.headers.get("CF-IPCountry"),
					request.headers.get("CF-Ray"),
				),
			);
		}
	}

	// 查询任意 IP（支持 IPv4 / IPv6）：由当前数据源决定
	try {
		const info = await lookupArbitraryIp(query);
		if (info) {
			return Response.json(info);
		}
	} catch (e) {
		const msg = e instanceof Error ? e.message : "查询失败 · Lookup failed";
		return Response.json({ error: msg }, { status: 400 });
	}
	return Response.json(
		{ error: "任意 IP 查询功能尚未启用，请稍后再试 · Arbitrary IP lookup coming soon" },
		{ status: 501 },
	);
}


