import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useI18n } from "../lib/i18n";

const SIZE = 4;
type Dir = "left" | "right" | "up" | "down";

/** 每个方块带唯一 id 与坐标（参考原版 gabrielecirulli/2048 的 Tile） */
type Tile = {
	id: number;
	x: number;
	y: number;
	value: number;
};
type Board = (Tile | null)[][];

type State = {
	board: Board;
	score: number;
	over: boolean;
	won: boolean;
	/** 本轮合并产生的方块 id（播放 pop 动画） */
	merged: number[];
	/** 本轮新出现的方块 id（播放 appear 动画） */
	added: number[];
	/** 本次移动的最大位移（格数），用于按距离自适应过渡时长 */
	moveDist: number;
};

type Action =
	| { type: "move"; dir: Dir }
	| { type: "restart" }
	| { type: "boot" };

let uid = 1;
const nextId = () => uid++;

/** 四个方向的移动向量 */
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

/** 随机取一个空格 */
function randomAvailableCell(board: Board): { x: number; y: number } | null {
	const empty: Array<{ x: number; y: number }> = [];
	board.forEach((row, y) =>
		row.forEach((tile, x) => {
			if (!tile) empty.push({ x, y });
		}),
	);
	return empty.length ? empty[Math.floor(Math.random() * empty.length)] : null;
}

/** 在随机空格生成 2（90%）或 4（10%），返回新棋盘与新增方块 id */
function addRandomTile(board: Board): { board: Board; addedId: number } {
	const cell = randomAvailableCell(board);
	if (!cell) return { board, addedId: 0 };
	const id = nextId();
	const next = cloneBoard(board);
	next[cell.y][cell.x] = { id, x: cell.x, y: cell.y, value: Math.random() < 0.9 ? 2 : 4 };
	return { board: next, addedId: id };
}

/** 构建遍历顺序：从移动方向的最远处开始（原版 buildTraversals） */
function buildTraversals(vector: { x: number; y: number }): { x: number[]; y: number[] } {
	const xs = [0, 1, 2, 3];
	const ys = [0, 1, 2, 3];
	if (vector.x === 1) xs.reverse();
	if (vector.y === 1) ys.reverse();
	return { x: xs, y: ys };
}

/** 从 cell 沿向量找到最远可达位置（原版 findFarthestPosition） */
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

/** 按方向移动棋盘（参考原版 GameManager.move 的向量法） */
function move(
	board: Board,
	dir: Dir,
): {
	board: Board;
	moved: boolean;
	gained: number;
	merged: number[];
	maxDist: number;
} {
	const vector = VECTOR[dir];
	const traversals = buildTraversals(vector);
	const next = cloneBoard(board);
	let moved = false;
	let gained = 0;
	let maxDist = 0;
	const merged: number[] = [];

	traversals.x.forEach((x) => {
		traversals.y.forEach((y) => {
			const cell = { x, y };
			const tile = next[y][x];
			if (!tile) return;

			const { farthest, next: target } = findFarthestPosition(next, cell, vector);
			const other = withinBounds(target) ? next[target.y][target.x] : null;
			let landed = farthest;

			// 可与目标格合并（同值且该目标本轮尚未被合并过）
			if (other && other.value === tile.value && !merged.includes(other.id)) {
				next[y][x] = null;
				next[target.y][target.x] = {
					id: tile.id,
					x: target.x,
					y: target.y,
					value: tile.value * 2,
				};
				merged.push(tile.id);
				gained += tile.value * 2;
				landed = target;
			} else {
				// 滑到最远位置
				next[y][x] = null;
				next[farthest.y][farthest.x] = { ...tile, x: farthest.x, y: farthest.y };
			}

			// 记录本次位移（格数），长距离用更久过渡避免“飞/坠”感
			const dist = Math.abs(landed.x - cell.x) + Math.abs(landed.y - cell.y);
			if (dist > maxDist) maxDist = dist;
			if (landed.x !== cell.x || landed.y !== cell.y) moved = true;
		});
	});

	return { board: next, moved, gained, merged, maxDist };
}

/** 是否还有可移动 / 可合并的格子 */
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

/** 生成初始两枚随机方块（仅在客户端调用，避免 SSR 水合不一致） */
function initialTiles(): State {
	let board = emptyBoard();
	const added: number[] = [];
	for (let i = 0; i < 2; i++) {
		const r = addRandomTile(board);
		board = r.board;
		added.push(r.addedId);
	}
	return { board, score: 0, over: false, won: false, merged: [], added, moveDist: 0 };
}

/** SSR 与客户端首帧共用确定性空棋盘；随机方块在挂载后由 boot 生成 */
function initState(): State {
	return {
		board: emptyBoard(),
		score: 0,
		over: false,
		won: false,
		merged: [],
		added: [],
		moveDist: 0,
	};
}

function reducer(state: State, action: Action): State {
	if (action.type === "restart" || action.type === "boot") return initialTiles();

	const { board: movedBoard, moved: didMove, gained, merged, maxDist } = move(
		state.board,
		action.dir,
	);
	if (!didMove) return state;

	const { board, addedId } = addRandomTile(movedBoard);
	return {
		board,
		score: state.score + gained,
		over: !movesAvailable(board),
		won: state.won || board.some((row) => row.some((t) => t?.value === 2048)),
		merged,
		added: [addedId],
		moveDist: maxDist,
	};
}

const TILE_CLASSES: Record<number, string> = {
	0: "bg-[#e8ddca] dark:bg-gray-800",
	2: "bg-amber-100 text-amber-800 dark:bg-amber-800/80 dark:text-amber-100",
	4: "bg-amber-200 text-amber-800 dark:bg-amber-700 dark:text-amber-100",
	8: "bg-orange-300 text-white dark:bg-orange-700 dark:text-orange-100",
	16: "bg-orange-400 text-white dark:bg-orange-600 dark:text-white",
	32: "bg-red-400 text-white dark:bg-red-800 dark:text-red-100",
	64: "bg-red-500 text-white dark:bg-red-700 dark:text-red-100",
	128: "bg-yellow-400 text-amber-900 dark:bg-yellow-600 dark:text-yellow-100",
	256: "bg-yellow-500 text-white dark:bg-yellow-700 dark:text-yellow-100",
	512: "bg-yellow-500 text-white dark:bg-yellow-700 dark:text-yellow-100",
	1024: "bg-yellow-600 text-white dark:bg-yellow-700 dark:text-white",
	2048: "bg-amber-600 text-white dark:bg-amber-500 dark:text-white",
};

function tileTextSize(v: number): string {
	if (v >= 1024) return "text-lg sm:text-xl";
	if (v >= 128) return "text-2xl sm:text-3xl";
	return "text-3xl sm:text-4xl";
}

export function Game2048() {
	const [state, dispatch] = useReducer(reducer, undefined, initState);
	const [elapsed, setElapsed] = useState(0);
	const touchStart = useRef<{ x: number; y: number } | null>(null);
	const { t } = useI18n();

	// 挂载后生成初始方块（首帧为空棋盘，SSR/客户端一致，避免水合警告）
	useEffect(() => {
		dispatch({ type: "boot" });
	}, []);

	// 计时：每秒 +1（游戏结束 / 通关后暂停）
	useEffect(() => {
		if (state.over || state.won) return;
		const t = window.setInterval(() => setElapsed((s) => s + 1), 1000);
		return () => window.clearInterval(t);
	}, [state.over, state.won]);

	const restart = () => {
		dispatch({ type: "restart" });
		setElapsed(0);
	};

	// 键盘操作：方向键 / WASD
	useEffect(() => {
		const map: Record<string, Dir> = {
			ArrowLeft: "left",
			ArrowRight: "right",
			ArrowUp: "up",
			ArrowDown: "down",
			a: "left",
			d: "right",
			w: "up",
			s: "down",
		};
		const onKey = (e: KeyboardEvent) => {
			const dir = map[e.key];
			if (dir) {
				e.preventDefault();
				dispatch({ type: "move", dir });
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	// 触屏滑动
	const onTouchStart = useCallback((e: React.TouchEvent) => {
		const t = e.touches[0];
		touchStart.current = { x: t.clientX, y: t.clientY };
	}, []);

	const onTouchEnd = useCallback((e: React.TouchEvent) => {
		const start = touchStart.current;
		if (!start) return;
		const t = e.changedTouches[0];
		const dx = t.clientX - start.x;
		const dy = t.clientY - start.y;
		const threshold = 24;
		touchStart.current = null;
		if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
		if (Math.abs(dx) > Math.abs(dy)) {
			dispatch({ type: "move", dir: dx > 0 ? "right" : "left" });
		} else {
			dispatch({ type: "move", dir: dy > 0 ? "down" : "up" });
		}
	}, []);

	const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
	const ss = String(elapsed % 60).padStart(2, "0");

	return (
		<div className="mx-auto mt-10 w-fit select-none">
			{/* 顶部：分数 + 时间 + 重新开始 */}
			<div className="flex items-center justify-between gap-3">
				<div className="flex gap-3">
					<div className="rounded-xl border border-gray-200 bg-white/70 px-4 py-2 dark:border-gray-800 dark:bg-gray-900/70">
						<p className="text-xl font-semibold tabular-nums">{state.score}</p>
					</div>
					<div className="rounded-xl border border-gray-200 bg-white/70 px-4 py-2 dark:border-gray-800 dark:bg-gray-900/70">
						<p className="text-xl font-semibold tabular-nums">
							{mm}:{ss}
						</p>
					</div>
				</div>
				<button
					type="button"
					onClick={restart}
					className="rounded-lg bg-gray-900 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
				>
					{t("game.restart")}
				</button>
			</div>

			{/* 棋盘（固定尺寸 + transform 定位，原版方案） */}
			<div
				className="game2048-board relative mt-4 rounded-2xl bg-[#bfb5a8] p-3 shadow-sm dark:bg-gray-900 dark:shadow-none"
				style={{ "--move-dur": `${100 + state.moveDist * 30}ms` } as React.CSSProperties}
				onTouchStart={onTouchStart}
				onTouchEnd={onTouchEnd}
			>
				{/* 16 个空格（洞）：比外框浅，形成 # 字网格 */}
				{Array.from({ length: SIZE * SIZE }, (_, i) => (
					<div
						key={`cell-${i}`}
						className="game2048-tile rounded-xl bg-[#ddd7d0] dark:bg-gray-800"
						style={
							{ "--x": i % SIZE, "--y": Math.floor(i / SIZE) } as React.CSSProperties
						}
					/>
				))}
				{state.board.map((row, y) =>
					row.map((tile, x) =>
						tile ? (
							// 外层：负责移动（transform transition，原版方案）
							<div
								key={tile.id}
								className="game2048-tile"
								style={{ "--x": x, "--y": y } as React.CSSProperties}
							>
								{/* 内层 tile-inner：负责 appear / pop 动画（与移动分离） */}
								<div
									className={`flex h-full w-full items-center justify-center rounded-xl font-bold ${TILE_CLASSES[tile.value] ?? TILE_CLASSES[0]} ${tileTextSize(tile.value)} ${
										state.merged.includes(tile.id) ? "tile-merged" : ""
									} ${state.added.includes(tile.id) ? "tile-new" : ""}`}
								>
									{tile.value}
								</div>
							</div>
						) : null,
					),
				)}

				{(state.over || state.won) && (
					<div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-black/40 text-white backdrop-blur-sm">
						<p className="text-3xl font-semibold">
							{state.won ? t("game.won") + " 🎉" : t("game.over")}
						</p>
						<p className="mt-2 text-sm text-white/70">
							{state.won ? t("game.won") : `${t("game.score")} ${state.score} · ${mm}:${ss}`}
						</p>
						<button
							type="button"
							onClick={restart}
							className="mt-4 rounded-lg bg-white px-5 py-2 text-center text-sm font-medium text-gray-900 transition-colors hover:bg-gray-200"
						>
							{t("game.restart")}
						</button>
					</div>
				)}
			</div>

			<p className="mt-4 text-center text-xs text-gray-400 dark:text-gray-500">
				{t("game.controls")}
			</p>
		</div>
	);
}
