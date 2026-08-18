import type { Route } from "+./+types/api.auth";
import { createToken, setAuthCookie, clearAuthCookie } from "../lib/auth";

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

	const { username, password } = await request.json() as {
		username?: string;
		password?: string;
	};

	if (username === ADMIN && password === ADMIN_PASSWD) {
		const token = await createToken(AUTH_SECRET);
		return new Response(JSON.stringify({ success: true }), {
			headers: { "Set-Cookie": setAuthCookie(token), "Content-Type": "application/json" },
		});
	}

	return Response.json({ success: false, error: "账号或密码错误" }, { status: 401 });
}
