import { useEffect, useState } from "react";
import type { Route } from "./+types/ip";
import type { IpInfo } from "~/lib/ip";
import { locationZh } from "~/lib/geo";
import { PageLayout } from "../components/PageLayout";
import { pageMeta } from "../lib/meta";

export function meta({}: Route.MetaArgs) {
	return pageMeta("IP 查询");
}

/** /api/ip 的响应：成功为 IpInfo，失败时携带 error */
type IpResponse = IpInfo & { error?: string };

/** 请求 /api/ip 并解析 JSON，失败时抛出错误 */
async function fetchIpInfo(url: string, failMsg: string): Promise<IpResponse> {
	const res = await fetch(url);
	const data = (await res.json()) as IpResponse;
	if (!res.ok || data.error) throw new Error(data.error || failMsg);
	return data;
}

const SOURCE_NAMES: Record<string, string> = {
	cf: "Cloudflare",
	"ip-api": "ip-api.com",
	ipchaxun: "Cloudflare",
	ipinfo: "ipinfo.io",
	geo: "GeoIP 数据库",
};

function InfoBlock({ label, value }: { label?: string; value?: string | number }) {
	return (
		<div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 dark:border-gray-800 dark:bg-gray-800/40">
			{label && (
				<p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
			)}
			<p className="mt-1 whitespace-pre-line break-words text-sm font-medium text-gray-800 dark:text-gray-100">
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
	const [latency, setLatency] = useState<number | null>(null);
	const [myIpv6, setMyIpv6] = useState<string | null>(null);

	// 进入页面自动获取我的 IP
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const data = await fetchIpInfo("/api/ip", "获取失败 · Load failed");
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

	// 客户端检测访问者是否有 IPv6：请求 IPv6-only 回显，成功才有（失败即无，不显示）
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch("https://api6.ipify.org", {
					signal: AbortSignal.timeout(4000),
				});
				if (!res.ok) return;
				const ipv6 = (await res.text()).trim();
				if (!cancelled && ipv6) setMyIpv6(ipv6);
			} catch {
				// 无 IPv6 或网络异常：保持不显示
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<PageLayout title="IP 查询">
			<div className="mt-10 space-y-6">
					{/* 我的 IP */}
					<section className="rounded-2xl border border-gray-200 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/70">
						<div className="flex items-center justify-between">
							<h2 className="text-lg font-medium tracking-tight">我的 IP</h2>
							<div className="flex flex-col items-end gap-1">
								<SourceBadge source={myIp?.source} />
								{myIp?.egressIp && (
									<span className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
										{myIp.egressIp}
									</span>
								)}
								{latency != null && (
									<span className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
										{latency}ms
									</span>
								)}
							</div>
						</div>

						{myState === "loading" && <Loading />}

						{myState === "error" && (
							<p className="py-6 text-sm text-red-500 dark:text-red-400">{myError}</p>
						)}

						{myState === "success" && myIp && (
							<div className="mt-4">
								<p className="break-all text-3xl font-semibold tracking-widest sm:text-4xl">
									{myIp.ip || "0.0.0.0"}
								</p>
								{myIpv6 && (
									<p className="mt-1.5 break-all text-3xl font-semibold tracking-widest sm:text-4xl">
										{myIpv6}
									</p>
								)}
								<div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
									<InfoBlock
										value={myIp.ip ? locationZh(myIp) : undefined}
									/>
									<InfoBlock
										value={myIp.ip ? (myIp.isp ?? myIp.org) : undefined}
									/>
									<InfoBlock value={myIp.ip ? myIp.asn : undefined} />
								</div>
							</div>
						)}
					</section>

				</div>
		</PageLayout>
	);
}
