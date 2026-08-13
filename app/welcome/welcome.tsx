import { NavMenu } from "../components/NavMenu";

export function Welcome() {
	return (
		<div className="flex min-h-screen flex-col bg-cream text-gray-900 dark:bg-gray-950 dark:text-gray-100">
			<NavMenu />

			{/* 主体：居中大标题 */}
			<main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
				<h1 className="text-6xl font-semibold tracking-tight sm:text-7xl md:text-8xl">
					逐乐
				</h1>
				<p className="mt-6 text-lg tracking-[0.3em] text-gray-400 dark:text-gray-500">ZHU LE</p>
			</main>

			{/* 底部信息 */}
			<footer className="pb-8 text-center text-sm text-gray-400 dark:text-gray-500">
				<p>QQ Group: 1090099236　|　Email: qmlin233@qq.com</p>
			</footer>
		</div>
	);
}
