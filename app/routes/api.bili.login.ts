import type { Route } from "./+types/api.bili.login";

/**
 * B 站扫码登录代理：生成二维码 + 轮询扫码状态。
 * 登录成功后只把 Cookie 回传给浏览器保存，服务端不落库。
 */

let buvidCookie: string | undefined;

function biliHeaders(): Record<string, string> {
	buvidCookie ??= `buvid3=${crypto.randomUUID().toUpperCase()}infoc`;
	return {
		"User-Agent":
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
		Referer: "https://www.bilibili.com/",
		Cookie: buvidCookie,
	};
}

/** 登录成功回调地址里携带的 Cookie 字段 */
const COOKIE_KEYS = ["SESSDATA", "bili_jct", "DedeUserID", "DedeUserID__ckMd5", "sid"];

/**
 * 从回调 URL 中提取 Cookie 字符串。
 * 手动解析查询串以保留原始百分号编码：SESSDATA 里的逗号是分隔符（%2C），
 * 解码后再拼进 Cookie 头会被 B 站判为无效。
 */
function cookieFromUrl(raw: string): string {
	const query = raw.includes("?") ? raw.slice(raw.indexOf("?") + 1) : "";
	const values = new Map<string, string>();
	for (const pair of query.split("&")) {
		const index = pair.indexOf("=");
		if (index > 0) values.set(pair.slice(0, index), pair.slice(index + 1));
	}
	return COOKIE_KEYS.map((key) => {
		const value = values.get(key);
		return value ? `${key}=${value}` : "";
	})
		.filter(Boolean)
		.join("; ");
}

async function getJson<T>(url: string): Promise<{ code: number; message: string; data?: T }> {
	const res = await fetch(url, { headers: biliHeaders(), signal: AbortSignal.timeout(10_000) });
	if (!res.ok) throw new Error(`passport ${res.status}`);
	return (await res.json()) as { code: number; message: string; data?: T };
}

interface QrGenerate {
	url: string;
	qrcode_key: string;
}

interface QrPoll {
	code: number;
	message: string;
	url?: string;
}

export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url);
	const action = url.searchParams.get("action");

	try {
		if (action === "generate") {
			const data = await getJson<QrGenerate>(
				"https://passport.bilibili.com/x/passport-login/web/qrcode/generate",
			);
			if (data.code !== 0 || !data.data) {
				return Response.json({ success: false, error: "二维码生成失败" }, { status: 502 });
			}
			return Response.json(
				{ success: true, data: { url: data.data.url, key: data.data.qrcode_key } },
				{ headers: { "Cache-Control": "no-store" } },
			);
		}

		if (action === "poll") {
			const key = url.searchParams.get("key");
			if (!key) {
				return Response.json({ success: false, error: "缺少二维码 key" }, { status: 400 });
			}
			const data = await getJson<QrPoll>(
				`https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${encodeURIComponent(key)}`,
			);
			if (data.code !== 0 || !data.data) {
				return Response.json({ success: false, error: "扫码状态查询失败" }, { status: 502 });
			}

			// 86101 未扫码 / 86090 已扫码待确认 / 86038 已失效 / 0 成功
			const statusMap: Record<number, string> = {
				0: "success",
				86101: "waiting",
				86090: "scanned",
				86038: "expired",
			};
			const status = statusMap[data.data.code] ?? "waiting";
			return Response.json(
				{
					success: true,
					data: {
						status,
						cookie: status === "success" && data.data.url ? cookieFromUrl(data.data.url) : "",
					},
				},
				{ headers: { "Cache-Control": "no-store" } },
			);
		}

		return Response.json({ success: false, error: "未知操作" }, { status: 400 });
	} catch (error) {
		console.error("B 站登录代理失败:", error);
		return Response.json({ success: false, error: "B 站登录服务不可用" }, { status: 502 });
	}
}
