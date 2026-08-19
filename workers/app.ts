import { createRequestHandler } from "react-router";

declare module "react-router" {
	export interface AppLoadContext {
		cloudflare: {
			env: Env;
			ctx: ExecutionContext;
		};
		/**
		 * Cloudflare 边缘地理信息（原始 request.cf）。
		 * 在入口 fetch 里提前捕获，避免 React Router 处理请求时把 cf 剥离，
		 * 供 loader（如 /api/ip）通过 context.cf 读取。
		 */
		cf?: Record<string, unknown>;
	}
}

const requestHandler = createRequestHandler(
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE,
);

export default {
	async fetch(request, env, ctx) {
		const response = await requestHandler(request, {
			cloudflare: { env, ctx },
			cf: (request as unknown as { cf?: Record<string, unknown> }).cf,
		});

		// 统一安全响应头（HTML 与 API 均生效）
		const headers = new Headers(response.headers);
		headers.set("X-Content-Type-Options", "nosniff");
		headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
		headers.set("X-Frame-Options", "DENY");
		headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
		headers.set(
			"Content-Security-Policy",
			"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: cdn.zhule.org; font-src 'self' data:; connect-src 'self' https://api6.ipify.org https://api4.ipify.org https://api.ipchaxun.com.cn https://ip-api.com https://www.cloudflare.com;",
		);
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	},
} satisfies ExportedHandler<Env>;
