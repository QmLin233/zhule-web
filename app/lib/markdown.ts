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
	// DOMPurify 需要 window/DOM 环境；在 SSR（Cloudflare Workers）中
	// 使用 sanitize 净化，若无 DOM 环境则彻底剥离所有标签，
	// 确保不会将未经净化的 HTML 返回给客户端。
	try {
		return DOMPurify.sanitize(raw, {
			ADD_TAGS: ["math", "mrow", "mi", "mo", "mn", "msup", "msub", "mfrac", "semantics", "annotation"],
			ADD_ATTR: ["mathvariant", "mathsize"],
		});
	} catch {
		// SSR 环境无法运行 DOMPurify：使用全局正则剥离所有标签及内容，
		// 不返回任何 HTML，仅保留纯文本。前端 hydrate 后会重新渲染并 sanitize。
		return raw.replace(/<[^>]*>/g, "").replace(/</g, "&lt;");
	}
}
