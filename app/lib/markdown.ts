import { Marked } from "marked";
import markedKatex from "marked-katex-extension";
import DOMPurify from "dompurify";

const marked = new Marked();

marked.use(
	{
		breaks: true,
	},
	markedKatex({
		throwOnError: false,
		output: "html",
	}),
);

/** 将 Markdown（含 KaTeX 公式）渲染为安全的 HTML */
export function renderMarkdown(md: string): string {
	const raw = marked.parse(md) as string;
	return DOMPurify.sanitize(raw, {
		ADD_TAGS: ["math", "mrow", "mi", "mo", "mn", "msup", "msub", "mfrac", "semantics", "annotation"],
		ADD_ATTR: ["mathvariant", "mathsize"],
	});
}
