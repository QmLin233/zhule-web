import { useState, useEffect } from "react";
import { useSearchParams } from "react-router";
import type { Route } from "./+types/settings";
import { PageLayout } from "../components/PageLayout";
import { pageMeta } from "../lib/meta";
import { useI18n } from "../lib/i18n";

export function meta({}: Route.MetaArgs) {
	return pageMeta("设置");
}

interface UserProfile {
	id: string;
	email: string;
	nickname: string;
	verified: number;
	created_at: string;
}

export default function Settings() {
	const { lang, setLang, t } = useI18n();
	const [searchParams] = useSearchParams();
	const [user, setUser] = useState<UserProfile | null>(null);
	const [userLoading, setUserLoading] = useState(true);
	const [authError, setAuthError] = useState<string | null>(null);

	// 读取 URL 中的错误参数（GitHub 登录失败回跳）
	useEffect(() => {
		const urlError = searchParams.get("error");
		if (urlError) {
			const msg = t(`user.errors.${urlError}`) || urlError;
			setAuthError(msg);
			// 清除 URL 参数，避免刷新重复显示
			window.history.replaceState(null, "", "/settings");
		}
	}, [searchParams, t]);

	// 检查登录状态
	useEffect(() => {
		(async () => {
			try {
				const res = await fetch("/api/user");
				const data = await res.json() as { success: boolean; user?: UserProfile };
				if (data.success && data.user) setUser(data.user);
			} catch { /* 忽略 */ }
			setUserLoading(false);
		})();
	}, []);

	// 登出
	const handleLogout = async () => {
		try { await fetch("/api/user", { method: "DELETE" }); } catch { /* 忽略 */ }
		setUser(null);
	};

	return (
		<PageLayout title={t("settings.title")}>
			<div className="mt-10 space-y-6">
				{/* 语言设置 */}
				<section className="rounded-2xl border border-gray-200 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/70">
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

				{/* 用户账号 */}
				<section className="rounded-2xl border border-gray-200 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/70">
					<p className="mb-4 text-sm font-medium text-gray-800 dark:text-gray-100">
						{t("user.account")}
					</p>

					{userLoading ? (
						<div className="flex items-center justify-center py-6">
							<div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-500 dark:border-gray-600 dark:border-t-gray-300" />
						</div>
					) : user ? (
						/* 已登录：显示用户信息 */
						<div className="space-y-4">
							<div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-gray-800/40">
								<p className="text-lg font-medium text-gray-900 dark:text-gray-100">
									{t("user.welcome")}，{user.nickname || user.email}
								</p>
								<p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
									{user.email}
								</p>
							</div>
							<button
								onClick={handleLogout}
								className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
							>
								{t("user.logout")}
							</button>
						</div>
					) : (
						/* 未登录：仅 GitHub 登录 */
						<div className="space-y-3">
							{authError && (
								<p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
									{authError}
								</p>
							)}
							<a
								href="/api/auth/github"
								className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
							>
								<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
									<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
								</svg>
								{t("user.loginWithGithub")}
							</a>
						</div>
					)}
				</section>
			</div>
		</PageLayout>
	);
}
