import { useState, useEffect, useCallback } from "react";
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
	const [mode, setMode] = useState<"login" | "register">("login");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPwd, setConfirmPwd] = useState("");
	const [nickname, setNickname] = useState("");
	const [authError, setAuthError] = useState<string | null>(null);
	const [authSuccess, setAuthSuccess] = useState<string | null>(null);
	const [verifyCode, setVerifyCode] = useState("");
	const [verifyError, setVerifyError] = useState<string | null>(null);
	const [codeSent, setCodeSent] = useState(false);
	const [regCodeSent, setRegCodeSent] = useState(false);
	const [regVerifyCode, setRegVerifyCode] = useState("");
	const [forgotMode, setForgotMode] = useState(false);
	const [newPassword, setNewPassword] = useState("");

	// 读取 URL 中的错误参数（GitHub 登录失败回跳）
	useEffect(() => {
		const urlError = searchParams.get("error");
		if (urlError) {
			const detail = searchParams.get("detail");
			const msg = detail
				? `${t(`user.errors.${urlError}`) || urlError}: ${detail}`
				: t(`user.errors.${urlError}`) || urlError;
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

	const resetForm = useCallback(() => {
		setEmail("");
		setPassword("");
		setConfirmPwd("");
		setNickname("");
		setAuthError(null);
		setAuthSuccess(null);
		setVerifyCode("");
		setVerifyError(null);
		setCodeSent(false);
		setRegCodeSent(false);
		setRegVerifyCode("");
		setForgotMode(false);
		setNewPassword("");
	}, []);

	// 注册（带验证码）
	const handleRegister = async (e: React.FormEvent) => {
		e.preventDefault();
		setAuthError(null);
		setAuthSuccess(null);
		if (password !== confirmPwd) {
			setAuthError(t("user.passwordMismatch"));
			return;
		}
		try {
			const res = await fetch("/api/user", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, password, nickname, verifyCode: regVerifyCode }),
			});
			const data = await res.json() as { success: boolean; error?: string };
			if (data.success) {
				setAuthSuccess(t("user.registerSuccess"));
				const me = await fetch("/api/user");
				const meData = await me.json() as { success: boolean; user?: UserProfile };
				if (meData.success && meData.user) setUser(meData.user);
				resetForm();
			} else {
				setAuthError(data.error);
			}
		} catch {
			setAuthError(t("admin.networkError"));
		}
	};

	// 发送注册验证码
	const handleRegSendCode = async () => {
		setAuthError(null);
		if (!email) { setAuthError(t("user.emailPlaceholder")); return; }
		try {
			const res = await fetch("/api/user", {
				method: "OPTIONS",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email }),
			});
			const data = await res.json() as { success: boolean; error?: string; message?: string };
			if (data.success) {
				setRegCodeSent(true);
				if (data.message) setAuthSuccess(data.message);
			} else {
				setAuthError(data.error);
			}
		} catch {
			setAuthError(t("admin.networkError"));
		}
	};

	// 忘记密码：发送验证码
	const handleForgotSendCode = async () => {
		setAuthError(null);
		setAuthSuccess(null);
		if (!email) { setAuthError(t("user.emailPlaceholder")); return; }
		try {
			const res = await fetch("/api/user", {
				method: "OPTIONS",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, action: "reset" }),
			});
			const data = await res.json() as { success: boolean; error?: string; message?: string };
			if (data.success) {
				setCodeSent(true);
				if (data.message) setAuthSuccess(data.message);
			} else {
				setAuthError(data.error);
			}
		} catch {
			setAuthError(t("admin.networkError"));
		}
	};

	// 忘记密码：重置密码
	const handleResetPassword = async (e: React.FormEvent) => {
		e.preventDefault();
		setAuthError(null);
		setAuthSuccess(null);
		if (newPassword.length < 6) { setAuthError(t("user.passwordPlaceholder")); return; }
		try {
			const res = await fetch("/api/user", {
				method: "HEAD",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, code: verifyCode, newPassword, action: "reset" }),
			});
			const data = await res.json() as { success: boolean; error?: string };
			if (data.success) {
				setAuthSuccess(t("user.passwordResetSuccess"));
				setTimeout(() => { setForgotMode(false); resetForm(); }, 1500);
			} else {
				setAuthError(data.error);
			}
		} catch {
			setAuthError(t("admin.networkError"));
		}
	};

	// 登录
	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setAuthError(null);
		setAuthSuccess(null);
		try {
			const res = await fetch("/api/user", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, password }),
			});
			const data = await res.json() as { success: boolean; error?: string; needVerify?: boolean };
			if (data.success) {
				setAuthSuccess(t("user.loginSuccess"));
				const me = await fetch("/api/user");
				const meData = await me.json() as { success: boolean; user?: UserProfile };
				if (meData.success && meData.user) setUser(meData.user);
				resetForm();
			} else if (data.needVerify) {
				// 未验证邮箱，切换到验证码模式
				setAuthError(data.error);
				setCodeSent(true);
			} else {
				setAuthError(data.error);
			}
		} catch {
			setAuthError(t("admin.networkError"));
		}
	};

	// 登出
	const handleLogout = async () => {
		try { await fetch("/api/user", { method: "DELETE" }); } catch { /* 忽略 */ }
		setUser(null);
		resetForm();
	};

	// 发送验证码
	const handleSendCode = async () => {
		setVerifyError(null);
		try {
			const res = await fetch("/api/user", {
				method: "OPTIONS",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: user?.email }),
			});
			const data = await res.json() as { success: boolean; error?: string; message?: string };
			if (data.success) {
				setCodeSent(true);
				setVerifyError(null);
				if (data.message) setAuthSuccess(data.message);
			} else {
				setVerifyError(data.error || data.message);
			}
		} catch {
			setVerifyError(t("admin.networkError"));
		}
	};

	// 验证邮箱
	const handleVerify = async () => {
		setVerifyError(null);
		try {
			const res = await fetch("/api/user", {
				method: "HEAD",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: user?.email, code: verifyCode }),
			});
			const data = await res.json() as { success: boolean; error?: string };
			if (data.success) {
				setUser(user ? { ...user, verified: 1 } : null);
				setVerifyCode("");
				setCodeSent(false);
			} else {
				setVerifyError(data.error);
			}
		} catch {
			setVerifyError(t("admin.networkError"));
		}
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
								<p className="mt-1 text-xs">
									{user.verified ? (
										<span className="text-green-600 dark:text-green-400">✓ {t("user.verified")}</span>
									) : (
										<span className="text-orange-500 dark:text-orange-400">⚠ {t("user.unverified")}</span>
									)}
								</p>
							</div>

							{/* 未验证邮箱时显示验证区 */}
							{!user.verified && (
								<div className="rounded-xl border border-orange-200 bg-orange-50/80 p-4 dark:border-orange-800 dark:bg-orange-950/40">
									<p className="mb-2 text-sm text-orange-700 dark:text-orange-300">
										{t("user.verifyHint")}
									</p>
									<div className="flex gap-2">
										<input
											type="text"
											value={verifyCode}
											onChange={(e) => setVerifyCode(e.target.value)}
											placeholder={t("user.verifyCode")}
											maxLength={6}
											className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
										/>
										<button
											onClick={handleSendCode}
											disabled={codeSent}
											className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
										>
											{codeSent ? "✓" : t("user.sendCode")}
										</button>
										<button
											onClick={handleVerify}
											className="shrink-0 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900"
										>
											{t("user.verifyEmail")}
										</button>
									</div>
									{verifyError && (
										<p className="mt-2 text-xs text-red-600 dark:text-red-400">{verifyError}</p>
									)}
								</div>
							)}
							<button
								onClick={handleLogout}
								className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
							>
								{t("user.logout")}
							</button>
						</div>
					) : (
						/* 未登录：登录/注册表单 */
						<div>
							{/* 切换标签 — 暂时隐藏，仅保留 GitHub 登录 */}
							<div className="mb-4 hidden rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
								<button
									type="button"
									onClick={() => { setMode("login"); resetForm(); }}
									className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors ${
										mode === "login"
											? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
											: "text-gray-500 dark:text-gray-400"
									}`}
								>
									{t("user.login")}
								</button>
								<button
									type="button"
									onClick={() => { setMode("register"); resetForm(); }}
									className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors ${
										mode === "register"
											? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
											: "text-gray-500 dark:text-gray-400"
									}`}
								>
									{t("user.register")}
								</button>
							</div>

							<form onSubmit={mode === "login" ? handleLogin : handleRegister} className="hidden space-y-3">
								<input
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder={t("user.emailPlaceholder")}
									className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
									required
								/>
								<input
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder={t("user.passwordPlaceholder")}
									className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
									minLength={6}
									required
								/>
								{mode === "register" && (
									<>
										<input
											type="password"
											value={confirmPwd}
											onChange={(e) => setConfirmPwd(e.target.value)}
											placeholder={t("user.confirmPassword")}
											className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
											minLength={6}
											required
										/>
										<input
											type="text"
											value={nickname}
											onChange={(e) => setNickname(e.target.value)}
											placeholder={t("user.nicknamePlaceholder")}
											className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
										/>									{/* 注册验证码 */}
									<div className="flex gap-2">
										<input
											type="text"
											value={regVerifyCode}
											onChange={(e) => setRegVerifyCode(e.target.value)}
											placeholder={t("user.verifyCode")}
											maxLength={6}
											className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
											required
										/>
										<button
											type="button"
											onClick={handleRegSendCode}
											disabled={regCodeSent}
											className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
										>
											{regCodeSent ? "✓" : t("user.sendCode")}
										</button>
									</div>									</>
								)}

								{authError && (
									<p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
										{authError}
									</p>
								)}
								{authSuccess && (
									<p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-600 dark:bg-green-950 dark:text-green-400">
										{authSuccess}
									</p>
								)}

								<button
									type="submit"
									className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
								>
									{mode === "login" ? t("user.login") : t("user.register")}
								</button>

								{mode === "login" && (
									<button
										type="button"
										onClick={() => { setForgotMode(true); setAuthError(null); setAuthSuccess(null); }}
										className="w-full text-center text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
									>
										{t("user.forgotPassword")}
									</button>
								)}
							</form>

							{/* GitHub 登录 */}
							<div className="mt-3 hidden items-center gap-3">
								<div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
								<span className="text-xs text-gray-400">OR</span>
								<div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
							</div>
							<a
								href="/api/auth/github"
								className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
							>
								<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
									<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
								</svg>
								{t("user.loginWithGithub")}
							</a>
						</div>
					)}

					{/* 忘记密码表单 */}
					{!user && !userLoading && forgotMode && (
						<form onSubmit={handleResetPassword} className="space-y-3">
							<p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
								{t("user.forgotHint")}
							</p>
							<input
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder={t("user.emailPlaceholder")}
								className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
								required
							/>
							<div className="flex gap-2">
								<input
									type="text"
									value={verifyCode}
									onChange={(e) => setVerifyCode(e.target.value)}
									placeholder={t("user.verifyCode")}
									maxLength={6}
									className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
									required
								/>
								<button
									type="button"
									onClick={handleForgotSendCode}
									disabled={codeSent}
									className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
								>
									{codeSent ? "✓" : t("user.sendCode")}
								</button>
							</div>
							<input
								type="password"
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
								placeholder={t("user.newPassword")}
								className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
								minLength={6}
								required
							/>
							{authError && (
								<p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
									{authError}
								</p>
							)}
							{authSuccess && (
								<p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-600 dark:bg-green-950 dark:text-green-400">
									{authSuccess}
								</p>
							)}
							<button
								type="submit"
								className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
							>
								{t("user.resetPassword")}
							</button>
							<button
								type="button"
								onClick={() => { setForgotMode(false); resetForm(); }}
								className="w-full text-center text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
							>
								← {t("user.backToLogin")}
							</button>
						</form>
					)}
				</section>
			</div>
		</PageLayout>
	);
}
