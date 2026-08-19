/**
 * 简单的 HMAC-SHA256 token 认证工具。
 * 用于管理后台 API 的服务端鉴权。
 */

const TOKEN_NAME = "zhule_admin";
const TOKEN_MAX_AGE = 60 * 60 * 24; // 24 小时

/** 生成签名 token */
export async function createToken(secret: string): Promise<string> {
	const payload = `${Date.now()}`;
	const signature = await sign(payload, secret);
	return `${payload}.${signature}`;
}

/** 验证 token 是否有效（签名正确且未过期） */
export async function verifyToken(token: string, secret: string): Promise<boolean> {
	const parts = token.split(".");
	if (parts.length !== 2) return false;
	const [payload, signature] = parts;

	// 服务端过期校验：token 创建时间超过 TOKEN_MAX_AGE 秒则拒绝
	const ts = Number(payload);
	if (!Number.isFinite(ts) || Date.now() - ts > TOKEN_MAX_AGE * 1000) return false;

	const expected = await sign(payload, secret);
	// 常量时间比较
	if (signature.length !== expected.length) return false;
	let diff = 0;
	for (let i = 0; i < signature.length; i++) {
		diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
	}
	return diff === 0;
}

/** HMAC-SHA256 签名 */
async function sign(data: string, secret: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
	return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 从请求中提取并验证 cookie */
export async function getAuthFromRequest(request: Request, secret: string): Promise<boolean> {
	const cookie = request.headers.get("cookie") || "";
	const match = cookie.match(new RegExp(`${TOKEN_NAME}=([^;]+)`));
	if (!match) return false;
	return verifyToken(match[1], secret);
}

/** 构造 Set-Cookie 头 */
export function setAuthCookie(token: string): string {
	return `${TOKEN_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${TOKEN_MAX_AGE}`;
}

/** 清除 cookie */
export function clearAuthCookie(): string {
	return `${TOKEN_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}
