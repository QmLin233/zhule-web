import { useEffect, useState, type FormEvent } from "react";
import type { Route } from "./+types/ip";
import type { IpInfo } from "~/lib/ip";
import { NavMenu } from "../components/NavMenu";

export function meta({}: Route.MetaArgs) {
	return [{ title: "IP 查询 | 逐乐" }];
}

/** /api/ip 的响应：成功为 IpInfo，失败时携带 error */
type IpResponse = IpInfo & { error?: string };

const COUNTRY_NAMES: Record<string, string> = {
	CN: "中国",
	HK: "中国香港",
	MO: "中国澳门",
	TW: "中国台湾",
	US: "美国",
	JP: "日本",
	KR: "韩国",
	SG: "新加坡",
	GB: "英国",
	DE: "德国",
	FR: "法国",
	RU: "俄罗斯",
	CA: "加拿大",
	AU: "澳大利亚",
	IN: "印度",
	BR: "巴西",
	NL: "荷兰",
	SE: "瑞典",
	FI: "芬兰",
	CH: "瑞士",
	IT: "意大利",
	ES: "西班牙",
	PL: "波兰",
	UA: "乌克兰",
	TR: "土耳其",
	SA: "沙特阿拉伯",
	AE: "阿联酋",
	TH: "泰国",
	VN: "越南",
	MY: "马来西亚",
	ID: "印度尼西亚",
	PH: "菲律宾",
	NZ: "新西兰",
	AR: "阿根廷",
	MX: "墨西哥",
	ZA: "南非",
	EG: "埃及",
};

const SOURCE_NAMES: Record<string, string> = {
	cf: "Cloudflare 边缘",
	"ip-api": "ip-api.com",
	ipinfo: "ipinfo.io",
	geo: "GeoIP 数据库",
};

function countryName(info: IpInfo): string | undefined {
	if (info.country) return info.country;
	if (info.countryCode) return COUNTRY_NAMES[info.countryCode] ?? info.countryCode;
	return undefined;
}

function locationText(info: IpInfo): string | undefined {
	const parts = [countryName(info), info.region, info.city].filter(Boolean);
	return parts.length ? parts.join(" · ") : undefined;
}

function coordinateText(info: IpInfo): string | undefined {
	if (info.latitude == null || info.longitude == null) return undefined;
	return `${info.latitude.toFixed(4)}, ${info.longitude.toFixed(4)}`;
}

function InfoRow({ label, value }: { label: string; value?: string | number }) {
	return (
		<div className="flex items-center justify-between gap-4 border-b border-gray-100 py-2.5 text-sm last:border-0 dark:border-gray-800">
			<span className="shrink-0 text-gray-400 dark:text-gray-500">{label}</span>
			<span className="text-right font-medium text-gray-800 dark:text-gray-100">
				{value !== undefined && value !== null && value !== "" ? value : "—"}
			</span>
		</div>
	);
}

function SourceBadge({ source }: { source?: string }) {
	if (!source) return null;
	return (
		<span className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
			{SOURCE_NAMES[source] ?? source}
		</span>
	);
}

function Loading() {
	return (
		<div className="flex items-center gap-3 py-6 text-sm text-gray-400 dark:text-gray-500">
			<span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-500 dark:border-gray-700 dark:border-t-gray-300" />
			正在获取…
		</div>
	);
}

export default function Ip() {
	const [myIp, setMyIp] = useState<IpInfo | null>(null);
	const [myState, setMyState] = useState<"loading" | "success" | "error">("loading");
	const [myError, setMyError] = useState("");

	const [input, setInput] = useState("");
	const [result, setResult] = useState<IpInfo | null>(null);
	const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
	const [error, setError] = useState("");

	// 进入页面自动获取我的 IP
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch("/api/ip");
				const data = (await res.json()) as IpResponse;
				if (!res.ok || data.error) throw new Error(data.error || "获取失败");
				if (!cancelled) {
					setMyIp(data);
					setMyState("success");
				}
			} catch (e) {
				if (!cancelled) {
					setMyError(e instanceof Error ? e.message : "获取失败");
					setMyState("error");
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		const q = input.trim();
		if (!q) return;
		setState("loading");
		setResult(null);
		setError("");
		try {
			const res = await fetch(`/api/ip?ip=${encodeURIComponent(q)}`);
			const data = (await res.json()) as IpResponse;
			if (!res.ok || data.error) throw new Error(data.error || "查询失败");
			setResult(data);
			setState("success");
		} catch (e) {
			setError(e instanceof Error ? e.message : "查询失败");
			setState("error");
		}
	}

	return (
		<div className="flex min-h-screen flex-col bg-cream text-gray-900 dark:bg-gray-950 dark:text-gray-100">
			<NavMenu />
			<main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
				<header className="text-center">
					<h1 className="text-4xl font-semibold tracking-tight">IP 查询</h1>
				</header>

				<div className="mt-10 space-y-6">
					{/* 我的 IP */}
					<section className="rounded-2xl border border-gray-200 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/70">
						<div className="flex items-center justify-between">
							<h2 className="text-lg font-medium tracking-tight">我的 IP</h2>
							<SourceBadge source={myIp?.source} />
						</div>

						{myState === "loading" && <Loading />}

						{myState === "error" && (
							<p className="py-6 text-sm text-red-500 dark:text-red-400">{myError}</p>
						)}

						{myState === "success" && myIp && (
							<div className="mt-4">
								<p className="break-all text-3xl font-semibold tracking-tight sm:text-4xl">
									{myIp.ip || "—"}
								</p>
								{locationText(myIp) && (
									<p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
										{locationText(myIp)}
									</p>
								)}
								{!myIp.ip && (
									<p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
										本地开发环境暂无 Cloudflare 边缘数据，部署后自动显示真实 IP
									</p>
								)}
								<div className="mt-5 grid gap-x-8 sm:grid-cols-2">
									<InfoRow label="国家 / 地区" value={countryName(myIp)} />
									<InfoRow label="省 / 州" value={myIp.region ?? myIp.regionCode} />
									<InfoRow label="城市" value={myIp.city} />
									<InfoRow label="运营商" value={myIp.isp ?? myIp.org} />
									<InfoRow label="ASN" value={myIp.asn} />
									<InfoRow label="时区" value={myIp.timezone} />
									<InfoRow label="经纬度" value={coordinateText(myIp)} />
								</div>
							</div>
						)}
					</section>

					{/* 查询任意 IP */}
					<section className="rounded-2xl border border-gray-200 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/70">
						<h2 className="text-lg font-medium tracking-tight">查询任意 IP</h2>

						<form onSubmit={handleSubmit} className="mt-4 flex gap-2">
							<input
								type="text"
								value={input}
								onChange={(e) => setInput(e.target.value)}
								placeholder="输入 IP 地址，例如 8.8.8.8"
								autoComplete="off"
								spellCheck={false}
								className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-gray-500 dark:focus:ring-gray-700"
							/>
							<button
								type="submit"
								disabled={state === "loading" || !input.trim()}
								className="shrink-0 rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
							>
								查询
							</button>
						</form>

						<div className="mt-5">
							{state === "idle" && (
								<p className="py-4 text-sm text-gray-400 dark:text-gray-500">
									输入一个 IP 地址开始查询
								</p>
							)}
							{state === "loading" && <Loading />}
							{state === "error" && (
								<p className="py-4 text-sm text-red-500 dark:text-red-400">{error}</p>
							)}
							{state === "success" && result && (
								<div>
									<p className="break-all text-2xl font-semibold tracking-tight">{result.ip}</p>
									{locationText(result) && (
										<p className="mt-1.5 text-sm text-gray-400 dark:text-gray-500">
											{locationText(result)}
										</p>
									)}
									<div className="mt-4 grid gap-x-8 sm:grid-cols-2">
										<InfoRow label="国家 / 地区" value={countryName(result)} />
										<InfoRow label="省 / 州" value={result.region ?? result.regionCode} />
										<InfoRow label="城市" value={result.city} />
										<InfoRow label="运营商" value={result.isp ?? result.org} />
										<InfoRow label="ASN" value={result.asn} />
										<InfoRow label="时区" value={result.timezone} />
										<InfoRow label="经纬度" value={coordinateText(result)} />
										{result.proxy !== undefined && (
											<InfoRow label="代理 / VPN" value={result.proxy ? "是" : "否"} />
										)}
										{result.hosting !== undefined && (
											<InfoRow label="数据中心" value={result.hosting ? "是" : "否"} />
										)}
										{result.mobile !== undefined && (
											<InfoRow label="移动网络" value={result.mobile ? "是" : "否"} />
										)}
									</div>
								</div>
							)}
						</div>
					</section>
				</div>
			</main>
		</div>
	);
}
