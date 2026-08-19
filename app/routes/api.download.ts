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

	// 前缀白名单，并排除恰好等于前缀的 0 字节文件夹占位对象
	if (!ALLOWED_PREFIXES.some((p) => key.startsWith(p) && key.length > p.length)) {
		return new Response("Forbidden", { status: 403 });
	}

	let obj: Awaited<ReturnType<typeof context.cloudflare.env.FILES.get>>;
	try {
		obj = await context.cloudflare.env.FILES.get(key);
	} catch (error) {
		console.error("R2 get 失败:", error);
		return new Response("Internal Server Error", { status: 500 });
	}
	if (!obj) {
		return new Response("Not Found", { status: 404 });
	}

	const headers = new Headers();
	obj.writeHttpMetadata(headers);
	// 附件下载 + 中文文件名（RFC 5987），附 ASCII 兜底兼容老浏览器
	const name = key.split("/").pop() ?? "download";
	const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
	headers.set(
		"Content-Disposition",
		`attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
	);
	headers.set("Cache-Control", "public, max-age=86400");

	return new Response(obj.body, { headers });
}
