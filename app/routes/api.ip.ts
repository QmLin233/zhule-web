import type { Route } from "./+types/api.ip";
import type { IpInfo } from "~/lib/ip";

// ============================================================
// IP 查询后端（/api/ip）
//
// 数据源：
//  - 「我的 IP」：方案 1，Cloudflare 边缘数据（request.cf + CF-IPCountry 头）
//  - 「任意 IP 查询」：方案 2，代理 ip-api.com（同时支持 IPv4 / IPv6），
//    用 Cache API 缓存 24h 降低第三方调用量
//
// 扩展点：
//   1. ARBITRARY_IP_SOURCE —— 切换「任意 IP 查询」的数据源（none / ip-api / d1-geolite2）
//   2. lookupArbitraryIp() —— 实现对应数据源（方案 2 已实现，方案 3 待接入）
// 前端页面与数据契约见 app/lib/ip.ts，接入新方案时无需改动。
// ============================================================

/** 任意 IP 查询当前的数据源（扩展点 1：切换方案 2 / 3 的开关） */
const ARBITRARY_IP_SOURCE: "none" | "ip-api" | "d1-geolite2" = "ip-api";

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

/**
 * 扩展点 2：「任意 IP 查询」的数据源实现。
 * 方案 2（ip-api.com）已实现：先查 Cache，未命中再请求第三方，缓存 24h。
 * 返回 null 表示当前数据源不支持该查询。
 */
async function lookupArbitraryIp(ip: string): Promise<IpInfo | null> {
	switch (ARBITRARY_IP_SOURCE) {
		case "ip-api": {
			if (!isValidIp(ip)) {
				throw new Error("无效的 IP 地址 · Invalid IP address");
			}

			// 命中缓存直接返回（Cloudflare Cache API，24h）
			const cacheKey = `https://ip-api.com/${ip}`;
			const cache = (caches as unknown as { default: Cache }).default;
			const cached = await cache.match(cacheKey);
			if (cached) {
				return (await cached.json()) as IpInfo;
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
			const cacheResponse = new Response(JSON.stringify(info), {
				headers: {
					"content-type": "application/json",
					"cache-control": "public, max-age=86400, s-maxage=86400",
				},
			});
			await cache.put(cacheKey, cacheResponse);
			return info;
		}
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

	// 我的 IP：方案 1，CF 边缘数据
	if (!query) {
		const ip = getClientIp(request);
		return Response.json(
			fromCloudflareEdge(
				ip,
				cf,
				request.headers.get("CF-IPCountry"),
				request.headers.get("CF-Ray"),
			),
		);
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


