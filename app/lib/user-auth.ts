/**
 * 用户认证模块（GitHub OAuth 登录后的普通用户）。
 * 集中管理 user token 的创建、验证、cookie 操作。
 */

import { sign, constantTimeCompare } from "./crypto";

const USER_TOKEN_NAME = "zhule_user";
const USER_TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 天

/** 签发用户 token：<userId>.<timestamp>.<signature> */
export async function createUserToken(userId: string, secret: string): Promise<string> {
	const payload = `${userId}.${Date.now()}`;
	const signature = await sign(payload, secret);
	return `${payload}.${signature}`;
}

/** 验证用户 token，返回 userId 或 null */
export async function verifyUserToken(token: string, secret: string): Promise<string | null> {
	const parts = token.split(".");
	if (parts.length !== 3) return null;
	const [userId, ts, signature] = parts;
	const numTs = Number(ts);
	if (!Number.isFinite(numTs) || Date.now() - numTs > USER_TOKEN_MAX_AGE * 1000) return null;
	const expected = await sign(`${userId}.${ts}`, secret);
	return constantTimeCompare(signature, expected) ? userId : null;
}

/** 从请求 cookie 中提取并验证用户 token */
export function getUserFromRequest(request: Request, secret: string): Promise<string | null> {
	const cookie = request.headers.get("cookie") || "";
	const match = cookie.match(new RegExp(`${USER_TOKEN_NAME}=([^;]+)`));
	if (!match) return Promise.resolve(null);
	return verifyUserToken(match[1], secret);
}

/** 构造 Set-Cookie 头（设置用户 token） */
export function setUserCookie(token: string): string {
	return `${USER_TOKEN_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${USER_TOKEN_MAX_AGE}`;
}

/** 构造 Set-Cookie 头（清除用户 token） */
export function clearUserCookie(): string {
	return `${USER_TOKEN_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}
