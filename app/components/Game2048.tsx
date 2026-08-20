import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useI18n } from "../lib/i18n";
import {
	mulberry32,
	emptyBoard,
	addRandomTile,
	doMove,
	movesAvailable,
	resetUid,
	SIZE,
	type Dir,
	type Board,
	type Tile,
} from "../lib/game-engine";

type State = {
	board: Board;
	score: number;
	over: boolean;
	won: boolean;
	merged: number[];
	added: number[];
	moveDist: number;
	seed: number;
	moves: Dir[];
};

type Action =
	| { type: "move"; dir: Dir }
	| { type: "restart" }
	| { type: "boot" };

let gameRng: () => number = Math.random;

function initialTiles(): State {
	const seed = Date.now();
	gameRng = mulberry32(seed);
	resetUid();
	let board = emptyBoard();
	const added: number[] = [];
	for (let i = 0; i < 2; i++) {
		const r = addRandomTile(board, gameRng);
		board = r.board;
		added.push(r.addedId);
	}
	return { board, score: 0, over: false, won: false, merged: [], added, moveDist: 0, seed, moves: [] };
}

/** SSR 空棋盘 */
function initState(): State {
	return {
		board: emptyBoard(),
		score: 0,
		over: false,
		won: false,
		merged: [],
		added: [],
		moveDist: 0,
		seed: 0,
		moves: [],
	};
}

function reducer(state: State, action: Action): State {
	if (action.type === "restart" || action.type === "boot") return initialTiles();

	const before = new Map<number, { x: number; y: number }>();
	for (const row of state.board) {
		for (const tile of row) {
			if (tile) before.set(tile.id, { x: tile.x, y: tile.y });
		}
	}

	const result = doMove(state.board, action.dir);
	if (!result.moved) return state;

	let maxDist = 0;
	for (const row of result.board) {
		for (const tile of row) {
			if (!tile) continue;
			const prev = before.get(tile.id);
			if (prev) {
				const dist = Math.abs(tile.x - prev.x) + Math.abs(tile.y - prev.y);
				if (dist > maxDist) maxDist = dist;
			}
		}
	}

	const { board, addedId } = addRandomTile(result.board, gameRng);
	return {
		board,
		score: state.score + result.gained,
		over: !movesAvailable(board),
		won: state.won || board.some((row) => row.some((t) => t?.value === 2048)),
		merged: result.mergedIds,
		added: [addedId],
		moveDist: maxDist,
		seed: state.seed,
		moves: [...state.moves, action.dir],
	};
}

const TILE_CLASSES: Record<number, string> = {
	0: "bg-[#cdc1b4] dark:bg-[#1a1a2e]",
	2: "bg-[#eee4da] text-[#776e65] dark:bg-[#3d3d56] dark:text-[#d8d0c0]",
	4: "bg-[#ede0c8] text-[#776e65] dark:bg-[#4d4d64] dark:text-[#d8d0c0]",
	8: "bg-[#f2b179] text-[#f9f6f2] dark:bg-[#5d4a70] dark:text-[#f0e8d8]",
	16: "bg-[#f59563] text-[#f9f6f2] dark:bg-[#6e4a70] dark:text-[#f5ece0]",
	32: "bg-[#f67c5f] text-[#f9f6f2] dark:bg-[#804a68] dark:text-[#f8f0e8]",
	64: "bg-[#f65e3b] text-[#f9f6f2] dark:bg-[#984858] dark:text-white",
	128: "bg-[#edcf72] text-[#f9f6f2] dark:bg-[#b07838] dark:text-white",
	256: "bg-[#edcc61] text-[#f9f6f2] dark:bg-[#c88830] dark:text-white",
	512: "bg-[#edc850] text-[#f9f6f2] dark:bg-[#e09828] dark:text-white",
	1024: "bg-[#edc53f] text-[#f9f6f2] dark:bg-[#eba820] dark:text-white",
	2048: "bg-[#edc22e] text-[#f9f6f2] dark:bg-[#f0b810] dark:text-white",
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
	const [submitted, setSubmitted] = useState(false);
	const [highScore, setHighScore] = useState<number>(0);

	// 挂载后：从 localStorage 读最高分，尝试同步未提交的记录，从服务器取更大值
	useEffect(() => {
		dispatch({ type: "boot" });
		try {
			const saved = localStorage.getItem("game2048_best");
			if (saved) setHighScore(Number(saved) || 0);
		} catch {}

		// 尝试同步未提交的游戏记录（未登录时保存的）
		try {
			const pending = localStorage.getItem("game2048_pending");
			if (pending) {
				const record = JSON.parse(pending) as { score: number; seed: number; moves: string[]; elapsed: number };
				fetch("/api/game", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(record),
				}).then(r => r.json()).then((data: { success?: boolean }) => {
					if (data.success) {
						localStorage.removeItem("game2048_pending");
					}
				}).catch(() => {});
			}
		} catch {}

		// 登录用户尝试从服务器获取最高分（取更大值）
		fetch("/api/game").then(r => r.json()).then((data: { myBest?: number | null }) => {
			if (data.myBest != null) {
				setHighScore(prev => {
					const best = Math.max(prev, data.myBest!);
					try { localStorage.setItem("game2048_best", String(best)); } catch {}
					return best;
				});
			}
		}).catch(() => {});
	}, []);

	// 实时更新最高分
	useEffect(() => {
		if (state.score > highScore) {
			setHighScore(state.score);
			try { localStorage.setItem("game2048_best", String(state.score)); } catch {}
		}
	}, [state.score]);

	// 计时：每秒 +1（游戏结束 / 通关后暂停）
	useEffect(() => {
		if (state.over || state.won) return;
		const t = window.setInterval(() => setElapsed((s) => s + 1), 1000);
		return () => window.clearInterval(t);
	}, [state.over, state.won]);

	// 游戏结束时：保存完整记录到 localStorage，已登录则同时提交服务器
	useEffect(() => {
		if (!state.over || submitted || state.moves.length === 0) return;
		setSubmitted(true);

		const record = { score: state.score, seed: state.seed, moves: state.moves, elapsed };

		// 保存完整记录到 localStorage（供未登录用户后续同步）
		try { localStorage.setItem("game2048_pending", JSON.stringify(record)); } catch {}

		// 尝试提交到服务器（未登录会 401，不影响本地保存）
		fetch("/api/game", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(record),
		}).then(r => r.json()).then((data: { success?: boolean }) => {
			if (data.success) {
				localStorage.removeItem("game2048_pending");
			}
		}).catch(() => {});
	}, [state.over, submitted, state.seed, state.moves, state.score, elapsed]);

	const restart = () => {
		dispatch({ type: "restart" });
		setElapsed(0);
		setSubmitted(false);
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
			{/* 顶部：分数 + 时间 + 状态灯 + 重新开始 */}
			<div className="flex items-center justify-between gap-3">
				<div className="flex gap-3">
					<div className="rounded-xl border border-gray-200 bg-white/70 px-4 py-2 dark:border-gray-800 dark:bg-gray-900/70">
						<p className="text-xl font-semibold tabular-nums">{state.score}</p>
					</div>
					{highScore > 0 && (
						<div className="rounded-xl border border-gray-200 bg-white/70 px-4 py-2 dark:border-gray-800 dark:bg-gray-900/70">
							<p className="text-xl font-semibold tabular-nums">{highScore}</p>
						</div>
					)}
					<div className="rounded-xl border border-gray-200 bg-white/70 px-4 py-2 dark:border-gray-800 dark:bg-gray-900/70">
						<p className="text-xl font-semibold tabular-nums">
							{mm}:{ss}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-3">
					<span
						className={`h-3 w-3 rounded-full ${state.over ? "bg-red-500" : state.won ? "bg-yellow-400" : "bg-green-500"}`}
						title={state.over ? t("game.over") : state.won ? t("game.won") : t("game.controls")}
					/>
					<button
						type="button"
						onClick={restart}
						className="rounded-lg bg-gray-900 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
					>
						{t("game.restart")}
					</button>
				</div>
			</div>

			{/* 棋盘（固定尺寸 + transform 定位，原版方案） */}
			<div
				className="game2048-board relative mt-4 rounded-2xl bg-[#bbada0] p-3 shadow-sm dark:bg-[#1a1a2e] dark:shadow-none"
				style={{ "--move-dur": `${50 + state.moveDist * 15}ms` } as React.CSSProperties}
				onTouchStart={onTouchStart}
				onTouchEnd={onTouchEnd}
			>
				{/* 16 个空格（洞）：比外框浅，形成 # 字网格 */}
				{Array.from({ length: SIZE * SIZE }, (_, i) => (
					<div
						key={`cell-${i}`}
						className="game2048-tile rounded-xl bg-[#cdc1b4] dark:bg-[#2d2d44]"
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
									className={`flex h-full w-full items-center justify-center rounded-xl font-bold ${TILE_CLASSES[tile.value] ?? "bg-[#edc22e] text-[#f9f6f2] dark:bg-[#f0b810] dark:text-white"} ${tileTextSize(tile.value)} ${
										state.merged.includes(tile.id) ? "tile-merged" : ""
									} ${state.added.includes(tile.id) ? "tile-new" : ""}`}
								>
									{tile.value}
								</div>
							</div>
						) : null,
					),
				)}


			</div>

			<p className="mt-4 text-center text-xs text-gray-400 dark:text-gray-500">
				{t("game.controls")}
			</p>
		</div>
	);
}
