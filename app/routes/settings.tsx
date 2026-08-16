import { useEffect, useState } from "react";
import type { Route } from "./+types/settings";
import { PageLayout } from "../components/PageLayout";
import { pageMeta } from "../lib/meta";

export function meta({}: Route.MetaArgs) {
	return pageMeta("设置");
}

type Lang = "zh" | "en";

export default function Settings() {
	const [lang, setLang] = useState<Lang>("zh");

	// 初始化语言：优先读取 localStorage
	useEffect(() => {
		let stored: string | null = null;
		try {
			stored = localStorage.getItem("lang");
		} catch {
			// 浏览器禁用存储时忽略
		}
		if (stored === "zh" || stored === "en") setLang(stored);
	}, []);

	// 同步语言到 <html lang> 并持久化
	useEffect(() => {
		document.documentElement.lang = lang;
		try {
			localStorage.setItem("lang", lang);
		} catch {
			// 浏览器禁用存储时忽略
		}
	}, [lang]);

	return (
		<PageLayout title="设置">
			<div className="mt-10">
				<section className="rounded-2xl border border-gray-200 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/70">
						{/* 语言设置项 */}
						<div className="flex items-center justify-between gap-4">
							<p className="text-sm font-medium text-gray-800 dark:text-gray-100">
								语言
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
		</PageLayout>
	);
}
