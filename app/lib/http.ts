/**
 * 统一 HTTP 工具模块。
 */

/** 从请求头提取客户端 IP（CF-Connecting-IP 优先） */
export function getClientIp(request: Request): string {
	return (
		request.headers.get("CF-Connecting-IP") ||
		request.headers.get("x-real-ip") ||
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
		"unknown"
	);
}
