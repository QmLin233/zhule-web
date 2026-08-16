import { useState } from "react";
import { useLoaderData } from "react-router";
import type { Route } from "./+types/image-host";
import { PageLayout } from "../components/PageLayout";
import { formatSize } from "../lib/format";
import { pageMeta } from "../lib/meta";
import { listR2Objects } from "../lib/r2";

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

export default function ImageHost() {
	const { images } = useLoaderData<typeof loader>();
	const [copied, setCopied] = useState<string | null>(null);

	async function copyLink(url: string, name: string) {
		try {
			await navigator.clipboard.writeText(url);
			setCopied(name);
			window.setTimeout(() => setCopied(null), 1500);
		} catch {
			// 剪贴板不可用时忽略
		}
	}

	return (
		<PageLayout title="图床" subtitle="IMAGE HOST" maxWidth="max-w-4xl">
			<section className="mt-10">
					<div className="flex items-center justify-between">
						<h2 className="text-lg font-medium tracking-tight">
							全部图片{" "}
							<span className="ml-1 text-sm font-normal text-gray-400 dark:text-gray-500">
								Images
							</span>
						</h2>
						<span className="text-xs text-gray-400 dark:text-gray-500">
							{images.length} 张 · items
						</span>
					</div>

					{images.length === 0 ? (
						<div className="mt-3 rounded-2xl border border-gray-200 bg-white/70 p-10 text-center text-sm text-gray-400 dark:border-gray-800 dark:bg-gray-900/70 dark:text-gray-500">
							暂无图片 · No images yet
						</div>
					) : (
						<div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
							{images.map((img) => (
								<div
									key={img.key}
									className="overflow-hidden rounded-2xl border border-gray-200 bg-white/70 dark:border-gray-800 dark:bg-gray-900/70"
								>
									<div className="aspect-square w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
										<img
											src={img.url}
											alt={img.name}
											loading="lazy"
											className="h-full w-full object-cover"
										/>
									</div>
									<div className="p-3">
										<p className="truncate text-sm font-medium">{img.name}</p>
										<p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
											{formatSize(img.size)}
											{img.uploadedAt ? ` · ${img.uploadedAt}` : ""}
										</p>
										<button
											type="button"
											onClick={() => copyLink(img.url, img.name)}
											className="mt-2 w-full rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
										>
											{copied === img.name ? "已复制 · Copied ✓" : "复制链接 · Copy Link"}
										</button>
									</div>
								</div>
							))}
						</div>
					)}
				</section>
		</PageLayout>
	);
}
