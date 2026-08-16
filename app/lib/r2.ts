/** R2 对象在页面中的展示条目 */
export type R2Item = {
	key: string;
	name: string;
	size: number;
	uploadedAt: string;
	url: string;
};

/**
 * R2 bucket 的最小可用结构（避免与具体类型版本耦合，
 * 兼容 wrangler types 生成的运行时类型与 @cloudflare/workers-types）。
 */
export type R2Listable = {
	list(options?: { prefix?: string }): Promise<{
		objects: Array<{
			key: string;
			size: number;
			uploaded: Date | null;
		}>;
	}>;
};

/**
 * 列出 R2 指定前缀下的对象并转为页面条目。
 *
 * 注意：R2 是扁平结构，「创建文件夹」会产生 0 字节的占位对象（key 以 "/" 结尾），
 * 这里统一过滤掉（`name.length > 0 && !name.endsWith("/")`），避免把文件夹列进列表。
 * 结果按上传日期倒序。R2 不可用时优雅降级为空数组。
 */
export async function listR2Objects(
	bucket: R2Listable,
	prefix: string,
	baseUrl: string,
): Promise<R2Item[]> {
	try {
		const list = await bucket.list({ prefix });
		const items: R2Item[] = list.objects
			.filter((o) => {
				const name = o.key.slice(prefix.length);
				return name.length > 0 && !name.endsWith("/");
			})
			// 按真实上传时间倒序（同一天上传也能稳定排序）
			.sort(
				(a, b) =>
					(b.uploaded?.getTime() ?? 0) - (a.uploaded?.getTime() ?? 0),
			)
			.map((o) => ({
				key: o.key,
				name: o.key.slice(prefix.length),
				size: o.size,
				uploadedAt: o.uploaded ? new Date(o.uploaded).toISOString().slice(0, 10) : "",
				url: `${baseUrl}/${o.key}`,
			}));
		return items;
	} catch {
		return [];
	}
}
