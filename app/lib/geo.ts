import type { IpInfo } from "./ip";

/** ISO 国家代码 → 中文 */
export const COUNTRY_NAMES: Record<string, string> = {
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

/** 英文省/州名 → 中文（常见区域） */
export const REGION_CN: Record<string, string> = {
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

/** 英文城市名 → 中文（常见城市） */
export const CITY_CN: Record<string, string> = {
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

/** 中文格式：国家 + 省/州 + 城市（仅拼接有中文映射的部分） */
export function locationZh(info: IpInfo): string | undefined {
	const parts = [
		info.countryCode ? COUNTRY_NAMES[info.countryCode] : undefined,
		info.region ? REGION_CN[info.region] : undefined,
		info.city ? CITY_CN[info.city] : undefined,
	].filter(Boolean);
	return parts.length ? parts.join("") : undefined;
}
