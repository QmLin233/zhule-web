/**
 * 2048 游戏核心引擎。
 * 前后端共用，保证回放一致性。
 */

// ============ 类型 ============

export type Dir = "left" | "right" | "up" | "down";
export type Tile = { id: number; x: number; y: number; value: number };
export type Board = (Tile | null)[][];

// ============ 常量 ============

export const SIZE = 4;

export const VECTOR: Record<Dir, { x: number; y: number }> = {
	up: { x: 0, y: -1 },
	right: { x: 1, y: 0 },
	down: { x: 0, y: 1 },
	left: { x: -1, y: 0 },
};

// ============ PRNG ============

/** Mulberry32 种子随机数生成器（确定性，前后端一致） */
export function mulberry32(seed: number): () => number {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// ============ 棋盘操作 ============

export function emptyBoard(): Board {
	return Array.from({ length: SIZE }, () => Array<Tile | null>(SIZE).fill(null));
}

export function cloneBoard(board: Board): Board {
	return board.map((row) => row.slice());
}

export function withinBounds(p: { x: number; y: number }): boolean {
	return p.x >= 0 && p.x < SIZE && p.y >= 0 && p.y < SIZE;
}

/** 随机取一个空格 */
export function randomAvailableCell(
	board: Board,
	rng: () => number,
): { x: number; y: number } | null {
	const empty: Array<{ x: number; y: number }> = [];
	board.forEach((row, y) =>
		row.forEach((tile, x) => {
			if (!tile) empty.push({ x, y });
		}),
	);
	return empty.length ? empty[Math.floor(rng() * empty.length)] : null;
}

/** 在随机空格生成 2（90%）或 4（10%） */
export function addRandomTile(
	board: Board,
	rng: () => number,
): { board: Board; addedId: number } {
	const cell = randomAvailableCell(board, rng);
	if (!cell) return { board, addedId: 0 };
	const id = nextId();
	const next = cloneBoard(board);
	next[cell.y][cell.x] = { id, x: cell.x, y: cell.y, value: rng() < 0.9 ? 2 : 4 };
	return { board: next, addedId: id };
}

// ============ 移动逻辑 ============

/** 构建遍历顺序：从移动方向的最远处开始 */
export function buildTraversals(vector: { x: number; y: number }): {
	x: number[];
	y: number[];
} {
	const xs = [0, 1, 2, 3];
	const ys = [0, 1, 2, 3];
	if (vector.x === 1) xs.reverse();
	if (vector.y === 1) ys.reverse();
	return { x: xs, y: ys };
}

/** 从 cell 沿向量找到最远可达位置 */
export function findFarthestPosition(
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

/** 核心移动逻辑：按方向移动棋盘，返回新棋盘、是否移动、得分、合并的方块 id */
export function doMove(
	board: Board,
	dir: Dir,
): { board: Board; moved: boolean; gained: number; mergedIds: number[] } {
	const vector = VECTOR[dir];
	const traversals = buildTraversals(vector);
	const next = cloneBoard(board);
	let moved = false;
	let gained = 0;
	const mergedIds: number[] = [];

	traversals.x.forEach((x) => {
		traversals.y.forEach((y) => {
			const tile = next[y][x];
			if (!tile) return;
			const { farthest, next: target } = findFarthestPosition(next, { x, y }, vector);
			const other = withinBounds(target) ? next[target.y][target.x] : null;
			let landed = farthest;

			if (other && other.value === tile.value && !mergedIds.includes(other.id)) {
				next[y][x] = null;
				next[target.y][target.x] = {
					id: tile.id,
					x: target.x,
					y: target.y,
					value: tile.value * 2,
				};
				mergedIds.push(tile.id);
				gained += tile.value * 2;
				landed = target;
			} else {
				next[y][x] = null;
				next[farthest.y][farthest.x] = { ...tile, x: farthest.x, y: farthest.y };
			}

			if (landed.x !== cell.x || landed.y !== cell.y) moved = true;
		});
	});

	return { board: next, moved, gained, mergedIds };
}

/** 判断是否还有可用移动 */
export function movesAvailable(board: Board): boolean {
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

// ============ 内部 ID 生成 ============

let uid = 1;
export function resetUid(): void {
	uid = 1;
}
function nextId(): number {
	return uid++;
}

// ============ 回放引擎 ============

/** 用种子+移动序列重建游戏，返回最终分数和最大方块 */
export function replayGame(
	seed: number,
	moves: Dir[],
): { score: number; maxTile: number; valid: boolean } {
	resetUid();
	const rng = mulberry32(seed);
	let board = emptyBoard();

	// 生成初始两枚方块
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
