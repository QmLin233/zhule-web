import type { Route } from "./+types/api.rules";
import { getAuthFromRequest } from "../lib/auth";

// 写入操作速率限制（每IP每分钟最多10次写入）
const writeAttempts = new Map<string, number[]>();
const WRITE_RATE_LIMIT = 10;
const WRITE_RATE_WINDOW = 60_000;

function getClientIp(request: Request): string {
	return (
		request.headers.get("CF-Connecting-IP") ||
		request.headers.get("x-real-ip") ||
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
		"unknown"
	);
}

function isWriteRateLimited(ip: string): boolean {
	const now = Date.now();
	const attempts = writeAttempts.get(ip) || [];
	const recent = attempts.filter((t) => now - t < WRITE_RATE_WINDOW);
	writeAttempts.set(ip, recent);
	return recent.length >= WRITE_RATE_LIMIT;
}

function recordWriteAttempt(ip: string): void {
	// 定期清理
	if (writeAttempts.size > 500) {
		const now = Date.now();
		for (const [k, v] of writeAttempts) {
			if (v.filter((t) => now - t < WRITE_RATE_WINDOW).length === 0) {
				writeAttempts.delete(k);
			}
		}
	}
	const attempts = writeAttempts.get(ip) || [];
	attempts.push(Date.now());
	writeAttempts.set(ip, attempts);
}

// 获取所有群规（公开）
export async function loader({ context }: Route.LoaderArgs) {
	const { DB } = context.cloudflare.env;

	try {
		const { results } = await DB.prepare(
			"SELECT * FROM rules ORDER BY important DESC, date DESC"
		).all();

		return new Response(JSON.stringify({ success: true, data: results }), {
			headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60, s-maxage=60" },
		});
	} catch (error) {
		console.error("获取公告失败:", error);
		return Response.json(
			{ success: false, error: "获取公告失败" },
			{ status: 500 }
		);
	}
}

// 创建 / 删除群规（需认证）
export async function action({ request, context }: Route.ActionArgs) {
	const { DB, AUTH_SECRET } = context.cloudflare.env;

	// 验证登录状态
	const authenticated = await getAuthFromRequest(request, AUTH_SECRET);
	if (!authenticated) {
		return Response.json({ success: false, error: "未登录" }, { status: 401 });
	}

	// 写入速率限制
	const clientIp = getClientIp(request);
	if (isWriteRateLimited(clientIp)) {
		return Response.json({ success: false, error: "操作过于频繁" }, { status: 429 });
	}
	recordWriteAttempt(clientIp);

	// 删除
	if (request.method === "DELETE") {
		try {
			const id = new URL(request.url).searchParams.get("id");
			if (!id) {
				return Response.json({ success: false, error: "缺少公告ID" }, { status: 400 });
			}

			const result = await DB.prepare("DELETE FROM rules WHERE id = ?").bind(id).run();
			if (result.meta.changes === 0) {
				return Response.json({ success: false, error: "公告不存在" }, { status: 404 });
			}

			return Response.json({ success: true, message: "公告已删除" });
		} catch (error) {
			console.error("删除公告失败:", error);
			return Response.json({ success: false, error: "删除公告失败" }, { status: 500 });
		}
	}

	// 编辑
	if (request.method === "PUT") {
		try {
			const { id, title, content, important } = await request.json() as {
				id?: string;
				title?: string;
				content?: string;
				important?: boolean;
			};

			if (!id || !title || !content) {
				return Response.json({ success: false, error: "缺少必要字段" }, { status: 400 });
			}

			if (title.length > 200 || content.length > 50000) {
				return Response.json({ success: false, error: "内容过长" }, { status: 400 });
			}

			const now = new Date().toISOString();
			const result = await DB.prepare(
				"UPDATE rules SET title = ?, content = ?, important = ?, updatedAt = ? WHERE id = ?"
			).bind(title, content, important ? 1 : 0, now, id).run();

			if (result.meta.changes === 0) {
				return Response.json({ success: false, error: "公告不存在" }, { status: 404 });
			}

			return Response.json({ success: true });
		} catch (error) {
			console.error("编辑公告失败:", error);
			return Response.json({ success: false, error: "编辑公告失败" }, { status: 500 });
		}
	}

	// 创建
	if (request.method !== "POST") {
		return Response.json({ success: false, error: "不支持的请求方法" }, { status: 405 });
	}

	try {
		const { title, content, important = false } = await request.json() as {
			title?: string;
			content?: string;
			important?: boolean;
		};

		if (!title || !content) {
			return Response.json({ success: false, error: "标题和内容不能为空" }, { status: 400 });
		}

		if (title.length > 200 || content.length > 50000) {
			return Response.json({ success: false, error: "内容过长" }, { status: 400 });
		}

		const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
		const now = new Date().toISOString();
		const date = now.split("T")[0];

		await DB.prepare(
			"INSERT INTO rules (id, title, content, date, important, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
		).bind(id, title, content, date, important ? 1 : 0, now, now).run();

		return Response.json({
			success: true,
			data: { id, title, content, date, important, createdAt: now, updatedAt: now },
		});
	} catch (error) {
		console.error("创建公告失败:", error);
		return Response.json(
			{ success: false, error: "创建公告失败" },
			{ status: 500 }
		);
	}
}