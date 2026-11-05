import type { Route } from "./+types/api.bili.me";

/**
 * 校验浏览器本地保存的 B 站 Cookie 是否仍然有效，并返回用户信息。
 * Cookie 由前端通过 x-bili-cookie 请求头传入，服务端不保存。
 */

let buvidCookie: string | undefined;

function biliHeaders(cookie: string): Record<string, string> {
	buvidCookie ??= `buvid3=${crypto.randomUUID().toUpperCase()}infoc`;
	return {
		"User-Agent":
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
		Referer: "https://www.bilibili.com/",
		Cookie: cookie || buvidCookie,
	};
}

interface NavData {
	isLogin: boolean;
	uname?: string;
	face?: string;
	mid?: number;
	vipStatus?: number;
}

export async function loader({ request }: Route.LoaderArgs) {
	const cookie = request.headers.get("x-bili-cookie")?.trim();
	if (!cookie) {
		return Response.json(
			{ success: true, data: { loggedIn: false } },
			{ headers: { "Cache-Control": "no-store" } },
		);
	}

	try {
		const res = await fetch("https://api.bilibili.com/x/web-interface/nav", {
			headers: biliHeaders(cookie),
			signal: AbortSignal.timeout(10_000),
		});
		if (!res.ok) {
			return Response.json(
				{ success: true, data: { loggedIn: false } },
				{ headers: { "Cache-Control": "no-store" } },
			);
		}
		const json = (await res.json()) as { code: number; data?: NavData };
		if (json.code !== 0 || !json.data?.isLogin) {
			return Response.json(
				{ success: true, data: { loggedIn: false } },
				{ headers: { "Cache-Control": "no-store" } },
			);
		}
		return Response.json(
			{
				success: true,
				data: {
					loggedIn: true,
					uname: json.data.uname ?? "",
					face: (json.data.face ?? "").replace(/^http:/, "https:"),
					mid: json.data.mid ?? 0,
					vip: json.data.vipStatus === 1,
				},
			},
			{ headers: { "Cache-Control": "no-store" } },
		);
	} catch {
		return Response.json(
			{ success: true, data: { loggedIn: false } },
			{ headers: { "Cache-Control": "no-store" } },
		);
	}
}
