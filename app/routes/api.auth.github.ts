import { redirect } from "react-router";
import type { Route } from "./+types/api.auth.github";
import { sign, constantTimeCompare } from "../lib/crypto";
import { createUserToken, setUserCookie, clearUserCookie } from "../lib/user-auth";

const GITHUB_AUTHORIZE = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN = "https://github.com/login/oauth/access_token";
const GITHUB_USER_API = "https://api.github.com/user";

const STATE_COOKIE_NAME = "gh_oauth_state";
const STATE_MAX_AGE = 300; // 5 分钟

function generateId(): string {
	return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

// ============ State（CSRF 防护） ============

/**
 * 生成 OAuth state 参数：`<random>.<timestamp>.<hmac>`
 * 用 HMAC 签名防止伪造，用时间戳防止重放。
 */
async function createState(secret: string): Promise<string> {
	const nonce = crypto.randomUUID().replace(/-/g, "");
	const ts = Date.now().toString();
	const payload = `${nonce}.${ts}`;
	const sig = await sign(payload, secret);
	return `${payload}.${sig}`;
}

/** 验证 state：签名正确且未过期 */
async function verifyState(state: string, secret: string): Promise<boolean> {
	const parts = state.split(".");
	if (parts.length !== 3) return false;
	const [nonce, ts, signature] = parts;
	const numTs = Number(ts);
	if (!Number.isFinite(numTs) || Date.now() - numTs > STATE_MAX_AGE * 1000) return false;
	const expected = await sign(`${nonce}.${ts}`, secret);
	return constantTimeCompare(signature, expected);
}

function setStateCookie(state: string): string {
	return `${STATE_COOKIE_NAME}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${STATE_MAX_AGE}`;
}

function clearStateCookie(): string {
	return `${STATE_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function getStateFromCookie(request: Request): string | null {
	const cookie = request.headers.get("cookie") || "";
	const match = cookie.match(new RegExp(`${STATE_COOKIE_NAME}=([^;]+)`));
	return match ? match[1] : null;
}

// ============ API 路由 ============

// GET /api/auth/github — 跳转到 GitHub 授权页
// GET /api/auth/github?code=xxx — 回调，用 code 换 token，获取用户信息
export async function loader({ request, context }: Route.LoaderArgs) {
	try {
		const rawId = context.cloudflare.env.GITHUB_CLIENT_ID;
		const rawSecret = context.cloudflare.env.GITHUB_CLIENT_SECRET;
		const clientId = rawId?.trim();
		const clientSecret = rawSecret?.trim();
		const { DB, AUTH_SECRET } = context.cloudflare.env;

		const url = new URL(request.url);
		const code = url.searchParams.get("code");

		// 调试日志：检查 client_id 前缀（不泄露 secret）
		console.log("[github-auth] callback hit, client_id prefix:", clientId?.substring(0, 6), "client_id length:", clientId?.length, "secret length:", clientSecret?.length);

		// 第一步：跳转到 GitHub 授权页
		if (!code) {
			if (!clientId) {
				return Response.json({ success: false, error: "GitHub 登录未配置" }, { status: 500 });
			}
			const redirectUri = `${url.origin}/api/auth/github`;
			// 生成 state 防止 CSRF 攻击
			const state = await createState(AUTH_SECRET);
			const githubUrl = `${GITHUB_AUTHORIZE}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user&state=${state}`;
			return new Response(null, {
				status: 302,
				headers: {
					"Location": githubUrl,
					"Set-Cookie": setStateCookie(state),
				},
			});
		}

		// 第二步：预检必要配置 + 校验 state（CSRF 防护）
		if (!clientId || !clientSecret) {
			console.error("[github-auth] missing config, clientId:", !!clientId, "clientSecret:", !!clientSecret);
			throw redirect("/settings?error=github_not_configured");
		}
		if (!AUTH_SECRET) {
			throw redirect("/settings?error=auth_secret_missing");
		}
		if (!DB) {
			throw redirect("/settings?error=db_missing");
		}

		// 校验 state 参数防止 CSRF
		const urlState = url.searchParams.get("state");
		const cookieState = getStateFromCookie(request);
		if (!urlState || !cookieState || urlState !== cookieState || !(await verifyState(urlState, AUTH_SECRET))) {
			throw redirect("/settings?error=github_state_invalid");
		}

		// 第三步：用 code 换 access_token
		const bodyStr = `client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&code=${encodeURIComponent(code)}`;
		console.log("[github-auth] exchanging code, client_id used:", clientId);
		const tokenRes = await fetch(GITHUB_TOKEN, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"Accept": "application/json",
			},
			body: bodyStr,
		});

		const tokenData = await tokenRes.json() as { access_token?: string; error?: string; error_description?: string };
		if (!tokenData.access_token) {
			console.error("[github-auth] token exchange failed:", tokenData.error, tokenData.error_description);
			throw redirect("/settings?error=github_token_failed");
		}

		// 第四步：用 access_token 获取用户信息
		const userRes = await fetch(GITHUB_USER_API, {
			headers: {
				"Authorization": `Bearer ${tokenData.access_token}`,
				"Accept": "application/vnd.github+json",
				"User-Agent": "zhule-web",
			},
		});

		if (!userRes.ok) {
			console.error("[github-auth] user API failed:", userRes.status, await userRes.text());
			throw redirect("/settings?error=github_user_failed");
		}

		const githubUser = await userRes.json() as {
			id: number;
			login: string;
			name?: string;
			email?: string;
			avatar_url?: string;
		};

		if (!githubUser.id) {
			console.error("[github-auth] invalid user data:", githubUser);
			throw redirect("/settings?error=github_invalid_user");
		}

		const githubId = String(githubUser.id);
		const githubEmail = githubUser.email || `${githubUser.login}@github.local`;
		const nickname = githubUser.name || githubUser.login;

		// 第五步：查找或创建用户
		let user = await DB.prepare(
			"SELECT id FROM users WHERE github_id = ?"
		).bind(githubId).first<{ id: string }>();

		if (!user) {
			// 检查是否已有同邮箱用户（防止邮箱绑定劫持）
			const existing = await DB.prepare(
				"SELECT id FROM users WHERE email = ?"
			).bind(githubEmail).first<{ id: string }>();

			if (existing) {
				// 邮箱已被占用：不绑定到已有账户，为 GitHub 创建独立用户
				const uniqueEmail = `${githubUser.login}+${githubId}@github.local`;
				const id = generateId();
				const now = new Date().toISOString();
				await DB.prepare(
					"INSERT INTO users (id, email, password_hash, nickname, verified, github_id, created_at) VALUES (?, ?, '', ?, 1, ?, ?)"
				).bind(id, uniqueEmail, nickname, githubId, now).run();
				user = { id };
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

		// 第六步：签发 token 并跳转（清除 state cookie）
		const token = await createUserToken(user.id, AUTH_SECRET);
		return new Response(null, {
			status: 302,
			headers: {
				"Set-Cookie": `${setUserCookie(token)}, ${clearStateCookie()}`,
				"Location": "/settings",
			},
		});
	} catch (err) {
		// 如果是 React Router 的 redirect（Response 实例），直接抛出让框架处理
		if (err instanceof Response) {
			throw err;
		}
		// 仅在服务端日志记录完整错误，不向客户端暴露内部详情
		console.error("[github-auth] unexpected error:", err);
		throw redirect("/settings?error=github_failed");
	}
}
