import { NavMenu } from "./NavMenu";
import { useI18n } from "../lib/i18n";

/**
 * 首页内容：全屏居中大标题 + 底部联系方式。
 */
export function HomeHero() {
	const { t } = useI18n();

	return (
		<div className="flex min-h-screen flex-col bg-cream text-gray-900 dark:bg-gray-950 dark:text-gray-100">
			<NavMenu />

			{/* 主体：居中大标题 */}
			<main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
				<h1 className="text-6xl font-semibold tracking-tight sm:text-7xl md:text-8xl">
					逐乐
				</h1>
				<p className="mt-6 text-lg tracking-[0.3em] text-gray-400 dark:text-gray-500">
					{t("app.subtitle")}
				</p>
			</main>

			{/* 底部信息 */}
			<footer className="px-4 pb-8 text-center text-sm text-gray-400 dark:text-gray-500">
				<p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
					<span>{t("contact.qqGroup")}: 1090099236</span>
					<span className="text-gray-300 dark:text-gray-700">|</span>
					<span>{t("contact.email")}: qmlin233@qq.com</span>
				</p>
			</footer>
		</div>
	);
}
