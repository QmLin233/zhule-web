/**
 * 共享类型定义。
 * 前后端共用的数据结构统一在此声明。
 */

/** 公告/群规（数据库表 rules 的完整字段） */
export interface Rule {
	id: string;
	title: string;
	content: string;
	date: string;
	important: boolean;
	createdAt: string;
	updatedAt: string;
}

/** 用户资料 */
export interface UserProfile {
	id: string;
	email: string;
	nickname: string;
	verified: number;
	created_at: string;
}

/** Cloudflare 边缘地理信息 */
export type CfGeo = {
	asn?: number;
	asOrganization?: string;
	colo?: string;
	country?: string;
	region?: string;
	regionCode?: string;
	city?: string;
	timezone?: string;
	latitude?: string;
	longitude?: string;
	continent?: string;
};
