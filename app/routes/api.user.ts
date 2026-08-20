import type { Route } from "./+types/api.user";
import { getUserFromRequest, clearUserCookie } from "../lib/user-auth";

// ============ API 路由 ============

// GET：获取当前登录用户信息
export async function loader({ request, context }: Route.LoaderArgs) {
	const { AUTH_SECRET } = context.cloudflare.env;
	const userId = await getUserFromRequest(request, AUTH_SECRET);
	if (!userId) {
		return Response.json({ success: false, authenticated: false }, { status: 401 });
	}
	try {
		const user = await context.cloudflare.env.DB.prepare(
			"SELECT id, email, nickname, verified, created_at FROM users WHERE id = ?"
		).bind(userId).first();
		if (!user) {
			return Response.json({ success: false, authenticated: false }, { status: 401 });
		}
		return Response.json({ success: true, authenticated: true, user });
	} catch {
		return Response.json({ success: false, error: "查询失败" }, { status: 500 });
	}
}

// DELETE：登出  PATCH：修改昵称
export async function action({ request, context }: Route.ActionArgs) {
	const { DB, AUTH_SECRET } = context.cloudflare.env;

	// ── 登出 ──
	if (request.method === "DELETE") {
		return new Response(JSON.stringify({ success: true }), {
			headers: { "Set-Cookie": clearUserCookie(), "Content-Type": "application/json" },
		});
	}

	// ── 修改昵称 ──
	if (request.method === "PATCH") {
		const userId = await getUserFromRequest(request, AUTH_SECRET);
		if (!userId) {
			return Response.json({ success: false, error: "未登录" }, { status: 401 });
		}

		let nickname: string | undefined;
		try {
			const body = await request.json() as { nickname?: string };
			nickname = body.nickname?.trim();
		} catch {
			return Response.json({ success: false, error: "无效的请求体" }, { status: 400 });
		}

		if (!nickname || nickname.length > 50) {
			return Response.json({ success: false, error: "昵称无效或过长" }, { status: 400 });
		}

		try {
			await DB.prepare("UPDATE users SET nickname = ? WHERE id = ?").bind(nickname, userId).run();
			return Response.json({ success: true });
		} catch {
			return Response.json({ success: false, error: "修改失败" }, { status: 500 });
		}
	}

	return Response.json({ success: false, error: "不支持的请求方法" }, { status: 405 });
}
