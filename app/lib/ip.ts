/**
 * IP 查询的统一数据结构。
 *
 * 前端页面（app/routes/ip.tsx）与后端接口（app/routes/api.ip.ts）共用，
 * 保证前后端字段一致，后续接入不同数据源（CF 边缘 / 第三方 API / GeoLite2）
 * 时只需保证返回该结构，前端无需改动。
 */
export type IpInfo = {
	/** 本次查询返回的 IP */
	ip: string;
	/** 原始查询词（查询"我的 IP"时与 ip 相同） */
	query: string;
	/** 国家名（中文优先，无则回退到代码映射） */
	country?: string;
	/** ISO 国家代码，如 CN / US */
	countryCode?: string;
	/** 省 / 州 */
	region?: string;
	/** 省 / 州代码 */
	regionCode?: string;
	/** 城市 */
	city?: string;
	/** 纬度 */
	latitude?: number;
	/** 经度 */
	longitude?: number;
	/** 时区，如 Asia/Shanghai */
	timezone?: string;
	/** 运营商 */
	isp?: string;
	/** 组织名 */
	org?: string;
	/** ASN，形如 AS13335 */
	asn?: string;
	/** Cloudflare 边缘节点代码（方案 1 独有），如 NRT / HKG */
	colo?: string;
	/** 是否移动网络 */
	mobile?: boolean;
	/** 是否代理 / VPN */
	proxy?: boolean;
	/** 是否数据中心 / 托管 */
	hosting?: boolean;
	/** 数据来源标识：cf | ip-api | geo */
	source?: string;
};

/**
 * ISO 国家代码 → 英文国家名。
 * 用于把 ipchaxun 返回的中文国家名翻译成英文（英文行显示），
 * 避免中英文混在一行。与前端 ip.tsx 的 COUNTRY_NAMES（code→中文）配套。
 */
export const COUNTRY_EN: Record<string, string> = {
	CN: "China",
	HK: "Hong Kong",
	MO: "Macao",
	TW: "Taiwan",
	US: "United States",
	JP: "Japan",
	KR: "South Korea",
	SG: "Singapore",
	GB: "United Kingdom",
	DE: "Germany",
	FR: "France",
	RU: "Russia",
	CA: "Canada",
	AU: "Australia",
	IN: "India",
	BR: "Brazil",
	NL: "Netherlands",
	SE: "Sweden",
	FI: "Finland",
	CH: "Switzerland",
	IT: "Italy",
	ES: "Spain",
	PL: "Poland",
	UA: "Ukraine",
	TR: "Turkey",
	SA: "Saudi Arabia",
	AE: "United Arab Emirates",
	TH: "Thailand",
	VN: "Vietnam",
	MY: "Malaysia",
	ID: "Indonesia",
	PH: "Philippines",
	NZ: "New Zealand",
	AR: "Argentina",
	MX: "Mexico",
	ZA: "South Africa",
	EG: "Egypt",
};
