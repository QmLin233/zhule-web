import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useI18n } from "../lib/i18n";

const menuItems = [
	{ to: "/download", labelKey: "nav.download" },
	{ to: "/game", labelKey: "nav.game" },
	{ to: "/image-host", labelKey: "nav.imageHost" },
	{ to: "/rules", labelKey: "nav.rules" },
	{ to: "/more", labelKey: "nav.more" },
	{ to: "/settings", labelKey: "nav.settings" },
];

export function NavMenu() {
	const [open, setOpen] = useState(false);
	const [dark, setDark] = useState(false);
	const { t } = useI18n();

	// 初始化主题：优先读取 localStorage，其次跟随系统偏好
	useEffect(() => {
		let stored: string | null = null;
		try {
			stored = localStorage.getItem("theme");
		} catch {
			// 浏览器禁用存储时忽略（如阻止 Cookie）
		}
		const prefersDark = window.matchMedia(
			"(prefers-color-scheme: dark)",
		).matches;
		setDark(stored ? stored === "dark" : prefersDark);
	}, []);

	// 同步主题到 <html> 并持久化
	useEffect(() => {
		document.documentElement.classList.toggle("dark", dark);
		try {
			localStorage.setItem("theme", dark ? "dark" : "light");
		} catch {
			// 浏览器禁用存储时忽略
		}
	}, [dark]);

	const toggleTheme = () => setDark((v) => !v);

	return (
		<header className="sticky top-0 z-50">
			<nav className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-6 py-1.5">
				{/* 回到主页（双圆圈 logo） */}
				<Link
					to="/"
					aria-label={t("nav.home")}
					className="relative flex h-9 w-9 items-center justify-center text-gray-900 transition-opacity hover:opacity-70 dark:text-gray-100"
				>
					<svg
						width="36"
						height="36"
						viewBox="0 0 100 100"
						fill="none"
						aria-hidden="true"
					>
						<circle
							cx="50"
							cy="50"
							r="34"
							stroke="currentColor"
							strokeWidth="5"
						/>
						<circle
							cx="50"
							cy="50"
							r="21"
							stroke="currentColor"
							strokeWidth="5"
						/>
					</svg>
				</Link>

				{/* 右上角：汉堡按钮 + 下拉菜单 + 主题切换 */}
				<div className="flex flex-col items-end gap-1.5">
					<div className="relative">
					<button
						type="button"
						onClick={() => setOpen((v) => !v)}
						className="flex h-9 w-9 items-center justify-center rounded-md text-gray-900 transition-colors hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
						aria-label={t("nav.menu")}
						aria-expanded={open}
					>
						{/* 三横杠图标 */}
						<svg
							width="20"
							height="20"
							viewBox="0 0 20 20"
							fill="none"
							aria-hidden="true"
						>
							<path
								d="M2 5h16M2 10h16M2 15h16"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
							/>
						</svg>
					</button>

					{/* 下拉菜单（与按钮右对齐） */}
					{open && (
						<>
							{/* 半透明遮罩：点击外部关闭 */}
							<div
								className="fixed inset-0 z-40 bg-black/5"
								onClick={() => setOpen(false)}
							/>
							<div className="absolute right-0 top-10 z-50 w-44 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
								{menuItems.map((item) => (
									<Link
										key={item.to}
										to={item.to}
										onClick={() => setOpen(false)}
										className="flex items-baseline justify-between px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
									>
										<span>{t(item.labelKey)}</span>
									</Link>
								))}
							</div>
						</>
					)}
					</div>

					{/* 主题切换按钮（汉堡按钮下方）：白天=太阳，夜间=月亮 */}
					<button
						type="button"
						onClick={toggleTheme}
						aria-label={dark ? t("nav.switchToLight") : t("nav.switchToDark")}
						className="flex h-9 w-9 items-center justify-center rounded-md text-gray-900 transition-colors hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
					>
						{dark ? (
							<>
								{/* 月亮图标（夜间） */}
								<svg
									width="20"
									height="20"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.8"
									strokeLinecap="round"
									strokeLinejoin="round"
									aria-hidden="true"
								>
									<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
								</svg>
							</>
						) : (
							<>
								{/* 太阳图标（白天） */}
								<svg
									width="20"
									height="20"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.8"
									strokeLinecap="round"
									strokeLinejoin="round"
									aria-hidden="true"
								>
									<circle cx="12" cy="12" r="4" />
									<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
								</svg>
							</>
						)}
					</button>
				</div>
			</nav>
		</header>
	);
}
