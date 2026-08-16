import type { Route } from "./+types/api.download";

// 允许通过此接口下载的 R2 前缀（防止任意 key 读取）
const ALLOWED_PREFIXES = ["download/", "image/"];

/**
 * 下载代理：从 R2 读取对象并强制以附件形式下载。
 *
 * 为什么需要：cdn.zhule.org 是 R2 公开桶，txt 等文本文件的 Content-Type
 * 是 text/plain，浏览器直接打开而不是下载。经由此接口读取后加上
 * Content-Disposition: attachment，就能强制浏览器下载，与文件类型无关。
 *
 * 用法：/api/download?key=download/xxx.txt
 */
export async function loader({ request, context }: Route.LoaderArgs) {
	const url = new URL(request.url);
	const key = url.searchParams.get("key") ?? "";

	if (!ALLOWED_PREFIXES.some((p) => key.startsWith(p))) {
		return new Response("Forbidden", { status: 403 });
	}

	const obj = await context.cloudflare.env.FILES.get(key);
	if (!obj) {
		return new Response("Not Found", { status: 404 });
	}

	const headers = new Headers();
	obj.writeHttpMetadata(headers);
	// 附件下载 + 中文文件名（RFC 5987）
	const name = key.split("/").pop() ?? "download";
	headers.set(
		"Content-Disposition",
		`attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
	);
	headers.set("Cache-Control", "public, max-age=86400");

	return new Response(obj.body, { headers });
}
