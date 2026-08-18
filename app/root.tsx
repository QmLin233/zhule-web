import {
	isRouteErrorResponse,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import { I18nProvider } from "./lib/i18n";
import "./app.css";

export const links: Route.LinksFunction = () => [
	{ rel: "preconnect", href: "https://fonts.googleapis.com" },
	{
		rel: "preconnect",
		href: "https://fonts.gstatic.com",
		crossOrigin: "anonymous",
	},
	{
		rel: "stylesheet",
		href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
	},
	{
		rel: "stylesheet",
		href: "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css",
	},
];

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="zh-CN">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				{/* 渲染前应用主题，避免首帧闪烁（深色用户看到浅色） */}
				<script
					dangerouslySetInnerHTML={{
						__html: `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})();`,
					}}
				/>
				<Meta />
				<Links />
			</head>
			<body>
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	return (
		<I18nProvider>
			<Outlet />
		</I18nProvider>
	);
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	// 从 localStorage 读取语言设置（ErrorBoundary 在 I18nProvider 外部）
	let lang: "zh" | "en" = "zh";
	try {
		const stored = localStorage.getItem("lang");
		if (stored === "en") lang = "en";
	} catch {}

	const texts = {
		zh: {
			oops: "出错了",
			notFound: "404",
			notFoundDesc: "页面不存在",
			errorDesc: "发生了一个意外错误",
			backHome: "返回首页",
		},
		en: {
			oops: "Oops!",
			notFound: "404",
			notFoundDesc: "The requested page could not be found.",
			errorDesc: "An unexpected error occurred.",
			backHome: "Back to Home",
		},
	}[lang];

	let message = texts.oops;
	let details = texts.errorDesc;
	let stack: string | undefined;

	if (isRouteErrorResponse(error)) {
		message = error.status === 404 ? texts.notFound : "Error";
		details =
			error.status === 404
				? texts.notFoundDesc
				: error.statusText || details;
	} else if (import.meta.env.DEV && error && error instanceof Error) {
		details = error.message;
		stack = error.stack;
	}

	return (
		<main className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 text-center text-gray-900 dark:bg-gray-950 dark:text-gray-100">
			<h1 className="text-6xl font-semibold tracking-tight">{message}</h1>
			<p className="mt-4 text-gray-400 dark:text-gray-500">{details}</p>
			{stack && (
				<pre className="mt-6 w-full max-w-2xl overflow-x-auto rounded-2xl border border-gray-200 bg-white/70 p-4 text-left text-xs dark:border-gray-800 dark:bg-gray-900/70">
					<code>{stack}</code>
				</pre>
			)}
			<a
				href="/"
				className="mt-8 rounded-lg bg-gray-900 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
			>
				{texts.backHome}
			</a>
		</main>
	);
}
