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
	fetch(request, env, ctx) {
		return requestHandler(request, {
			cloudflare: { env, ctx },
			cf: (request as unknown as { cf?: Record<string, unknown> }).cf,
		});
	},
} satisfies ExportedHandler<Env>;
