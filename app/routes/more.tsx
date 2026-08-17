import type { Route } from "./+types/more";
import { PlaceholderPage } from "../components/PlaceholderPage";
import { useI18n } from "../lib/i18n";

export function meta({}: Route.MetaArgs) {
	return [{ title: "更多 | 逐乐" }];
}

export default function More() {
	const { t } = useI18n();
	return <PlaceholderPage title={t("more.title")} />;
}
