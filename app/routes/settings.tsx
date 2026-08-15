import { useEffect, useState } from "react";
import type { Route } from "./+types/settings";
import { NavMenu } from "../components/NavMenu";

export function meta({}: Route.MetaArgs) {
	return [{ title: "设置 | 逐乐" }];
}

type Lang = "zh" | "en";

export default function Settings() {
	const [lang, setLang] = useState<Lang>("zh");

	// 初始化语言：优先读取 localStorage
	useEffect(() => {
		const stored = localStorage.getItem("lang");
		if (stored === "zh" || stored === "en") setLang(stored);
	}, []);

	// 同步语言到 <html lang> 并持久化
	useEffect(() => {
		document.documentElement.lang = lang;
		localStorage.setItem("lang", lang);
	}, [lang]);

	return (
		<div className="flex min-h-screen flex-col bg-cream text-gray-900 dark:bg-gray-950 dark:text-gray-100">
			<NavMenu />
			<main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
				<header className="text-center">
					<h1 className="text-4xl font-semibold tracking-tight">设置</h1>
					<p className="mt-2 text-sm tracking-[0.3em] text-gray-400 dark:text-gray-500">
						SETTINGS
					</p>
				</header>

				<div className="mt-10">
					<section className="rounded-2xl border border-gray-200 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/70">
						{/* 语言设置项 */}
						<div className="flex items-center justify-between gap-4">
							<p className="text-sm font-medium text-gray-800 dark:text-gray-100">
								语言 · Language
							</p>
							<div className="flex shrink-0 rounded-lg border border-gray-200 bg-white p-0.5 dark:border-gray-700 dark:bg-gray-800">
								<button
									type="button"
									onClick={() => setLang("zh")}
									className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
										lang === "zh"
											? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
											: "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
									}`}
								>
									中文
								</button>
								<button
									type="button"
									onClick={() => setLang("en")}
									className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
										lang === "en"
											? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
											: "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
									}`}
								>
									English
								</button>
							</div>
						</div>
					</section>
				</div>
			</main>
		</div>
	);
}
