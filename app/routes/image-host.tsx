import { useState } from "react";
import { useLoaderData } from "react-router";
import type { Route } from "./+types/image-host";
import { PageLayout } from "../components/PageLayout";
import { formatSize } from "../lib/format";
import { pageMeta } from "../lib/meta";
import { listR2Objects, type R2Item } from "../lib/r2";
import { useI18n } from "../lib/i18n";

export function meta({}: Route.MetaArgs) {
	return pageMeta("图床");
}

// 从 R2 读取 image/ 前缀下的图片（自动过滤 0 字节文件夹占位对象）
export async function loader({ context }: Route.LoaderArgs) {
	const images = await listR2Objects(
		context.cloudflare.env.FILES,
		"image/",
		context.cloudflare.env.PUBLIC_BUCKET_URL,
	);
	return { images };
}

/** 单张图片卡片：缩略图 + 下载/复制按钮 */
function ImageCard({ img }: { img: R2Item }) {
	const [copied, setCopied] = useState(false);
	const { t } = useI18n();

	async function copyLink(url: string) {
		try {
			await navigator.clipboard.writeText(url);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1500);
		} catch {
			// 剪贴板不可用时忽略
		}
	}

	return (
		<div className="overflow-hidden rounded-2xl border border-gray-200 bg-white/70 dark:border-gray-800 dark:bg-gray-900/70">
			<div className="aspect-square w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
				<img
					src={img.url}
					alt={img.name}
					loading="lazy"
					decoding="async"
					className="h-full w-full object-cover image-rendering-auto"
				/>
			</div>
			<div className="p-3">
				<p className="truncate text-sm font-medium">{img.name}</p>
				<p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
					{formatSize(img.size)}
					{img.uploadedAt ? ` · ${img.uploadedAt}` : ""}
				</p>
				<div className="mt-2 grid grid-cols-2 gap-2">
					<a
						href={`/api/download?key=${encodeURIComponent(img.key)}`}
						className="rounded-lg bg-gray-900 px-3 py-1.5 text-center text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
					>
						{t("download.downloadBtn")}
					</a>
					<button
						type="button"
						onClick={() => copyLink(img.url)}
						className="rounded-lg bg-gray-100 px-3 py-1.5 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
					>
						{copied ? t("imageHost.copied") : t("imageHost.copyLink")}
					</button>
				</div>
			</div>
		</div>
	);
}

export default function ImageHost() {
	const { images } = useLoaderData<typeof loader>();
	const { t } = useI18n();

	return (
		<PageLayout title={t("imageHost.title")} maxWidth="max-w-4xl">
			<section className="mt-10">
				{images.length === 0 ? (
					<div className="mt-3 rounded-2xl border border-gray-200 bg-white/70 p-10 text-center text-sm text-gray-400 dark:border-gray-800 dark:bg-gray-900/70 dark:text-gray-500">
						0 items
					</div>
				) : (
					<div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
						{images.map((img) => (
							<ImageCard key={img.key} img={img} />
						))}
					</div>
				)}
			</section>
		</PageLayout>
	);
}
