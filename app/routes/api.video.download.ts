import type { Route } from "./+types/api.video.download";
import { getClientIp } from "../lib/http";
import { createRateLimiter } from "../lib/rate-limit";

// 下载走服务端代理（B 站 CDN 有防盗链、封面图还需 Referer），按 IP 限流
const downloadLimiter = createRateLimiter(60, 60_000);

/** 只代理 B 站 CDN / 图床，避免变成开放代理 */
const ALLOWED_HOST_SUFFIXES = [".bilivideo.com", ".bilivideo.cn", ".hdslb.com", ".bilibili.com"];

function hostAllowed(hostname: string): boolean {
	return ALLOWED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

/** 生成同时兼容 ASCII 与中文文件名的 Content-Disposition */
function contentDisposition(filename: string): string {
	const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
	return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url);
	const target = url.searchParams.get("url");
	const name = url.searchParams.get("name") ?? "download";
	const type = url.searchParams.get("type") ?? "video";
	// inline=1 供页面内展示（如封面预览），不触发下载
	const inline = url.searchParams.get("inline") === "1";

	if (!target) {
		return Response.json({ success: false, error: "缺少下载地址" }, { status: 400 });
	}

	let targetUrl: URL;
	try {
		targetUrl = new URL(target);
	} catch {
		return Response.json({ success: false, error: "下载地址无效" }, { status: 400 });
	}
	if (targetUrl.protocol !== "https:" || !hostAllowed(targetUrl.hostname)) {
		return Response.json({ success: false, error: "不允许的下载来源" }, { status: 400 });
	}

	const clientIp = getClientIp(request);
	if (downloadLimiter.isLimited(clientIp)) {
		return Response.json({ success: false, error: "请求过于频繁" }, { status: 429 });
	}
	downloadLimiter.record(clientIp);

	const range = request.headers.get("range");
	const headers: Record<string, string> = {
		"User-Agent":
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
		Referer: "https://www.bilibili.com/",
	};
	if (range) headers.Range = range;

	let upstream: Response;
	try {
		upstream = await fetch(targetUrl.toString(), {
			headers,
			redirect: "follow",
			// 大文件流式传输，超时只用于避免连接一直挂起
			signal: AbortSignal.timeout(600_000),
		});
	} catch {
		return Response.json({ success: false, error: "下载源连接失败" }, { status: 502 });
	}

	if (!upstream.ok && upstream.status !== 206) {
		return Response.json(
			{ success: false, error: `下载源返回 ${upstream.status}` },
			{ status: 502 },
		);
	}

	const upstreamType = upstream.headers.get("content-type");
	const contentType =
		upstreamType ??
		(type === "image" ? "image/jpeg" : type === "audio" ? "audio/mp4" : "video/mp4");
	// B 站音频直接以 video/mp4 返回，按下载类型纠正便于播放器识别
	const finalType =
		type === "audio" && contentType.startsWith("video/") ? "audio/mp4" : contentType;

	const responseHeaders = new Headers({
		"Content-Type": finalType,
		"Cache-Control": inline ? "public, max-age=3600" : "no-store",
		"Accept-Ranges": "bytes",
	});
	if (!inline) responseHeaders.set("Content-Disposition", contentDisposition(name));
	const contentLength = upstream.headers.get("content-length");
	if (contentLength) responseHeaders.set("Content-Length", contentLength);
	const contentRange = upstream.headers.get("content-range");
	if (contentRange) responseHeaders.set("Content-Range", contentRange);

	return new Response(upstream.body, {
		status: upstream.status,
		headers: responseHeaders,
	});
}
