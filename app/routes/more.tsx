import type { Route } from "./+types/more";
import { NavMenu } from "../components/NavMenu";

export function meta({}: Route.MetaArgs) {
	return [{ title: "更多 | 逐乐" }];
}

export default function More() {
	return (
		<div className="flex min-h-screen flex-col bg-cream text-gray-900 dark:bg-gray-950 dark:text-gray-100">
			<NavMenu />
			<main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
				<h1 className="text-4xl font-semibold tracking-tight">更多</h1>
				<p className="mt-4 text-gray-400 dark:text-gray-500">功能开发中，敬请期待</p>
			</main>
		</div>
	);
}
