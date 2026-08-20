import type { Route } from "./+types/rules";
import { useState, useEffect } from "react";
import { PageLayout } from "../components/PageLayout";
import { useI18n } from "../lib/i18n";
import { renderMarkdown } from "../lib/markdown";
import type { Rule } from "../lib/types";

export function meta({}: Route.MetaArgs) {
	return [{ title: "公告 | 逐乐" }];
}

export default function Rules() {
	const { t } = useI18n();
	const [rules, setRules] = useState<Rule[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchRules = async () => {
			try {
				const response = await fetch("/api/rules");
				const data = await response.json() as { success: boolean; data: Rule[]; error?: string };
				
				if (data.success) {
					setRules(data.data);
				} else {
					setError(data.error || t("admin.fetchError"));
				}
			} catch {
					setError(t("admin.networkError"));
			} finally {
				setLoading(false);
			}
		};

		fetchRules();
	}, []);

	return (
		<PageLayout title={t("rules.title")}>
			<div className="mx-auto max-w-4xl px-4 py-8">
				{loading ? (
					<div className="flex items-center justify-center py-12">
						<div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
					</div>
				) : error ? (
					<div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950">
						<p className="text-red-700 dark:text-red-300">{error}</p>
					</div>
				) : rules.length === 0 ? (
						<div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
						<p className="text-gray-500 dark:text-gray-400">{t("rules.empty")}</p>
					</div>
				) : (
					<div className="space-y-6">
						{rules.map((rule) => (
							<article
								key={rule.id}
									className={`rounded-2xl border p-6 transition-colors ${
									rule.important
										? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
										: "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
								}`}
							>
								<div className="flex items-start justify-between">
									<div>
										<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
											{rule.title}
											{!!rule.important && (
												<span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
													{t("admin.important")}
												</span>
											)}
										</h2>
										<time className="mt-1 block text-sm text-gray-500 dark:text-gray-400">
											{rule.date}
										</time>
									</div>
								</div>
									<div
										className="mt-4 prose prose-gray max-w-none dark:prose-invert"
										dangerouslySetInnerHTML={{ __html: renderMarkdown(rule.content) }}
									/>
							</article>
						))}
					</div>
				)}
			</div>
		</PageLayout>
	);
}