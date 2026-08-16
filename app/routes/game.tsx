import type { Route } from "./+types/game";
import { PageLayout } from "../components/PageLayout";
import { Game2048 } from "../components/Game2048";
import { pageMeta } from "../lib/meta";

export function meta({}: Route.MetaArgs) {
	return pageMeta("游戏");
}

export default function Game() {
	return (
		<PageLayout title="游戏" maxWidth="max-w-2xl">
			<Game2048 />
		</PageLayout>
	);
}
