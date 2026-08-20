/**
 * 管理后台认证模块。
 * 使用 crypto.ts 提供的签名和常量时间比较。
 */

import { sign, constantTimeCompare } from "./crypto";

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

	const ts = Number(payload);
	if (!Number.isFinite(ts) || Date.now() - ts > TOKEN_MAX_AGE * 1000) return false;

	const expected = await sign(payload, secret);
	return constantTimeCompare(signature, expected);
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
