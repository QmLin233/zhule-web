import type { Route } from "./+types/api.video";
import { getClientIp } from "../lib/http";
import { createRateLimiter } from "../lib/rate-limit";
import { resolveBilibili, VideoError } from "../lib/video";

// 解析请求会触发多次 B 站接口调用，按 IP 限流
const parseLimiter = createRateLimiter(30, 60_000);

export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url);
	const input = url.searchParams.get("url") ?? "";
	const page = Number(url.searchParams.get("p")) || undefined;
	// 登录 Cookie 由浏览器逐次携带，服务端不保存
	const cookie = request.headers.get("x-bili-cookie")?.trim() || undefined;

	const clientIp = getClientIp(request);
	if (parseLimiter.isLimited(clientIp)) {
		return Response.json(
			{ success: false, code: "rateLimited", error: "请求过于频繁" },
			{ status: 429 },
		);
	}
	parseLimiter.record(clientIp);

	try {
		const data = await resolveBilibili(input, page, cookie);
		return Response.json(
			{ success: true, data },
			{
				headers: {
					// 带登录态的结果不能进公共缓存
					"Cache-Control": cookie ? "private, max-age=60" : "public, max-age=300",
				},
			},
		);
	} catch (error) {
		if (error instanceof VideoError) {
			return Response.json(
				{ success: false, code: error.code, error: error.message },
				{ status: 400 },
			);
		}
		console.error("视频解析失败:", error);
		return Response.json(
			{ success: false, code: "upstream", error: "解析失败" },
			{ status: 502 },
		);
	}
}
