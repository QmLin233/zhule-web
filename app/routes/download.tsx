import type { Route } from "./+types/download";
import { NavMenu } from "../components/NavMenu";

export function meta({}: Route.MetaArgs) {
	return [{ title: "下载 | 逐乐" }];
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

				<div className="mt-10 rounded-2xl border border-gray-200 bg-white/70 p-10 text-center text-sm text-gray-400 dark:border-gray-800 dark:bg-gray-900/70 dark:text-gray-500">
					暂无文件 · No files yet
				</div>
			</main>
		</div>
	);
}
