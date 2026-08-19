import type { Route } from "./+types/api.game";
import { getAuthFromRequest } from "../lib/auth";

// ============ 种子随机数（Mulberry32） ============

/** 服务端回放用的确定性 PRNG，与客户端一致 */
function mulberry32(seed: number): () => number {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// ============ 2048 回放引擎（与客户端逻辑完全一致） ============

const SIZE = 4;
type Dir = "left" | "right" | "up" | "down";
type Tile = { id: number; x: number; y: number; value: number };
type Board = (Tile | null)[][];

const VECTOR: Record<Dir, { x: number; y: number }> = {
	up: { x: 0, y: -1 },
	right: { x: 1, y: 0 },
	down: { x: 0, y: 1 },
	left: { x: -1, y: 0 },
};

function emptyBoard(): Board {
	return Array.from({ length: SIZE }, () => Array<Tile | null>(SIZE).fill(null));
}

function cloneBoard(board: Board): Board {
	return board.map((row) => row.slice());
}

function withinBounds(p: { x: number; y: number }): boolean {
	return p.x >= 0 && p.x < SIZE && p.y >= 0 && p.y < SIZE;
}

function randomAvailableCell(board: Board, rng: () => number): { x: number; y: number } | null {
	const empty: Array<{ x: number; y: number }> = [];
	board.forEach((row, y) =>
		row.forEach((tile, x) => {
			if (!tile) empty.push({ x, y });
		}),
	);
	return empty.length ? empty[Math.floor(rng() * empty.length)] : null;
}

let uid = 1;
function nextId() { return uid++; }

function addRandomTile(board: Board, rng: () => number): { board: Board; addedId: number } {
	const cell = randomAvailableCell(board, rng);
	if (!cell) return { board, addedId: 0 };
	const id = nextId();
	const next = cloneBoard(board);
	next[cell.y][cell.x] = { id, x: cell.x, y: cell.y, value: rng() < 0.9 ? 2 : 4 };
	return { board: next, addedId: id };
}

function buildTraversals(vector: { x: number; y: number }): { x: number[]; y: number[] } {
	const xs = [0, 1, 2, 3];
	const ys = [0, 1, 2, 3];
	if (vector.x === 1) xs.reverse();
	if (vector.y === 1) ys.reverse();
	return { x: xs, y: ys };
}

function findFarthestPosition(
	board: Board,
	cell: { x: number; y: number },
	vector: { x: number; y: number },
): { farthest: { x: number; y: number }; next: { x: number; y: number } } {
	let farthest = cell;
	let next = { x: cell.x + vector.x, y: cell.y + vector.y };
	while (withinBounds(next) && !board[next.y][next.x]) {
		farthest = next;
		next = { x: next.x + vector.x, y: next.y + vector.y };
	}
	return { farthest, next };
}

function doMove(board: Board, dir: Dir): { board: Board; moved: boolean; gained: number } {
	const vector = VECTOR[dir];
	const traversals = buildTraversals(vector);
	const next = cloneBoard(board);
	let moved = false;
	let gained = 0;
	const merged: number[] = [];

	traversals.x.forEach((x) => {
		traversals.y.forEach((y) => {
			const tile = next[y][x];
			if (!tile) return;
			const { farthest, next: target } = findFarthestPosition(next, { x, y }, vector);
			const other = withinBounds(target) ? next[target.y][target.x] : null;
			let landed = farthest;
			if (other && other.value === tile.value && !merged.includes(other.id)) {
				next[y][x] = null;
				next[target.y][target.x] = { id: tile.id, x: target.x, y: target.y, value: tile.value * 2 };
				merged.push(tile.id);
				gained += tile.value * 2;
				landed = target;
			} else {
				next[y][x] = null;
				next[farthest.y][farthest.x] = { ...tile, x: farthest.x, y: farthest.y };
			}
			if (landed.x !== cell.x || landed.y !== cell.y) moved = true;
		});
	});

	return { board: next, moved, gained };
}

function movesAvailable(board: Board): boolean {
	for (let y = 0; y < SIZE; y++) {
		for (let x = 0; x < SIZE; x++) {
			const v = board[y][x]?.value ?? 0;
			if (v === 0) return true;
			if (x + 1 < SIZE && v === (board[y][x + 1]?.value ?? 0)) return true;
			if (y + 1 < SIZE && v === (board[y + 1][x]?.value ?? 0)) return true;
		}
	}
	return false;
}

/** 服务端回放：用种子+移动序列重建游戏，返回最终分数 */
function replayGame(seed: number, moves: Dir[]): { score: number; maxTile: number; valid: boolean } {
	uid = 1;
	const rng = mulberry32(seed);
	let board = emptyBoard();

	// 生成初始两枚方块（与客户端 boot 一致）
	for (let i = 0; i < 2; i++) {
		const r = addRandomTile(board, rng);
		board = r.board;
	}

	let score = 0;

	for (const dir of moves) {
		const result = doMove(board, dir);
		if (!result.moved) continue;
		score += result.gained;
		const addResult = addRandomTile(result.board, rng);
		board = addResult.board;
	}

	let maxTile = 0;
	for (const row of board) {
		for (const tile of row) {
			if (tile && tile.value > maxTile) maxTile = tile.value;
		}
	}

	return { score, maxTile, valid: true };
}

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
