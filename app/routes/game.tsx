import type { Route } from "./+types/game";
import { NavMenu } from "../components/NavMenu";

export function meta({}: Route.MetaArgs) {
	return [{ title: "游戏 | 逐乐" }];
}

export default function Game() {
	return (
		<div className="flex min-h-screen flex-col bg-white text-gray-900">
			<NavMenu />
			<main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
				<h1 className="text-4xl font-semibold tracking-tight">游戏</h1>
				<p className="mt-4 text-gray-400">功能开发中，敬请期待</p>
			</main>
		</div>
	);
}
