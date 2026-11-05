/**
 * B 站视频解析：从分享链接 / BV 号获取视频信息、可直接播放的 MP4 地址与音频地址。
 *
 * 播放/下载视频使用 web 端 html5 播放接口（platform=html5&fnval=1），返回音视频合一的
 * durl，游客最高 720P；音频来自 dash（fnval=16）。带登录 Cookie 时可换取更高清晰度，
 * Cookie 只由调用方逐次传入，不在服务端保存。
 */

export interface VideoPage {
	cid: number;
	page: number;
	part: string;
	duration: number;
}

export interface VideoInfo {
	platform: "bilibili";
	bvid: string;
	aid: number;
	title: string;
	cover: string;
	owner: string;
	duration: number;
	pages: VideoPage[];
	page: number;
	playUrl: string;
	quality: string;
	size: number;
	audioUrl: string;
	audioQuality: string;
	/** 本次解析是否使用了登录态 */
	loggedIn: boolean;
}

/** 解析失败：code 供前端映射为本地化文案 */
export class VideoError extends Error {
	readonly code: string;

	constructor(code: string, message: string) {
		super(message);
		this.code = code;
	}
}

/** B 站接口返回码 → 本地化错误键 */
function toVideoError(code: number, message: string): VideoError {
	const known: Record<number, string> = {
		"-404": "notFound",
		"-403": "forbidden",
		"-352": "riskControl",
		"-412": "riskControl",
		"87007": "charge",
		"87008": "charge",
	};
	return new VideoError(known[code] ?? "upstream", message || "解析失败");
}

/** b23.tv 等短链域名 */
const SHORT_LINK_HOSTS = new Set(["b23.tv", "bili2233.cn"]);

/**
 * Workers 禁止在模块顶层生成随机值，首次调用时才创建 buvid3 并复用。
 * 不带 Cookie 时接口会返回 412（风控），带上任意合法格式的 buvid3 即可通过。
 */
let buvidCookie: string | undefined;

function biliHeaders(cookie?: string): Record<string, string> {
	buvidCookie ??= `buvid3=${crypto.randomUUID().toUpperCase()}infoc`;
	return {
		"User-Agent":
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
		Referer: "https://www.bilibili.com/",
		Cookie: cookie?.trim() || buvidCookie,
	};
}

/** 从任意文本中识别 BV 号 / av 号 */
export function parseVideoRef(raw: string): { bvid?: string; aid?: number } | null {
	const bv = raw.match(/BV[0-9A-Za-z]{10}/);
	if (bv) return { bvid: bv[0] };
	const av = raw.match(/\bav(\d+)/i);
	if (av) return { aid: Number(av[1]) };
	return null;
}

/**
 * 从分享文案中取出链接：
 * 「【标题】 https://b23.tv/xxxx」→「https://b23.tv/xxxx」。
 * 文案里没有链接时原样返回（去掉首尾空白）。
 */
export function extractLink(raw: string): string {
	const match = raw.match(/https?:\/\/[^\s"'<>，。；：、）】]+/i);
	return match ? match[0] : raw.trim();
}

/** 展开 b23.tv 短链为完整视频地址；其他地址原样返回 */
export async function expandShortLink(raw: string): Promise<string> {
	const url = new URL(raw);
	if (!SHORT_LINK_HOSTS.has(url.hostname)) return raw;
	const res = await fetch(url.toString(), {
		redirect: "manual",
		headers: biliHeaders(),
		signal: AbortSignal.timeout(8_000),
	});
	const location = res.headers.get("location");
	if (!location) throw new VideoError("invalid", "短链解析失败");
	return location;
}

interface BiliView {
	bvid: string;
	aid: number;
	title: string;
	pic: string;
	duration: number;
	owner: { name: string };
	pages: { cid: number; page: number; part: string; duration: number }[];
}

interface BiliPlay {
	quality: number;
	accept_quality: number[];
	accept_description: string[];
	durl?: { url: string; size: number }[];
}

interface BiliDash {
	audio?: { id: number; baseUrl: string; bandwidth: number }[];
}

/** 请求 B 站接口并解包 { code, message, data } */
async function getJson<T>(
	url: string,
	cookie?: string,
): Promise<{ code: number; message: string; data?: T }> {
	let res: Response;
	try {
		res = await fetch(url, { headers: biliHeaders(cookie), signal: AbortSignal.timeout(10_000) });
	} catch {
		throw new VideoError("upstream", "无法连接 B 站接口");
	}
	if (!res.ok) throw new VideoError("upstream", `B 站接口返回 ${res.status}`);
	return (await res.json()) as { code: number; message: string; data?: T };
}

/** 解析清晰度名称：qn 在 accept_quality 中的位置对应 accept_description */
function qualityLabel(play: BiliPlay): string {
	const index = play.accept_quality?.indexOf(play.quality) ?? -1;
	return (index >= 0 ? play.accept_description?.[index] : undefined) ?? `${play.quality}`;
}

/** dash 音频流 id → 码率名称 */
function audioLabel(id: number): string {
	const known: Record<number, string> = {
		30216: "64K",
		30232: "132K",
		30280: "192K",
		30250: "Dolby",
		30251: "Hi-Res",
	};
	return known[id] ?? `${id}`;
}

/** 取码率最高的 dash 音频 */
function bestAudio(dash: BiliDash | undefined): { url: string; quality: string } {
	const list = dash?.audio;
	if (!list?.length) return { url: "", quality: "" };
	const best = list.reduce((a, b) => (b.bandwidth > a.bandwidth ? b : a));
	return { url: best.baseUrl, quality: audioLabel(best.id) };
}

/**
 * 解析 B 站视频。
 * @param raw 视频链接、短链或 BV/av 号
 * @param pageParam 指定分 P（覆盖链接中的 p 参数）
 * @param cookie 用户浏览器本地保存的 B 站 Cookie（可选）
 * @returns 视频信息、可直接播放的 MP4 地址与最高码率音频地址
 */
export async function resolveBilibili(
	raw: string,
	pageParam?: number,
	cookie?: string,
): Promise<VideoInfo> {
	let input = extractLink(raw);
	if (!input) throw new VideoError("invalid", "请输入视频链接");

	let page = pageParam && pageParam > 0 ? pageParam : 1;

	if (/^https?:\/\//i.test(input)) {
		let url: URL;
		try {
			url = new URL(input);
		} catch {
			throw new VideoError("invalid", "链接格式不正确");
		}
		if (SHORT_LINK_HOSTS.has(url.hostname)) {
			input = await expandShortLink(input);
		} else if (!/(^|\.)bilibili\.com$/i.test(url.hostname)) {
			throw new VideoError("invalid", "暂只支持 B 站视频链接");
		}
		if (!pageParam) {
			try {
				const p = Number(new URL(input).searchParams.get("p"));
				if (Number.isFinite(p) && p > 0) page = p;
			} catch {
				// 短链展开结果不是合法 URL 时忽略分 P 参数
			}
		}
	}

	const ref = parseVideoRef(input);
	if (!ref) throw new VideoError("invalid", "无法识别 BV 号或视频链接");

	// Cookie 可能已过期：校验后再用于解析，失效则按游客处理
	let effectiveCookie = cookie?.trim() || undefined;
	if (effectiveCookie) {
		try {
			const nav = await getJson<{ isLogin: boolean }>(
				"https://api.bilibili.com/x/web-interface/nav",
				effectiveCookie,
			);
			if (nav.code !== 0 || !nav.data?.isLogin) effectiveCookie = undefined;
		} catch {
			effectiveCookie = undefined;
		}
	}

	const viewUrl = new URL("https://api.bilibili.com/x/web-interface/view");
	if (ref.bvid) viewUrl.searchParams.set("bvid", ref.bvid);
	else viewUrl.searchParams.set("aid", String(ref.aid));

	const view = await getJson<BiliView>(viewUrl.toString(), effectiveCookie);
	if (view.code !== 0 || !view.data) throw toVideoError(view.code, view.message);
	const info = view.data;

	if (!info.pages?.length) throw new VideoError("notFound", "视频信息不完整");

	const index = Math.min(Math.max(page - 1, 0), info.pages.length - 1);
	const current = info.pages[index];

	const playUrl = new URL("https://api.bilibili.com/x/player/playurl");
	playUrl.searchParams.set("bvid", info.bvid);
	playUrl.searchParams.set("cid", String(current.cid));
	playUrl.searchParams.set("qn", "80");
	playUrl.searchParams.set("fnval", "1");
	playUrl.searchParams.set("platform", "html5");
	playUrl.searchParams.set("high_quality", "1");

	const play = await getJson<BiliPlay>(playUrl.toString(), effectiveCookie);
	if (play.code !== 0 || !play.data) throw toVideoError(play.code, play.message);
	const durl = play.data.durl?.[0];
	if (!durl) throw new VideoError("charge", "该视频没有可用的播放地址");

	// 音频单独走 dash 接口，失败不影响视频播放
	let audio = { url: "", quality: "" };
	try {
		const dashUrl = new URL("https://api.bilibili.com/x/player/playurl");
		dashUrl.searchParams.set("bvid", info.bvid);
		dashUrl.searchParams.set("cid", String(current.cid));
		dashUrl.searchParams.set("qn", "112");
		dashUrl.searchParams.set("fnval", "16");
		dashUrl.searchParams.set("fourk", "1");
		const dash = await getJson<{ dash?: BiliDash }>(dashUrl.toString(), effectiveCookie);
		if (dash.code === 0) audio = bestAudio(dash.data?.dash);
	} catch {
		// 音频获取失败时保持为空，页面只提供视频下载
	}

	return {
		platform: "bilibili",
		bvid: info.bvid,
		aid: info.aid,
		title: info.title,
		cover: info.pic.replace(/^http:/, "https:"),
		owner: info.owner?.name ?? "",
		duration: current.duration,
		pages: info.pages.map((p) => ({
			cid: p.cid,
			page: p.page,
			part: p.part,
			duration: p.duration,
		})),
		page: current.page,
		playUrl: durl.url,
		quality: qualityLabel(play.data),
		size: durl.size,
		audioUrl: audio.url,
		audioQuality: audio.quality,
		loggedIn: Boolean(effectiveCookie),
	};
}
