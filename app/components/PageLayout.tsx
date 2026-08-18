import type { ReactNode } from "react";
import { NavMenu } from "./NavMenu";

/**
 * 页面统一骨架：顶部导航 + 居中页头（标题/英文副标题）+ 内容区。
 * 所有页面共用，保证整体风格一致。
 */
export function PageLayout({
	title,
	maxWidth = "max-w-3xl",
	children,
}: {
	title?: string;
	maxWidth?: string;
	children: ReactNode;
}) {
	return (
		<div className="flex min-h-screen flex-col bg-cream text-gray-900 dark:bg-gray-950 dark:text-gray-100">
			<NavMenu />
			<main className={`mx-auto w-full ${maxWidth} flex-1 px-6 py-10`}>
				{title && (
					<header className="text-center">
						<h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
					</header>
				)}
				{children}
			</main>
		</div>
	);
}
