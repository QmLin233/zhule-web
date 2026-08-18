import type { Route } from "./+types/settings";
import { PageLayout } from "../components/PageLayout";
import { pageMeta } from "../lib/meta";
import { useI18n } from "../lib/i18n";

export function meta({}: Route.MetaArgs) {
	return pageMeta("设置");
}

export default function Settings() {
	const { lang, setLang, t } = useI18n();

	return (
		<PageLayout title={t("settings.title")}>
			<div className="mt-10">
				<section className="rounded-2xl border border-gray-200 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/70">
						{/* 语言设置项 */}
						<div className="flex items-center justify-between gap-4">
							<p className="text-sm font-medium text-gray-800 dark:text-gray-100">
								{t("settings.language")}
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
