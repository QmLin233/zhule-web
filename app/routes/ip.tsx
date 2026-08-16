import { useEffect, useState } from "react";
import type { Route } from "./+types/ip";
import type { IpInfo } from "~/lib/ip";
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
	ipchaxun: "ipchaxun.com.cn",
	ipinfo: "ipinfo.io",
	geo: "GeoIP 数据库",
};

// 英文省/州名 → 中文（常见区域）
const REGION_CN: Record<string, string> = {
	// 中国省级
	Anhui: "安徽", Beijing: "北京", Chongqing: "重庆", Fujian: "福建",
	Gansu: "甘肃", Guangdong: "广东", Guangxi: "广西", Guizhou: "贵州",
	Hainan: "海南", Hebei: "河北", Heilongjiang: "黑龙江", Henan: "河南",
	Hubei: "湖北", Hunan: "湖南", "Inner Mongolia": "内蒙古", Jiangsu: "江苏",
	Jiangxi: "江西", Jilin: "吉林", Liaoning: "辽宁", Ningxia: "宁夏",
	Qinghai: "青海", Shaanxi: "陕西", Shandong: "山东", Shanghai: "上海",
	Shanxi: "山西", Sichuan: "四川", Tianjin: "天津", Tibet: "西藏",
	Xinjiang: "新疆", Yunnan: "云南", Zhejiang: "浙江",
	"Hong Kong": "香港", Macau: "澳门", Taiwan: "台湾",
	// 常见国外州/区
	Bavaria: "巴伐利亚州", California: "加利福尼亚州", England: "英格兰",
	Scotland: "苏格兰", Wales: "威尔士", "New York": "纽约州", Texas: "得克萨斯州",
	Washington: "华盛顿州", Ontario: "安大略省", Quebec: "魁北克省",
	"British Columbia": "不列颠哥伦比亚省", "New South Wales": "新南威尔士州",
	Victoria: "维多利亚州", Queensland: "昆士兰州", Tokyo: "东京都",
};

// 英文城市名 → 中文（常见城市）
const CITY_CN: Record<string, string> = {
	// 中国主要城市
	Beijing: "北京", Shanghai: "上海", Guangzhou: "广州", Shenzhen: "深圳",
	Hangzhou: "杭州", Nanjing: "南京", Chengdu: "成都", Wuhan: "武汉",
	Changsha: "长沙", Zhengzhou: "郑州", Jinan: "济南", Qingdao: "青岛",
	Xiamen: "厦门", Fuzhou: "福州", Hefei: "合肥", Nanchang: "南昌",
	Ganzhou: "赣州", Tianjin: "天津", Chongqing: "重庆", Shenyang: "沈阳",
	Dalian: "大连", Harbin: "哈尔滨", "Xi'an": "西安", Lanzhou: "兰州",
	Kunming: "昆明", Guiyang: "贵阳", Nanning: "南宁", Haikou: "海口",
	Urumqi: "乌鲁木齐", Hohhot: "呼和浩特", Yinchuan: "银川", Xining: "西宁",
	Lhasa: "拉萨", "Hong Kong": "香港", Macau: "澳门", Taipei: "台北",
	// 国际主要城市
	Tokyo: "东京", Osaka: "大阪", Seoul: "首尔", Busan: "釜山",
	London: "伦敦", Paris: "巴黎", Berlin: "柏林", Munich: "慕尼黑",
	Nuremberg: "纽伦堡", Frankfurt: "法兰克福", Hamburg: "汉堡",
	Amsterdam: "阿姆斯特丹", Brussels: "布鲁塞尔", Vienna: "维也纳",
	Zurich: "苏黎世", Geneva: "日内瓦", Rome: "罗马", Milan: "米兰",
	Madrid: "马德里", Barcelona: "巴塞罗那", Lisbon: "里斯本",
	Moscow: "莫斯科", "Saint Petersburg": "圣彼得堡", Istanbul: "伊斯坦布尔",
	Dubai: "迪拜", "New York": "纽约", "Los Angeles": "洛杉矶",
	"San Francisco": "旧金山", Chicago: "芝加哥", Seattle: "西雅图",
	Boston: "波士顿", Washington: "华盛顿", Miami: "迈阿密",
	"Las Vegas": "拉斯维加斯", Houston: "休斯顿", Dallas: "达拉斯",
	Denver: "丹佛", Phoenix: "菲尼克斯", Toronto: "多伦多",
	Vancouver: "温哥华", Montreal: "蒙特利尔", Ottawa: "渥太华",
	Calgary: "卡尔加里", "Mexico City": "墨西哥城", "Sao Paulo": "圣保罗",
	"Rio de Janeiro": "里约热内卢", "Buenos Aires": "布宜诺斯艾利斯",
	Singapore: "新加坡", "Kuala Lumpur": "吉隆坡", Bangkok: "曼谷",
	Manila: "马尼拉", Jakarta: "雅加达", Hanoi: "河内",
	"Ho Chi Minh City": "胡志明市", Mumbai: "孟买", Delhi: "德里",
	Bangalore: "班加罗尔", Sydney: "悉尼", Melbourne: "墨尔本",
	Brisbane: "布里斯班", Perth: "珀斯", Auckland: "奥克兰",
	"Cape Town": "开普敦", Johannesburg: "约翰内斯堡", Cairo: "开罗",
};

// 英文格式：City, Region, Country
function locationEn(info: IpInfo): string | undefined {
	const parts = [info.city, info.region, info.country].filter(Boolean);
	return parts.length ? parts.join(", ") : undefined;
}

// 中文格式：国家 + 省/州 + 城市（仅拼接有中文映射的部分，不混语言）
function locationZh(info: IpInfo): string | undefined {
	const parts = [
		info.countryCode ? COUNTRY_NAMES[info.countryCode] : undefined,
		info.region ? REGION_CN[info.region] : undefined,
		info.city ? CITY_CN[info.city] : undefined,
	].filter(Boolean);
	return parts.length ? parts.join("") : undefined;
}

// 双语显示：中文一行 + 英文一行（换行分隔，不串行）
function locationText(info: IpInfo): string | undefined {
	const zh = locationZh(info);
	const en = locationEn(info);
	if (zh) return en ? `${zh}\n${en}` : zh;
	return en;
}

function coordinateText(info: IpInfo): string | undefined {
	if (info.latitude == null || info.longitude == null) return undefined;
	return `${info.latitude.toFixed(4)}, ${info.longitude.toFixed(4)}`;
}

function InfoBlock({ label, value }: { label: string; value?: string | number }) {
	return (
		<div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 dark:border-gray-800 dark:bg-gray-800/40">
			<p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
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

	return (
		<PageLayout title="IP 查询" subtitle="IP LOOKUP">
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

				</div>
		</PageLayout>
	);
}
