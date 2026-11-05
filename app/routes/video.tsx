import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { Route } from "./+types/video";
import type { VideoInfo } from "../lib/video";
import { PageLayout } from "../components/PageLayout";
import { pageMeta } from "../lib/meta";
import { useI18n } from "../lib/i18n";
import { formatSize } from "../lib/format";

export function meta({}: Route.MetaArgs) {
	return pageMeta("视频解析");
}

/** 登录 Cookie 只保存在浏览器 localStorage，不上传服务端存储 */
const COOKIE_KEY = "zhule.bili.cookie";

interface ParseResponse {
	success: boolean;
	data?: VideoInfo;
	code?: string;
	error?: string;
}

interface MeResponse {
	success: boolean;
	data?: { loggedIn: boolean; uname?: string; face?: string };
}

function formatDuration(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${String(s).padStart(2, "0")}`;
}

/** 去掉文件名中的非法字符 */
function safeName(title: string): string {
	return title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80).trim();
}

/** 封面图有防盗链，统一走同源代理展示 */
function proxyImage(url: string): string {
	if (!url) return "";
	return `/api/video/download?url=${encodeURIComponent(url)}&type=image&inline=1`;
}

function readStoredCookie(): string {
	if (typeof window === "undefined") return "";
	try {
		return localStorage.getItem(COOKIE_KEY) ?? "";
	} catch {
		return "";
	}
}

export default function Video() {
	const { t } = useI18n();
	const [input, setInput] = useState("");
	const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
	const [info, setInfo] = useState<VideoInfo | null>(null);
	const [error, setError] = useState("");
	const [copied, setCopied] = useState(false);

	const [cookie, setCookie] = useState("");
	const [user, setUser] = useState<{ uname: string; face: string } | null>(null);
	const [loginOpen, setLoginOpen] = useState(false);
	const [notice, setNotice] = useState("");
	const [qr, setQr] = useState<{ url: string; key: string } | null>(null);
	const [qrStatus, setQrStatus] = useState<"loading" | "waiting" | "scanned" | "expired" | "error">(
		"loading",
	);
	const [secondsLeft, setSecondsLeft] = useState(0);
	// 是否仍在轮询扫码状态：二维码过期后保留一小段确认时间，避免手机已确认却判为失效
	const [polling, setPolling] = useState(false);
	const loginDone = useRef(false);

	const loadUser = useCallback(async (value: string) => {
		try {
			const res = await fetch("/api/bili/me", { headers: { "x-bili-cookie": value } });
			const data = (await res.json()) as MeResponse;
			if (data.success && data.data?.loggedIn) {
				setUser({ uname: data.data.uname ?? "", face: data.data.face ?? "" });
			}
		} catch {
			// 校验失败时保持未登录展示
		}
	}, []);

	// 初始化：读取浏览器里保存的登录态
	useEffect(() => {
		const stored = readStoredCookie();
		if (!stored) return;
		setCookie(stored);
		void loadUser(stored);
	}, [loadUser]);

	const saveLogin = useCallback(
		(value: string) => {
			try {
				localStorage.setItem(COOKIE_KEY, value);
			} catch {
				// 浏览器禁用存储时仅本次会话有效
			}
			setCookie(value);
			void loadUser(value);
		},
		[loadUser],
	);

	const logout = () => {
		try {
			localStorage.removeItem(COOKIE_KEY);
		} catch {
			// 忽略
		}
		setCookie("");
		setUser(null);
	};

	// 生成二维码
	const generateQr = useCallback(async () => {
		setQrStatus("loading");
		setQr(null);
		try {
			const res = await fetch("/api/bili/login?action=generate");
			const data = (await res.json()) as { success: boolean; data?: { url: string; key: string } };
			if (!data.success || !data.data) {
				setQrStatus("error");
				return;
			}
			setQr(data.data);
			setQrStatus("waiting");
			// B 站二维码有效期约 170 秒
			setSecondsLeft(170);
			loginDone.current = false;
			setPolling(true);
		} catch {
			setQrStatus("error");
		}
	}, []);

	useEffect(() => {
		if (loginOpen && !qr) void generateQr();
	}, [loginOpen, qr, generateQr]);

	// 关闭弹窗时停止轮询
	useEffect(() => {
		if (!loginOpen) setPolling(false);
	}, [loginOpen]);

	// 倒计时：归零后继续走负数，留给「已扫码但手机还没确认」的确认窗口
	useEffect(() => {
		if (!loginOpen || !qr || !polling) return;
		const timer = setInterval(() => {
			setSecondsLeft((s) => Math.max(-15, s - 1));
		}, 1000);
		return () => clearInterval(timer);
	}, [loginOpen, qr, polling]);

	// 确认窗口结束仍未成功，才判定二维码失效
	useEffect(() => {
		if (!polling || secondsLeft > -15) return;
		setPolling(false);
		setQrStatus("expired");
	}, [secondsLeft, polling]);

	// 轮询扫码状态
	useEffect(() => {
		if (!loginOpen || !qr || !polling) return;

		const pollOnce = async (key: string): Promise<{ status: string; cookie?: string } | null> => {
			try {
				const res = await fetch(`/api/bili/login?action=poll&key=${encodeURIComponent(key)}`);
				const data = (await res.json()) as {
					success: boolean;
					data?: { status: string; cookie?: string };
				};
				return data.success && data.data ? data.data : null;
			} catch {
				return null;
			}
		};

		const complete = (value: string) => {
			loginDone.current = true;
			setPolling(false);
			saveLogin(value);
			setLoginOpen(false);
			setQr(null);
			setNotice(t("video.loginSuccess"));
			setTimeout(() => setNotice(""), 4000);
		};

		// 避免上一次请求未返回就再次轮询：重复请求会把已用过的 key 判成失效
		let busy = false;
		const timer = setInterval(() => {
			if (busy) return;
			busy = true;
			void (async () => {
				try {
					const result = await pollOnce(qr.key);
					// 登录已完成后，忽略迟到的轮询结果（否则会把成功覆盖成「已失效」）
					if (!result || loginDone.current) return;

					if (result.status === "scanned") {
						setQrStatus("scanned");
					} else if (result.status === "success") {
						if (result.cookie) complete(result.cookie);
						else setQrStatus("error");
					} else if (result.status === "expired") {
						// 手机可能刚确认，再查一次；仍不是成功才判定失效
						await new Promise((r) => setTimeout(r, 1000));
						const retry = await pollOnce(qr.key);
						if (retry?.status === "success" && retry.cookie) {
							complete(retry.cookie);
						} else {
							setPolling(false);
							setQrStatus("expired");
						}
					}
				} finally {
					busy = false;
				}
			})();
		}, 2000);
		return () => clearInterval(timer);
	}, [loginOpen, qr, polling, saveLogin, t]);

	async function parse(raw: string, page?: number) {
		const text = raw.trim();
		if (!text) {
			setError(t("video.errors.invalid"));
			setState("error");
			return;
		}
		setState("loading");
		setError("");
		try {
			const params = new URLSearchParams({ url: text });
			if (page) params.set("p", String(page));
			const headers: Record<string, string> = {};
			if (cookie) headers["x-bili-cookie"] = cookie;
			const res = await fetch(`/api/video?${params.toString()}`, { headers });
			const data = (await res.json()) as ParseResponse;
			if (!data.success || !data.data) {
				const key = `video.errors.${data.code ?? "upstream"}`;
				const message = t(key);
				setError(message === key ? (data.error ?? t("video.errors.upstream")) : message);
				setInfo(null);
				setState("error");
				return;
			}
			setInfo(data.data);
			setState("success");
		} catch {
			setError(t("video.errors.upstream"));
			setInfo(null);
			setState("error");
		}
	}

	async function copyPlayUrl() {
		if (!info) return;
		try {
			await navigator.clipboard.writeText(info.playUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// 浏览器拦截剪贴板时忽略
		}
	}

	/** 通过服务端代理触发下载（B 站 CDN 有防盗链） */
	function download(target: string, filename: string, type: "video" | "audio" | "image") {
		if (!target) return;
		const url = `/api/video/download?url=${encodeURIComponent(target)}&name=${encodeURIComponent(filename)}&type=${type}`;
		const link = document.createElement("a");
		link.href = url;
		link.rel = "noopener";
		document.body.appendChild(link);
		link.click();
		link.remove();
	}

	const qrStatusText =
		{
			loading: t("video.loginLoading"),
			waiting: t("video.loginWaiting"),
			scanned: t("video.loginScanned"),
			expired: t("video.loginExpired"),
			error: t("video.loginError"),
		}[qrStatus] ?? "";

	const qrRemaining = polling
		? secondsLeft > 0
			? `${t("video.qrExpiresIn")} ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`
			: t("video.loginConfirming")
		: "";

	return (
		<PageLayout title={t("video.title")}>
			<div className="mt-10 space-y-6">
				{/* 输入区 */}
				<section className="rounded-2xl border border-gray-200 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/70">
					<div className="mb-3 flex items-center justify-between gap-3">
						{user ? (
							<div className="flex items-center gap-2">
								{user.face && (
									<img
										src={user.face}
										alt=""
										className="h-6 w-6 rounded-full object-cover"
										referrerPolicy="no-referrer"
									/>
								)}
								<span className="text-sm text-gray-700 dark:text-gray-300">{user.uname}</span>
								<button
									type="button"
									onClick={logout}
									className="text-xs text-gray-400 underline-offset-2 hover:text-gray-600 hover:underline dark:text-gray-500 dark:hover:text-gray-300"
								>
									{t("video.logout")}
								</button>
							</div>
						) : (
							<button
								type="button"
								onClick={() => {
									setQr(null);
									setQrStatus("loading");
									setLoginOpen(true);
								}}
								className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
							>
								{t("video.login")}
							</button>
						)}
						<span className="text-right text-xs text-gray-400 dark:text-gray-500">
							{t("video.loginLocalOnly")}
						</span>
					</div>

					{notice && (
						<p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
							{notice}
						</p>
					)}

					<form
						className="flex flex-col gap-3 sm:flex-row"
						onSubmit={(e) => {
							e.preventDefault();
							void parse(input);
						}}
					>
						<input
							value={input}
							onChange={(e) => setInput(e.target.value)}
							placeholder={t("video.placeholder")}
							className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-gray-500"
						/>
						<button
							type="submit"
							disabled={state === "loading"}
							className="shrink-0 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
						>
							{t("video.parse")}
						</button>
					</form>
					<p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{t("video.tip")}</p>
					{state === "error" && (
						<p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
							{error}
						</p>
					)}
				</section>

				{state === "loading" && (
					<section className="flex items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white/70 p-10 text-sm text-gray-400 dark:border-gray-800 dark:bg-gray-900/70 dark:text-gray-500">
						<span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-500 dark:border-gray-700 dark:border-t-gray-300" />
						{t("video.parsing")}
					</section>
				)}

				{state === "idle" && (
					<section className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white/40 p-6 dark:border-gray-800 dark:bg-gray-900/40">
						<p className="text-sm text-gray-400 dark:text-gray-500">{t("video.empty")}</p>
					</section>
				)}

				{info && state === "success" && (
					<section className="rounded-2xl border border-gray-200 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/70">
						<div className="overflow-hidden rounded-xl bg-black">
							<video
								key={info.playUrl}
								src={info.playUrl}
								poster={proxyImage(info.cover)}
								controls
								playsInline
								preload="metadata"
								className="aspect-video w-full"
							>
								{t("video.unsupported")}
							</video>
						</div>

						<h2 className="mt-4 text-lg font-medium tracking-tight text-gray-900 dark:text-gray-100">
							{info.title}
						</h2>
						<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
							<span>
								{t("video.up")}：{info.owner}
							</span>
							<span>
								{t("video.duration")}：{formatDuration(info.duration)}
							</span>
							<span>
								{t("video.quality")}：{info.quality}
							</span>
							<span>
								{t("video.size")}：{formatSize(info.size)}
							</span>
							{info.audioQuality && (
								<span>
									{t("video.audio")}：{info.audioQuality}
								</span>
							)}
						</div>

						{info.pages.length > 1 && (
							<div className="mt-4">
								<p className="mb-2 text-xs text-gray-400 dark:text-gray-500">{t("video.pages")}</p>
								<div className="flex flex-wrap gap-2">
									{info.pages.map((p) => (
										<button
											key={p.cid}
											type="button"
											onClick={() => void parse(info.bvid, p.page)}
											className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
												p.page === info.page
													? "border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900"
													: "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
											}`}
										>
											P{p.page} {p.part}
										</button>
									))}
								</div>
							</div>
						)}

						<div className="mt-5 flex flex-wrap gap-3">
							<button
								type="button"
								onClick={() =>
									download(
										info.playUrl,
										`${safeName(info.title) || info.bvid}-${info.quality}.mp4`,
										"video",
									)
								}
								className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
							>
								{t("video.downloadVideo")}
							</button>
							{info.audioUrl && (
								<button
									type="button"
									onClick={() =>
										download(
											info.audioUrl,
											`${safeName(info.title) || info.bvid}-audio-${info.audioQuality}.m4a`,
											"audio",
										)
									}
									className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
								>
									{t("video.downloadAudio")}
								</button>
							)}
							<button
								type="button"
								onClick={() => download(info.cover, `${safeName(info.title) || info.bvid}-cover.jpg`, "image")}
								className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
							>
								{t("video.downloadCover")}
							</button>
							<button
								type="button"
								onClick={() => void copyPlayUrl()}
								className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
							>
								{copied ? t("video.copied") : t("video.copyLink")}
							</button>
							<a
								href={`https://www.bilibili.com/video/${info.bvid}?p=${info.page}`}
								target="_blank"
								rel="noreferrer"
								className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
							>
								{t("video.openSource")}
							</a>
						</div>
					</section>
				)}
			</div>

			{/* 扫码登录弹窗 */}
			{loginOpen && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
					onClick={() => setLoginOpen(false)}
				>
					<div
						className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900"
						onClick={(e) => e.stopPropagation()}
					>
						<h3 className="text-center text-lg font-medium text-gray-900 dark:text-gray-100">
							{t("video.loginTitle")}
						</h3>
						<div className="mt-4 flex min-h-[216px] items-center justify-center">
							{qr ? (
								<div className="rounded-xl bg-white p-3">
									<QRCodeSVG
										value={qr.url}
										size={196}
										level="M"
										marginSize={0}
										aria-label={t("video.loginTitle")}
									/>
								</div>
							) : (
								<span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-500" />
							)}
						</div>
						<p className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">
							{qrStatusText}
							{qrRemaining && ` · ${qrRemaining}`}
						</p>
						{qrStatus === "expired" && (
							<button
								type="button"
								onClick={() => void generateQr()}
								className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
							>
								{t("video.loginRefresh")}
							</button>
						)}
						<p className="mt-3 text-center text-xs text-gray-400 dark:text-gray-500">
							{t("video.loginLocalOnly")}
						</p>
						<button
							type="button"
							onClick={() => setLoginOpen(false)}
							className="mt-3 w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
						>
							{t("video.close")}
						</button>
					</div>
				</div>
			)}
		</PageLayout>
	);
}
