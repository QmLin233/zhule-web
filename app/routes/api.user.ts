import type { Route } from "./+types/api.user";

// ============ 速率限制 ============

const loginFailures = new Map<string, number[]>();
const verifyAttempts = new Map<string, number[]>();
const MAX_LOGIN_ATTEMPTS = 5;
const MAX_VERIFY_ATTEMPTS = 8;
const RATE_WINDOW = 60_000; // 1 分钟

function getClientIp(request: Request): string {
	return (
		request.headers.get("CF-Connecting-IP") ||
		request.headers.get("x-real-ip") ||
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
		"unknown"
	);
}

function isRateLimited(map: Map<string, number[]>, key: string, max: number): boolean {
	const now = Date.now();
	const attempts = map.get(key) || [];
	const recent = attempts.filter((t) => now - t < RATE_WINDOW);
	map.set(key, recent);
	return recent.length >= max;
}

function recordAttempt(map: Map<string, number[]>, key: string): void {
	if (map.size > 2000) {
		const now = Date.now();
		for (const [k, v] of map) {
			if (v.filter((t) => now - t < RATE_WINDOW).length === 0) map.delete(k);
		}
	}
	const attempts = map.get(key) || [];
	attempts.push(Date.now());
	map.set(key, attempts);
}

// ============ 常量时间比较 ============

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}

// ============ 密码哈希（PBKDF2-SHA256） ============

async function hashPassword(password: string, salt?: Uint8Array): Promise<string> {
	const enc = new TextEncoder();
	const saltBuf = salt ?? crypto.getRandomValues(new Uint8Array(16));
	const key = await crypto.subtle.importKey(
		"raw",
		enc.encode(password),
		{ name: "PBKDF2" },
		false,
		["deriveBits"],
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt: saltBuf, iterations: 100_000, hash: "SHA-256" },
		key,
		256,
	);
	const hash = new Uint8Array(bits);
	// 格式：salt_hex:hash_hex
	const saltHex = Array.from(saltBuf).map((b) => b.toString(16).padStart(2, "0")).join("");
	const hashHex = Array.from(hash).map((b) => b.toString(16).padStart(2, "0")).join("");
	return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [saltHex, expectedHash] = stored.split(":");
	if (!saltHex || !expectedHash) return false;
	const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
	const result = await hashPassword(password, salt);
	return result === stored;
}

// ============ 用户 Token ============

const USER_TOKEN_NAME = "zhule_user";
const USER_TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 天

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

async function verifyUserToken(token: string, secret: string): Promise<string | null> {
	const parts = token.split(".");
	if (parts.length !== 3) return null;
	const [userId, ts, signature] = parts;
	const numTs = Number(ts);
	if (!Number.isFinite(numTs) || Date.now() - numTs > USER_TOKEN_MAX_AGE * 1000) return null;
	const expected = await sign(`${userId}.${ts}`, secret);
	if (signature.length !== expected.length) return null;
	let diff = 0;
	for (let i = 0; i < signature.length; i++) {
		diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
	}
	return diff === 0 ? userId : null;
}

function setUserCookie(token: string): string {
	return `${USER_TOKEN_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${USER_TOKEN_MAX_AGE}`;
}

function clearUserCookie(): string {
	return `${USER_TOKEN_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

function getUserFromRequest(request: Request, secret: string): Promise<string | null> {
	const cookie = request.headers.get("cookie") || "";
	const match = cookie.match(new RegExp(`${USER_TOKEN_NAME}=([^;]+)`));
	if (!match) return Promise.resolve(null);
	return verifyUserToken(match[1], secret);
}

// ============ 邮箱验证码 ============

function generateVerifyCode(): string {
	return String(Math.floor(100000 + Math.random() * 900000));
}

/** 发送验证码邮件（通过 Resend API） */
async function sendVerifyEmail(
	db: D1Database,
	email: string,
	code: string,
	resendKey?: string,
): Promise<boolean> {
	const expiresAt = Date.now() + 10 * 60 * 1000;
	await db.prepare(
		"INSERT OR REPLACE INTO verification_codes (email, code, expires_at) VALUES (?, ?, ?)"
	).bind(email, code, expiresAt).run();

	if (resendKey) {
		try {
			await fetch("https://api.resend.com/emails", {
				method: "POST",
				headers: {
					"Authorization": `Bearer ${resendKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					from: "逐乐 <user@zhule.org>",
					to: email,
					subject: "逐乐 - 邮箱验证码",
					html: `<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px;">
						<h2 style="color:#333;">逐乐邮箱验证</h2>
						<p>您的验证码是：</p>
						<p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#111;text-align:center;padding:20px;background:#f5f5f5;border-radius:8px;">${code}</p>
						<p style="color:#666;font-size:13px;">验证码 10 分钟内有效，请勿泄露给他人。</p>
					</div>`,
				}),
			});
			return true;
		} catch {
			return false;
		}
	}
	return false;
}

// ============ 工具函数 ============

function generateId(): string {
	return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function isValidEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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

// POST：注册  PUT：登录  DELETE：登出  PATCH：修改昵称  OPTIONS：发送验证码  HEAD：验证邮箱
export async function action({ request, context }: Route.ActionArgs) {
	const { DB, AUTH_SECRET } = context.cloudflare.env;
	const resendKey = (context.cloudflare.env as unknown as { RESEND_API_KEY?: string }).RESEND_API_KEY;

	// ── 登出 ──
	if (request.method === "DELETE") {
		return new Response(JSON.stringify({ success: true }), {
			headers: { "Set-Cookie": clearUserCookie(), "Content-Type": "application/json" },
		});
	}

	// ── 发送验证码 ──
	if (request.method === "OPTIONS") {
		let email: string | undefined;
		try {
			const body = await request.json() as { email?: string };
			email = body.email?.trim().toLowerCase();
		} catch {
			return Response.json({ success: false, error: "无效的请求体" }, { status: 400 });
		}
		if (!email || !isValidEmail(email)) {
			return Response.json({ success: false, error: "邮箱格式不正确" }, { status: 400 });
		}
		// 频率限制：同一邮箱 60 秒内只能发一次
		const recent = await DB.prepare(
			"SELECT expires_at FROM verification_codes WHERE email = ? AND expires_at > ?"
		).bind(email, Date.now() - 9 * 60 * 1000).first();
		if (recent) {
			return Response.json({ success: false, error: "请稍后再试" }, { status: 429 });
		}
		const code = generateVerifyCode();
		const sent = await sendVerifyEmail(DB, email, code, resendKey);
		return Response.json({
			success: true,
			message: sent ? "验证码已发送" : "验证码已生成（邮件服务未配置，请联系管理员）",
		});
	}

	// ── 验证邮箱 / 重置密码 ──
	if (request.method === "HEAD") {
		const ip = getClientIp(request);
		if (isRateLimited(verifyAttempts, ip, MAX_VERIFY_ATTEMPTS)) {
			return Response.json({ success: false, error: "验证码尝试次数过多，请稍后再试" }, { status: 429 });
		}

		let email: string | undefined;
		let code: string | undefined;
		let newPassword: string | undefined;
		let action: string | undefined;
		try {
			const body = await request.json() as { email?: string; code?: string; newPassword?: string; action?: string };
			email = body.email?.trim().toLowerCase();
			code = body.code?.trim();
			newPassword = body.newPassword;
			action = body.action;
		} catch {
			return Response.json({ success: false, error: "无效的请求体" }, { status: 400 });
		}
		if (!email || !code) {
			return Response.json({ success: false, error: "邮箱和验证码不能为空" }, { status: 400 });
		}
		const record = await DB.prepare(
			"SELECT code, expires_at FROM verification_codes WHERE email = ?"
		).bind(email).first<{ code: string; expires_at: number }>();

		// 常量时间比较验证码
		const codeValid = record && timingSafeEqual(record.code, code) && Date.now() <= record.expires_at;
		if (!codeValid) {
			recordAttempt(verifyAttempts, ip);
			return Response.json({ success: false, error: "验证码无效或已过期" }, { status: 400 });
		}
		await DB.prepare("DELETE FROM verification_codes WHERE email = ?").bind(email).run();

		// 重置密码
		if (action === "reset") {
			if (!newPassword || newPassword.length < 6) {
				return Response.json({ success: false, error: "密码至少 6 位" }, { status: 400 });
			}
			if (newPassword.length > 128) {
				return Response.json({ success: false, error: "密码过长" }, { status: 400 });
			}
			const passwordHash = await hashPassword(newPassword);
			await DB.prepare("UPDATE users SET password_hash = ?, verified = 1 WHERE email = ?").bind(passwordHash, email).run();
			return Response.json({ success: true, message: "密码重置成功" });
		}

		// 普通邮箱验证
		await DB.prepare("UPDATE users SET verified = 1 WHERE email = ?").bind(email).run();
		return Response.json({ success: true, message: "邮箱验证成功" });
	}

	// ── 登录 ──
	if (request.method === "PUT") {
		const ip = getClientIp(request);
		if (isRateLimited(loginFailures, ip, MAX_LOGIN_ATTEMPTS)) {
			return Response.json({ success: false, error: "请求过于频繁，请稍后再试" }, { status: 429 });
		}

		let email: string | undefined;
		let password: string | undefined;
		try {
			const body = await request.json() as { email?: string; password?: string };
			email = body.email?.trim().toLowerCase();
			password = body.password;
		} catch {
			return Response.json({ success: false, error: "无效的请求体" }, { status: 400 });
		}

		if (!email || !password) {
			return Response.json({ success: false, error: "邮箱和密码不能为空" }, { status: 400 });
		}

		try {
			const user = await DB.prepare(
				"SELECT id, password_hash, verified FROM users WHERE email = ?"
			).bind(email).first<{ id: string; password_hash: string; verified: number }>();

			if (!user || !(await verifyPassword(password, user.password_hash))) {
				recordAttempt(loginFailures, ip);
				return Response.json({ success: false, error: "邮箱或密码错误" }, { status: 401 });
			}

			// 登录成功，清除失败记录
			loginFailures.delete(ip);

			if (!user.verified) {
				const code = generateVerifyCode();
				await sendVerifyEmail(DB, email, code, resendKey);
				return Response.json({ success: false, needVerify: true, error: "请先验证邮箱，验证码已发送" }, { status: 403 });
			}

			const token = await createUserToken(user.id, AUTH_SECRET);
			return new Response(JSON.stringify({ success: true, verified: true }), {
				headers: { "Set-Cookie": setUserCookie(token), "Content-Type": "application/json" },
			});
		} catch {
			return Response.json({ success: false, error: "登录失败" }, { status: 500 });
		}
	}

	// ── 注册（需验证码） ──
	if (request.method === "POST") {
		let email: string | undefined;
		let password: string | undefined;
		let nickname: string | undefined;
		let verifyCode: string | undefined;
		try {
			const body = await request.json() as { email?: string; password?: string; nickname?: string; verifyCode?: string };
			email = body.email?.trim().toLowerCase();
			password = body.password;
			nickname = body.nickname?.trim();
			verifyCode = body.verifyCode?.trim();
		} catch {
			return Response.json({ success: false, error: "无效的请求体" }, { status: 400 });
		}

		if (!email || !password) {
			return Response.json({ success: false, error: "邮箱和密码不能为空" }, { status: 400 });
		}
		if (!verifyCode) {
			return Response.json({ success: false, error: "请输入验证码" }, { status: 400 });
		}
		if (!isValidEmail(email)) {
			return Response.json({ success: false, error: "邮箱格式不正确" }, { status: 400 });
		}
		if (password.length < 6) {
			return Response.json({ success: false, error: "密码至少 6 位" }, { status: 400 });
		}
		if (email.length > 254 || (nickname && nickname.length > 50)) {
			return Response.json({ success: false, error: "输入过长" }, { status: 400 });
		}

		// 验证验证码
		const codeRecord = await DB.prepare(
			"SELECT code, expires_at FROM verification_codes WHERE email = ?"
		).bind(email).first<{ code: string; expires_at: number }>();
		if (!codeRecord || codeRecord.code !== verifyCode || Date.now() > codeRecord.expires_at) {
			return Response.json({ success: false, error: "验证码无效或已过期" }, { status: 400 });
		}

		try {
			// 检查邮箱是否已注册
			const existing = await DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
			if (existing) {
				return Response.json({ success: false, error: "注册失败，请检查邮箱或稍后重试" }, { status: 400 });
			}

			const id = generateId();
			const passwordHash = await hashPassword(password);
			const now = new Date().toISOString();

			// 验证码已验证，直接标记为已验证
			await DB.prepare(
				"INSERT INTO users (id, email, password_hash, nickname, verified, created_at) VALUES (?, ?, ?, ?, 1, ?)"
			).bind(id, email, passwordHash, nickname || "", now).run();

			// 清除验证码
			await DB.prepare("DELETE FROM verification_codes WHERE email = ?").bind(email).run();

			const token = await createUserToken(id, AUTH_SECRET);
			return new Response(JSON.stringify({ success: true }), {
				headers: { "Set-Cookie": setUserCookie(token), "Content-Type": "application/json" },
			});
		} catch {
			return Response.json({ success: false, error: "注册失败" }, { status: 500 });
		}
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
