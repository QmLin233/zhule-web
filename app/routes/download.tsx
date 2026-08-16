import type { Route } from "./+types/download";
import { NavMenu } from "../components/NavMenu";

export function meta({}: Route.MetaArgs) {
	return [{ title: "下载 | 逐乐" }];
}

type FileItem = {
	id: string;
	name: string;
	size: number;
	uploadedAt: string;
	downloads: number;
};

// 示例数据（后端 R2 接入后由真实数据替换）
const FILES: FileItem[] = [
	{ id: "1", name: "示例游戏.apk", size: 152 * 1024 * 1024, uploadedAt: "2026-08-10", downloads: 128 },
	{ id: "2", name: "便携工具合集.zip", size: 48 * 1024 * 1024, uploadedAt: "2026-08-12", downloads: 56 },
	{ id: "3", name: "配置文件.txt", size: 2048, uploadedAt: "2026-08-14", downloads: 23 },
];

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fileExt(name: string): string {
	const i = name.lastIndexOf(".");
	return i >= 0 ? name.slice(i + 1).toUpperCase() : "FILE";
}

function extColor(ext: string): string {
	const map: Record<string, string> = {
		APK: "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300",
		IPA: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300",
		ZIP: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300",
		RAR: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300",
		"7Z": "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300",
		EXE: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300",
		PDF: "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300",
	};
	return map[ext] ?? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
}

export default function Download() {
	return (
		<div className="flex min-h-screen flex-col bg-cream text-gray-900 dark:bg-gray-950 dark:text-gray-100">
			<NavMenu />
			<main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
				<header className="text-center">
					<h1 className="text-4xl font-semibold tracking-tight">下载</h1>
					<p className="mt-2 text-sm tracking-[0.3em] text-gray-400 dark:text-gray-500">
						DOWNLOADS
					</p>
				</header>

				{/* 文件列表 */}
				<section className="mt-10">
					<div className="flex items-center justify-between">
						<h2 className="text-lg font-medium tracking-tight">
							全部文件{" "}
							<span className="ml-1 text-sm font-normal text-gray-400 dark:text-gray-500">
								Files
							</span>
						</h2>
						<span className="text-xs text-gray-400 dark:text-gray-500">
							{FILES.length} 个 · items
						</span>
					</div>

					<div className="mt-3 space-y-2">
						{FILES.map((f) => (
							<div
								key={f.id}
								className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white/70 p-4 dark:border-gray-800 dark:bg-gray-900/70"
							>
								<div
									className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${extColor(
										fileExt(f.name),
									)}`}
								>
									{fileExt(f.name)}
								</div>
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-medium">{f.name}</p>
									<p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
										{formatSize(f.size)} · {f.uploadedAt} · 下载 {f.downloads} 次
									</p>
								</div>
								<button
									type="button"
									className="shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
								>
									下载 · Download
								</button>
							</div>
						))}
					</div>
				</section>

				<p className="mt-8 text-center text-xs text-gray-400 dark:text-gray-500">
					数据与下载待接入后端（R2）· Backend (R2) integration pending
				</p>
			</main>
		</div>
	);
}
