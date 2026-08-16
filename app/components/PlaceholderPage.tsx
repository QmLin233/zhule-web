import { NavMenu } from "./NavMenu";

/**
 * 占位页通用骨架：功能开发中的页面统一使用，避免每个路由重复一套布局。
 */
export function PlaceholderPage({ title }: { title: string }) {
	return (
		<div className="flex min-h-screen flex-col bg-cream text-gray-900 dark:bg-gray-950 dark:text-gray-100">
			<NavMenu />
			<main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
				<h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
				<p className="mt-4 text-gray-400 dark:text-gray-500">功能开发中，敬请期待</p>
			</main>
		</div>
	);
}
