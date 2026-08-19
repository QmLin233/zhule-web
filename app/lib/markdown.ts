import { Marked } from "marked";
import markedKatex from "marked-katex-extension";
import DOMPurify from "dompurify";

const marked = new Marked({ breaks: true });
marked.use(
	markedKatex({
		throwOnError: false,
		output: "html",
	}),
);

/** 将 Markdown（含 KaTeX 公式）渲染为安全的 HTML */
export function renderMarkdown(md: string): string {
	const raw = marked.parse(md) as string;
	// SSR 时 DOMPurify.sanitize 会尝试访问 window，
	// 在 Cloudflare Workers 中没有 window，需传入空对象防止报错
	try {
		return DOMPurify.sanitize(raw, {
			ADD_TAGS: ["math", "mrow", "mi", "mo", "mn", "msup", "msub", "mfrac", "semantics", "annotation"],
			ADD_ATTR: ["mathvariant", "mathsize"],
		});
	} catch {
		// SSR 环境降级：剥离所有 HTML 标签，只保留纯文本
		// 比返回未净化的 raw HTML 更安全，前端 hydrate 后会重新渲染并 sanitize
		return raw.replace(/<[^>]*>/g, "");
	}
}
