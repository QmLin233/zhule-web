import type { Route } from "./+types/game";
import { PageLayout } from "../components/PageLayout";
import { Game2048 } from "../components/Game2048";
import { pageMeta } from "../lib/meta";
import { useI18n } from "../lib/i18n";

export function meta({}: Route.MetaArgs) {
	return pageMeta("游戏");
}

export default function Game() {
	const { t } = useI18n();

	return (
		<PageLayout title={t("game.title")} maxWidth="max-w-2xl">
			<Game2048 />
		</PageLayout>
	);
}
