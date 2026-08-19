import type { Route } from "./+types/api.auth";
import { createToken, setAuthCookie, clearAuthCookie, getAuthFromRequest } from "../lib/auth";

// 简易内存速率限制：记录 IP 最近失败时间戳
const loginFailures = new Map<string, number[]>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000; // 1 分钟窗口
const MAX_ENTRIES = 1000; // 防止内存泄漏

function getClientIp(request: Request): string {
	return (
		request.headers.get("CF-Connecting-IP") ||
		request.headers.get("x-real-ip") ||
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
		"unknown"
	);
}

function isRateLimited(ip: string): boolean {
	const now = Date.now();
	const attempts = loginFailures.get(ip) || [];
	const recent = attempts.filter((t) => now - t < WINDOW_MS);
	loginFailures.set(ip, recent);
	return recent.length >= MAX_ATTEMPTS;
}

/** 清理过期条目，防止内存泄漏 */
function cleanupFailures(): void {
	const now = Date.now();
	for (const [ip, attempts] of loginFailures) {
		const recent = attempts.filter((t) => now - t < WINDOW_MS);
		if (recent.length === 0) {
			loginFailures.delete(ip);
		} else {
			loginFailures.set(ip, recent);
		}
	}
}

function recordFailure(ip: string): void {
	// 定期清理防止内存泄漏
	if (loginFailures.size > MAX_ENTRIES) {
		cleanupFailures();
	}
	const attempts = loginFailures.get(ip) || [];
	attempts.push(Date.now());
	loginFailures.set(ip, attempts);
}

// 检查登录状态
export async function loader({ request, context }: Route.LoaderArgs) {
	const { AUTH_SECRET } = context.cloudflare.env;
	const authenticated = await getAuthFromRequest(request, AUTH_SECRET);
	return Response.json({ authenticated });
}

export async function action({ request, context }: Route.ActionArgs) {
	const { ADMIN, ADMIN_PASSWD, AUTH_SECRET } = context.cloudflare.env;

	// 登出
	if (request.method === "DELETE") {
		return new Response(JSON.stringify({ success: true }), {
			headers: { "Set-Cookie": clearAuthCookie(), "Content-Type": "application/json" },
		});
	}

	if (request.method !== "POST") {
		return Response.json({ success: false }, { status: 405 });
	}

	// 暴力破解防护
	const ip = getClientIp(request);
	if (isRateLimited(ip)) {
		return Response.json(
			{ success: false, error: "请求过于频繁，请稍后再试" },
			{ status: 429 },
		);
	}

	let username: string | undefined;
	let password: string | undefined;
	try {
		const body = await request.json() as { username?: string; password?: string };
		username = body.username;
		password = body.password;
	} catch {
		return Response.json({ success: false, error: "无效的请求体" }, { status: 400 });
	}

	// 常量时间比较，防止时序攻击
	const enc = new TextEncoder();
	const hash = async (s: string) => {
		const buf = await crypto.subtle.digest("SHA-256", enc.encode(s));
		return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
	};
	const [userHash, passHash, expectedUser, expectedPass] = await Promise.all([
		hash(username ?? ""),
		hash(password ?? ""),
		hash(ADMIN ?? ""),
		hash(ADMIN_PASSWD ?? ""),
	]);

	if (userHash === expectedUser && passHash === expectedPass) {
		loginFailures.delete(ip);
		const token = await createToken(AUTH_SECRET);
		return new Response(JSON.stringify({ success: true }), {
			headers: { "Set-Cookie": setAuthCookie(token), "Content-Type": "application/json" },
		});
	}

	recordFailure(ip);
	return Response.json({ success: false, error: "账号或密码错误" }, { status: 401 });
}
