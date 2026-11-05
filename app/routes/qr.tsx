import { useMemo, useRef, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import type { Route } from "./+types/qr";
import { PageLayout } from "../components/PageLayout";
import { pageMeta } from "../lib/meta";
import { useI18n } from "../lib/i18n";

export function meta({}: Route.MetaArgs) {
	return pageMeta("二维码");
}

/** 纠错等级 M 的二维码理论容量约 2331 字节，取 2000 留出余量 */
const MAX_BYTES = 2000;

export default function Qr() {
	const { t } = useI18n();
	const [value, setValue] = useState("");
	const canvasRef = useRef<HTMLCanvasElement>(null);

	const content = value.trim();
	const bytes = useMemo(
		() => (content ? new TextEncoder().encode(content).length : 0),
		[content],
	);
	const tooLong = bytes > MAX_BYTES;
	const ready = content.length > 0 && !tooLong;

	// 下载用隐藏的高分辨率画布，保证导出的 PNG 清晰可扫
	const handleDownload = () => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const link = document.createElement("a");
		link.href = canvas.toDataURL("image/png");
		link.download = `zhule-qrcode-${Date.now()}.png`;
		link.click();
	};

	return (
		<PageLayout title={t("qr.title")}>
			<div className="mt-10 space-y-6">
				{/* 输入区 */}
				<section className="rounded-2xl border border-gray-200 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/70">
					<label
						htmlFor="qr-content"
						className="text-sm font-medium text-gray-800 dark:text-gray-100"
					>
						{t("qr.inputLabel")}
					</label>
					<textarea
						id="qr-content"
						value={value}
						onChange={(e) => setValue(e.target.value)}
						rows={3}
						placeholder={t("qr.placeholder")}
						className="mt-2 w-full resize-y rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-gray-500"
					/>
					<div className="mt-2 flex items-start justify-between gap-4 text-xs">
						<span className={tooLong ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-gray-500"}>
							{tooLong ? t("qr.tooLong") : t("qr.hint")}
						</span>
						{bytes > 0 && (
							<span className="shrink-0 tabular-nums text-gray-400 dark:text-gray-500">
								{bytes} / {MAX_BYTES}
							</span>
						)}
					</div>

					<div className="mt-4 flex gap-3">
						<button
							type="button"
							onClick={handleDownload}
							disabled={!ready}
							className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
						>
							{t("qr.download")}
						</button>
						<button
							type="button"
							onClick={() => setValue("")}
							disabled={value.length === 0}
							className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
						>
							{t("qr.clear")}
						</button>
					</div>
				</section>

				{/* 预览区：二维码始终白底黑码，保证可扫 */}
				<section className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/70">
					{ready ? (
						<div className="rounded-xl bg-white p-4">
							<QRCodeSVG
								value={content}
								size={240}
								level="M"
								marginSize={0}
								bgColor="#ffffff"
								fgColor="#000000"
								aria-label={t("qr.title")}
							/>
						</div>
					) : (
						<p className="text-sm text-gray-400 dark:text-gray-500">
							{t("qr.empty")}
						</p>
					)}
				</section>
			</div>

			{/* 隐藏的下载画布：1024px 输出，不参与布局 */}
			<div aria-hidden="true" className="hidden">
				{ready && (
					<QRCodeCanvas
						ref={canvasRef}
						value={content}
						size={1024}
						level="M"
						marginSize={4}
						bgColor="#ffffff"
						fgColor="#000000"
					/>
				)}
			</div>
		</PageLayout>
	);
}
