import type { Route } from "./+types/api.auth.github";

const GITHUB_AUTHORIZE = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN = "https://github.com/login/oauth/access_token";
const GITHUB_USER_API = "https://api.github.com/user";

// ============ Token 工具 ============

const USER_TOKEN_NAME = "zhule_user";
const USER_TOKEN_MAX_AGE = 60 * 60 * 24 * 7;

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

async function createUserToken(userId: string, secret: string): Promise<string> {
	const payload = `${userId}.${Date.now()}`;
	const signature = await sign(payload, secret);
	return `${payload}.${signature}`;
}

function setUserCookie(token: string): string {
	return `${USER_TOKEN_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${USER_TOKEN_MAX_AGE}`;
}

function generateId(): string {
	return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// ============ API 路由 ============

// GET /api/auth/github — 跳转到 GitHub 授权页
// GET /api/auth/github?code=xxx — 回调，用 code 换 token，获取用户信息
export async function loader({ request, context }: Route.LoaderArgs) {
	const { DB, AUTH_SECRET } = context.cloudflare.env;
	const clientId = (context.cloudflare.env as unknown as { GITHUB_CLIENT_ID?: string }).GITHUB_CLIENT_ID;
	const clientSecret = (context.cloudflare.env as unknown as { GITHUB_CLIENT_SECRET?: string }).GITHUB_CLIENT_SECRET;

	const url = new URL(request.url);
	const code = url.searchParams.get("code");

	// 第一步：跳转到 GitHub 授权页
	if (!code) {
		if (!clientId) {
			return Response.json({ success: false, error: "GitHub 登录未配置" }, { status: 500 });
		}
		const redirectUri = `${url.origin}/api/auth/github`;
		const githubUrl = `${GITHUB_AUTHORIZE}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user`;
		return Response.redirect(githubUrl, 302);
	}

	// 第二步：用 code 换 access_token
	if (!clientId || !clientSecret) {
		return Response.redirect("/settings?error=github_not_configured", 302);
	}

	try {
		const tokenRes = await fetch(GITHUB_TOKEN, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Accept": "application/json",
			},
			body: JSON.stringify({
				client_id: clientId,
				client_secret: clientSecret,
				code,
			}),
		});

		const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
		if (!tokenData.access_token) {
			return Response.redirect("/settings?error=github_token_failed", 302);
		}

		// 第三步：用 access_token 获取用户信息
		const userRes = await fetch(GITHUB_USER_API, {
			headers: {
				"Authorization": `Bearer ${tokenData.access_token}`,
				"Accept": "application/vnd.github+json",
				"User-Agent": "zhule-web",
			},
		});

		const githubUser = await userRes.json() as {
			id: number;
			login: string;
			name?: string;
			email?: string;
			avatar_url?: string;
		};

		const githubId = String(githubUser.id);
		const githubEmail = githubUser.email || `${githubUser.login}@github.local`;
		const nickname = githubUser.name || githubUser.login;

		// 第四步：查找或创建用户
		let user = await DB.prepare(
			"SELECT id FROM users WHERE github_id = ?"
		).bind(githubId).first<{ id: string }>();

		if (!user) {
			// 检查是否已有同邮箱用户
			const existing = await DB.prepare(
				"SELECT id FROM users WHERE email = ?"
			).bind(githubEmail).first<{ id: string }>();

			if (existing) {
				// 绑定 GitHub ID 到已有账户
				await DB.prepare(
					"UPDATE users SET github_id = ?, verified = 1 WHERE id = ?"
				).bind(githubId, existing.id).run();
				user = existing;
			} else {
				// 创建新用户
				const id = generateId();
				const now = new Date().toISOString();
				await DB.prepare(
					"INSERT INTO users (id, email, password_hash, nickname, verified, github_id, created_at) VALUES (?, ?, '', ?, 1, ?, ?)"
				).bind(id, githubEmail, nickname, githubId, now).run();
				user = { id };
			}
		}

		// 第五步：签发 token 并跳转
		const token = await createUserToken(user.id, AUTH_SECRET);
		return new Response(null, {
			status: 302,
			headers: {
				"Set-Cookie": setUserCookie(token),
				"Location": "/settings",
			},
		});
	} catch {
		return Response.redirect("/settings?error=github_failed", 302);
	}
}
