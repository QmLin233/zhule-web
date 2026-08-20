import type { Route } from "./+types/api.auth";
import { createToken, setAuthCookie, clearAuthCookie, getAuthFromRequest } from "../lib/auth";
import { hashSHA256, constantTimeCompare } from "../lib/crypto";
import { getClientIp } from "../lib/http";
import { createRateLimiter } from "../lib/rate-limit";

const loginLimiter = createRateLimiter(5, 60_000);

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
	if (loginLimiter.isLimited(ip)) {
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

	// 确保环境变量已配置，防止空凭据绕过
	if (!ADMIN || !ADMIN_PASSWD) {
		return Response.json({ success: false, error: "服务端未配置管理员认证" }, { status: 500 });
	}

	// 拒绝空凭据
	if (!username || !password) {
		return Response.json({ success: false, error: "账号或密码不能为空" }, { status: 401 });
	}

	// 常量时间比较，防止时序攻击
	const [userHash, passHash, expectedUser, expectedPass] = await Promise.all([
		hashSHA256(username ?? ""),
		hashSHA256(password ?? ""),
		hashSHA256(ADMIN ?? ""),
		hashSHA256(ADMIN_PASSWD ?? ""),
	]);

	if (constantTimeCompare(userHash, expectedUser) && constantTimeCompare(passHash, expectedPass)) {
		const token = await createToken(AUTH_SECRET);
		return new Response(JSON.stringify({ success: true }), {
			headers: { "Set-Cookie": setAuthCookie(token), "Content-Type": "application/json" },
		});
	}

	loginLimiter.record(ip);
	return Response.json({ success: false, error: "账号或密码错误" }, { status: 401 });
}
