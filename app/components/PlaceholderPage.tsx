import { PageLayout } from "./PageLayout";
import { useI18n } from "../lib/i18n";

/**
 * 占位页通用骨架：功能开发中的页面统一使用，避免每个路由重复一套布局。
 */
export function PlaceholderPage({ title }: { title: string }) {
	const { t } = useI18n();
	return (
		<PageLayout title={title}>
			<div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
				<p className="text-gray-400 dark:text-gray-500">{t("placeholder.developing")}</p>
			</div>
		</PageLayout>
	);
}
