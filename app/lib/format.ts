/** 字节数格式化为人类可读字符串 */
export function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** 提取文件名扩展名（大写），无扩展名返回 FILE */
export function fileExt(name: string): string {
	const i = name.lastIndexOf(".");
	return i >= 0 ? name.slice(i + 1).toUpperCase() : "FILE";
}

/** 常见文件类型的颜色徽章样式（亮/暗色） */
export function extColor(ext: string): string {
	const map: Record<string, string> = {
		APK: "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300",
		IPA: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300",
		ZIP: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300",
		RAR: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300",
		"7Z": "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300",
		EXE: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300",
		PDF: "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300",
	};
	return map[ext] ?? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
}
