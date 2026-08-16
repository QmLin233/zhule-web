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
	cf: "Cloudflare",
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

function InfoBlock({ label, value }: { label: string; value?: string | number }) {
	return (
		<div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 dark:border-gray-800 dark:bg-gray-800/40">
			<p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
			<p className="mt-1 break-words text-sm font-medium text-gray-800 dark:text-gray-100">
				{value !== undefined && value !== null && value !== "" ? value : "None"}
			</p>
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
			正在获取… · Loading…
		</div>
	);
}

// 测量本机到 Cloudflare 节点的网络延迟：多次 HEAD 请求取最小值（最接近真实 RTT）
// 用静态资源 favicon.ico 测量，由边缘直接响应，不含服务端处理时间
async function measureLatency(samples = 3): Promise<number> {
	let best = Infinity;
	for (let i = 0; i < samples; i++) {
		const start = performance.now();
		try {
			await fetch("/favicon.ico", { method: "HEAD", cache: "no-store" });
			const rtt = performance.now() - start;
			if (rtt < best) best = rtt;
		} catch {
			// 单次失败忽略，继续下一轮
		}
	}
	return Number.isFinite(best) ? Math.round(best) : 0;
}

export default function Ip() {
	const [myIp, setMyIp] = useState<IpInfo | null>(null);
	const [myState, setMyState] = useState<"loading" | "success" | "error">("loading");
	const [myError, setMyError] = useState("");

	const [input, setInput] = useState("");
	const [result, setResult] = useState<IpInfo | null>(null);
	const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
	const [error, setError] = useState("");
	const [latency, setLatency] = useState<number | null>(null);

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
					setMyError(e instanceof Error ? e.message : "获取失败 · Load failed");
					setMyState("error");
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	// 测量到节点的网络延迟
	useEffect(() => {
		let cancelled = false;
		(async () => {
			const ms = await measureLatency();
			if (!cancelled) setLatency(ms);
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
			setError(e instanceof Error ? e.message : "查询失败 · Lookup failed");
			setState("error");
		}
	}

	return (
		<div className="flex min-h-screen flex-col bg-cream text-gray-900 dark:bg-gray-950 dark:text-gray-100">
			<NavMenu />
			<main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
				<header className="text-center">
					<h1 className="text-4xl font-semibold tracking-tight">IP 查询</h1>
					<p className="mt-2 text-sm tracking-[0.3em] text-gray-400 dark:text-gray-500">
						IP LOOKUP
					</p>
				</header>

				<div className="mt-10 space-y-6">
					{/* 我的 IP */}
					<section className="rounded-2xl border border-gray-200 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/70">
						<div className="flex items-center justify-between">
							<h2 className="text-lg font-medium tracking-tight">
								本机 IP{" "}
								<span className="ml-1 text-sm font-normal text-gray-400 dark:text-gray-500">
									Address
								</span>
							</h2>
							<SourceBadge source={myIp?.source} />
						</div>

						{myState === "loading" && <Loading />}

						{myState === "error" && (
							<p className="py-6 text-sm text-red-500 dark:text-red-400">{myError}</p>
						)}

						{myState === "success" && myIp && (
							<div className="mt-4">
								<p className="break-all text-3xl font-semibold tracking-wider sm:text-4xl">
									{myIp.ip || "0.0.0.0"}
								</p>
								<div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
									<InfoBlock
										label="IP 属地 · Location"
										value={myIp.ip ? locationText(myIp) : undefined}
									/>
									<InfoBlock
										label="运营商 · ISP"
										value={myIp.ip ? (myIp.isp ?? myIp.org) : undefined}
									/>
									<InfoBlock label="ASN" value={myIp.ip ? myIp.asn : undefined} />
									<InfoBlock label="时区 · Timezone" value={myIp.ip ? myIp.timezone : undefined} />
									<InfoBlock label="经纬度 · Coordinates" value={myIp.ip ? coordinateText(myIp) : undefined} />
									<InfoBlock
										label="延迟 · Latency"
										value={myIp.ip && latency != null ? `${latency} ms` : undefined}
									/>
								</div>
							</div>
						)}
					</section>

					{/* 查询任意 IP */}
					<section className="rounded-2xl border border-gray-200 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/70">
						<h2 className="text-lg font-medium tracking-tight">
							查询任意 IP{" "}
							<span className="ml-1 text-sm font-normal text-gray-400 dark:text-gray-500">
								Lookup IP
							</span>
						</h2>

						<form onSubmit={handleSubmit} className="mt-4 flex gap-2">
							<input
								type="text"
								value={input}
								onChange={(e) => setInput(e.target.value)}
								autoComplete="off"
								spellCheck={false}
								className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-gray-500 dark:focus:ring-gray-700"
							/>
							<button
								type="submit"
								disabled={state === "loading" || !input.trim()}
								className="shrink-0 rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
							>
								查询 Lookup
							</button>
						</form>

						<div className="mt-5">
							{state === "loading" && <Loading />}
							{state === "error" && (
								<p className="py-4 text-sm text-red-500 dark:text-red-400">{error}</p>
							)}
							{state === "success" && result && (
								<div>
									<p className="break-all text-2xl font-semibold tracking-wider">{result.ip}</p>
									<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
										<InfoBlock label="IP 属地 · Location" value={locationText(result)} />
										<InfoBlock label="运营商 · ISP" value={result.isp ?? result.org} />
										<InfoBlock label="ASN" value={result.asn} />
										<InfoBlock label="时区 · Timezone" value={result.timezone} />
										<InfoBlock label="经纬度 · Coordinates" value={coordinateText(result)} />
										{result.proxy !== undefined && (
											<InfoBlock label="代理 / VPN · Proxy / VPN" value={result.proxy ? "是" : "否"} />
										)}
										{result.hosting !== undefined && (
											<InfoBlock label="数据中心 · Datacenter" value={result.hosting ? "是" : "否"} />
										)}
										{result.mobile !== undefined && (
											<InfoBlock label="移动网络 · Mobile" value={result.mobile ? "是" : "否"} />
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
