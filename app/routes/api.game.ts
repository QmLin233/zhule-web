import type { Route } from "./+types/api.game";
import { getAuthFromRequest } from "../lib/auth";
import { replayGame } from "../lib/game-engine";
import type { Dir } from "../lib/game-engine";

// ============ API 路由 ============

// GET：获取排行榜 + 当前用户最高分
export async function loader({ request, context }: Route.LoaderArgs) {
	const { DB, AUTH_SECRET } = context.cloudflare.env;
	try {
		const { results } = await DB.prepare(
			"SELECT s.score, s.max_tile, s.moves_count, s.elapsed, s.created_at, u.nickname, u.email FROM game_scores s LEFT JOIN users u ON s.user_id = u.id ORDER BY s.score DESC LIMIT 20"
		).all();

		// 获取当前用户的最高分
		let myBest: number | null = null;
		const userId = await getAuthFromRequest(request, AUTH_SECRET);
		if (userId) {
			const row = await DB.prepare(
				"SELECT MAX(score) as best FROM game_scores WHERE user_id = ?"
			).bind(userId).first<{ best: number | null }>();
			myBest = row?.best ?? null;
		}

		return Response.json({ success: true, scores: results, myBest });
	} catch {
		return Response.json({ success: false, error: "查询失败" }, { status: 500 });
	}
}

// POST：提交游戏成绩（需登录）
export async function action({ request, context }: Route.ActionArgs) {
	if (request.method !== "POST") {
		return Response.json({ success: false, error: "不支持的请求方法" }, { status: 405 });
	}

	const { DB, AUTH_SECRET } = context.cloudflare.env;
	const userId = await getAuthFromRequest(request, AUTH_SECRET);
	if (!userId) {
		return Response.json({ success: false, error: "未登录" }, { status: 401 });
	}

	// 获取用户信息
	const user = await DB.prepare("SELECT verified, nickname FROM users WHERE id = ?").bind(userId).first<{ verified: number; nickname: string }>();
	if (!user) {
		return Response.json({ success: false, error: "用户不存在" }, { status: 401 });
	}

	let seed: number | undefined;
	let moves: string[] | undefined;
	let clientScore: number | undefined;
	let elapsed: number | undefined;
	try {
		const body = await request.json() as { seed?: number; moves?: string[]; score?: number; elapsed?: number };
		seed = body.seed;
		moves = body.moves;
		clientScore = body.score;
		elapsed = body.elapsed;
	} catch {
		return Response.json({ success: false, error: "无效的请求体" }, { status: 400 });
	}

	if (seed === undefined || !moves || clientScore === undefined || elapsed === undefined) {
		return Response.json({ success: false, error: "缺少必要参数" }, { status: 400 });
	}

	// 基本反作弊校验
	if (moves.length > 10000 || moves.length === 0) {
		return Response.json({ success: false, error: "移动次数异常" }, { status: 400 });
	}
	if (elapsed < 0 || elapsed > 86400) {
		return Response.json({ success: false, error: "时间异常" }, { status: 400 });
	}
	if (clientScore < 0 || clientScore > 10000000) {
		return Response.json({ success: false, error: "分数异常" }, { status: 400 });
	}

	// 服务端回放验证
	const result = replayGame(seed, moves as Dir[]);

	if (result.score !== clientScore) {
		return Response.json({ success: false, error: "分数验证失败", expected: result.score, received: clientScore }, { status: 400 });
	}

	// 存储成绩
	const now = new Date().toISOString();
	await DB.prepare(
		"INSERT INTO game_scores (user_id, score, max_tile, moves_count, elapsed, seed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
	).bind(userId, result.score, result.maxTile, moves.length, elapsed, seed, now).run();

	return Response.json({
		success: true,
		score: result.score,
		maxTile: result.maxTile,
		nickname: user.nickname || "匿名",
	});
}
