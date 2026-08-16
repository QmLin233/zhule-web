import type { Route } from "./+types/game";
import { PlaceholderPage } from "../components/PlaceholderPage";

export function meta({}: Route.MetaArgs) {
	return [{ title: "游戏 | 逐乐" }];
}

export default function Game() {
	return <PlaceholderPage title="游戏" />;
}
