/**
 * 内存速率限制器。
 * 适用于 Cloudflare Workers 单实例场景；跨实例需用 KV/Durable Objects。
 */

export interface RateLimiter {
	/** 判断是否触发限制 */
	isLimited(key: string): boolean;
	/** 记录一次尝试 */
	record(key: string): void;
}

/**
 * 创建速率限制器。
 * @param maxAttempts 窗口内最大允许次数
 * @param windowMs 时间窗口（毫秒）
 * @param maxEntries 最大缓存条目数（防内存泄漏）
 */
export function createRateLimiter(
	maxAttempts: number,
	windowMs: number,
	maxEntries = 1000,
): RateLimiter {
	const attempts = new Map<string, number[]>();

	function cleanup(): void {
		const now = Date.now();
		for (const [key, timestamps] of attempts) {
			const recent = timestamps.filter((t) => now - t < windowMs);
			if (recent.length === 0) {
				attempts.delete(key);
			} else {
				attempts.set(key, recent);
			}
		}
	}

	return {
		isLimited(key: string): boolean {
			const now = Date.now();
			const timestamps = attempts.get(key) || [];
			const recent = timestamps.filter((t) => now - t < windowMs);
			attempts.set(key, recent);
			return recent.length >= maxAttempts;
		},

		record(key: string): void {
			if (attempts.size > maxEntries) {
				cleanup();
			}
			const timestamps = attempts.get(key) || [];
			timestamps.push(Date.now());
			attempts.set(key, timestamps);
		},
	};
}
