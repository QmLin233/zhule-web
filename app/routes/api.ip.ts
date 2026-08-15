import type { Route } from "./+types/api.ip";
import type { IpInfo } from "~/lib/ip";

// ============================================================
// IP 查询后端（/api/ip）
//
// 当前只启用「方案 1」：Cloudflare 边缘数据（request.cf + CF-IPCountry 头），
// 仅能解析「访问者自己」的 IP，零成本、零第三方依赖。
//
// 扩展点：
//   1. ARBITRARY_IP_SOURCE —— 切换「任意 IP 查询」的数据源
//   2. lookupArbitraryIp() —— 实现对应数据源（方案 2 / 方案 3）
// 前端页面与数据契约见 app/lib/ip.ts，接入新方案时无需改动。
// ============================================================

/** 任意 IP 查询当前的数据源（扩展点 1：切换方案 2 / 3 的开关） */
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

/**
 * 方案 1：用 Cloudflare 边缘数据构建「我的 IP」信息。
 * request.cf 与 CF-IPCountry 头均由 Cloudflare 边缘填充，零成本。
 */
function fromCloudflareEdge(
	ip: string,
	cf: CfGeo | undefined,
	countryHeader: string | null,
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
		colo: cf?.colo,
		source: "cf",
	};
}

/**
 * 扩展点 2：「任意 IP 查询」的数据源实现。
 * 方案 2（第三方 API + 缓存）与方案 3（GeoLite2 + D1）在此实现。
 * 返回 null 表示当前数据源不支持该查询。
 */
async function lookupArbitraryIp(_ip: string): Promise<IpInfo | null> {
	switch (ARBITRARY_IP_SOURCE) {
		case "ip-api":
			// TODO(方案2): 代理 ip-api.com / ipinfo.io，用 Cache API 缓存结果
			return null;
		case "d1-geolite2":
			// TODO(方案3): 查询已导入 GeoLite2 数据的 D1 表
			return null;
		case "none":
		default:
			return null;
	}
}

export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url);
	const query = url.searchParams.get("ip")?.trim();
	const cf = (request as unknown as { cf?: CfGeo }).cf;

	// 我的 IP：方案 1，CF 边缘数据
	if (!query) {
		const ip = getClientIp(request);
		return Response.json(
			fromCloudflareEdge(ip, cf, request.headers.get("CF-IPCountry")),
		);
	}

	// 查询任意 IP：由当前数据源决定（默认方案 1 不支持，返回 501 提示）
	const info = await lookupArbitraryIp(query);
	if (info) {
		return Response.json(info);
	}
	return Response.json(
		{ error: "任意 IP 查询功能尚未启用，请稍后再试" },
		{ status: 501 },
	);
}

