import { useLoaderData } from "react-router";
import type { Route } from "./+types/download";
import { PageLayout } from "../components/PageLayout";
import { extColor, fileExt, formatSize } from "../lib/format";
import { pageMeta } from "../lib/meta";
import { listR2Objects } from "../lib/r2";

export function meta({}: Route.MetaArgs) {
	return pageMeta("下载");
}

// 从 R2 读取 download/ 前缀下的文件（自动过滤 0 字节文件夹占位对象）
export async function loader({ context }: Route.LoaderArgs) {
	const files = await listR2Objects(
		context.cloudflare.env.FILES,
		"download/",
		context.cloudflare.env.PUBLIC_BUCKET_URL,
	);
	return { files };
}

export default function Download() {
	const { files } = useLoaderData<typeof loader>();

	return (
		<PageLayout title="下载" subtitle="DOWNLOADS">
			<section className="mt-10">
					<div className="flex items-center justify-between">
						<h2 className="text-lg font-medium tracking-tight">
							全部文件{" "}
							<span className="ml-1 text-sm font-normal text-gray-400 dark:text-gray-500">
								Files
							</span>
						</h2>
						<span className="text-xs text-gray-400 dark:text-gray-500">
							{files.length} 个 · items
						</span>
					</div>

					{files.length === 0 ? (
						<div className="mt-3 rounded-2xl border border-gray-200 bg-white/70 p-10 text-center text-sm text-gray-400 dark:border-gray-800 dark:bg-gray-900/70 dark:text-gray-500">
							暂无文件 · No files yet
						</div>
					) : (
						<div className="mt-3 space-y-2">
							{files.map((f) => (
								<div
									key={f.key}
									className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white/70 p-4 dark:border-gray-800 dark:bg-gray-900/70"
								>
									<div
										className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${extColor(
											fileExt(f.name),
										)}`}
									>
										{fileExt(f.name)}
									</div>
									<div className="min-w-0 flex-1">
										<p className="break-all text-sm font-medium leading-snug line-clamp-2">
											{f.name}
										</p>
										<p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
											{formatSize(f.size)}
											{f.uploadedAt ? ` · ${f.uploadedAt}` : ""}
										</p>
									</div>
									<a
										href={`/api/download?key=${encodeURIComponent(f.key)}`}
										className="shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
									>
										下载<span className="hidden sm:inline"> · Download</span>
									</a>
								</div>
							))}
						</div>
					)}
			</section>
		</PageLayout>
	);
}
