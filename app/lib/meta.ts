/** 生成统一格式的页面 meta：标题 + 描述 */
export function pageMeta(title: string, description = "逐乐 ZHU LE") {
	return [
		{ title: `${title} | 逐乐` },
		{ name: "description", content: description },
	];
}
