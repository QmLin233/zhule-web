import type { Route } from "./+types/more";
import { Link } from "react-router";
import { PageLayout } from "../components/PageLayout";
import { useI18n } from "../lib/i18n";

export function meta({}: Route.MetaArgs) {
	return [{ title: "更多 | 逐乐" }];
}

const features = [
	{
		to: "/ip",
		labelKey: "nav.ip",
		icon: (
			<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
				<circle cx="12" cy="12" r="10" />
				<path d="M2 12h20" />
				<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
			</svg>
		),
	},
	{
		to: "/qr",
		labelKey: "qr.title",
		icon: (
			<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
				<rect x="3" y="3" width="7" height="7" rx="1" />
				<rect x="14" y="3" width="7" height="7" rx="1" />
				<rect x="3" y="14" width="7" height="7" rx="1" />
				<path d="M14 14h3v3h-3z" />
				<path d="M20 17v4h-4" />
			</svg>
		),
	},
	{
		to: "/video",
		labelKey: "video.title",
		icon: (
			<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
				<rect x="2.5" y="5" width="19" height="14" rx="3" />
				<path d="M10 9.5l5 2.5-5 2.5z" />
			</svg>
		),
	},
];

export default function More() {
	const { t } = useI18n();
	return (
		<PageLayout title={t("more.title")}>
			<div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
				{features.map((f) => (
					<Link
						key={f.to}
						to={f.to}
						className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white/70 p-6 transition-colors hover:border-gray-300 hover:bg-white dark:border-gray-800 dark:bg-gray-900/70 dark:hover:border-gray-700 dark:hover:bg-gray-900"
					>
						<span className="text-gray-800 dark:text-gray-200">{f.icon}</span>
						<span className="text-sm font-medium text-gray-800 dark:text-gray-200">
							{t(f.labelKey)}
						</span>
					</Link>
				))}
			</div>
		</PageLayout>
	);
}
