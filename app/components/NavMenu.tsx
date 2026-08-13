import { useState } from "react";
import { Link } from "react-router";

const menuItems = [
	{ to: "/download", label: "下载", en: "Download" },
	{ to: "/ip", label: "IP 查询", en: "IP Lookup" },
	{ to: "/image-host", label: "图床", en: "Image Host" },
	{ to: "/game", label: "游戏", en: "Game" },
	{ to: "/more", label: "更多", en: "More" },
	{ to: "/settings", label: "设置", en: "Settings" },
];

export function NavMenu() {
	const [open, setOpen] = useState(false);

	return (
		<header className="sticky top-0 z-50">
			<nav className="mx-auto flex h-12 max-w-6xl items-center justify-between px-6">
				{/* 回到主页（双圆圈 logo） */}
				<Link
					to="/"
					aria-label="回到主页"
					className="relative flex h-9 w-9 items-center justify-center text-gray-900 transition-opacity hover:opacity-70"
				>
					<svg
						width="36"
						height="36"
						viewBox="0 0 100 100"
						fill="none"
						aria-hidden="true"
					>
						<circle
							cx="50"
							cy="50"
							r="34"
							stroke="currentColor"
							strokeWidth="5"
						/>
						<circle
							cx="50"
							cy="50"
							r="21"
							stroke="currentColor"
							strokeWidth="5"
						/>
					</svg>
				</Link>

				{/* 汉堡菜单按钮 + 下拉菜单（右上角） */}
				<div className="relative">
					<button
						type="button"
						onClick={() => setOpen((v) => !v)}
						className="flex h-9 w-9 items-center justify-center rounded-md text-gray-900 transition-colors hover:bg-gray-100"
						aria-label="菜单"
						aria-expanded={open}
					>
						{/* 三横杠图标 */}
						<svg
							width="20"
							height="20"
							viewBox="0 0 20 20"
							fill="none"
							aria-hidden="true"
						>
							<path
								d="M2 5h16M2 10h16M2 15h16"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
							/>
						</svg>
					</button>

					{/* 下拉菜单（与按钮右对齐） */}
					{open && (
						<>
							{/* 半透明遮罩：点击外部关闭 */}
							<div
								className="fixed inset-0 z-40 bg-black/5"
								onClick={() => setOpen(false)}
							/>
							<div className="absolute right-0 top-10 z-50 w-44 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg">
								{menuItems.map((item) => (
									<Link
										key={item.to}
										to={item.to}
										onClick={() => setOpen(false)}
										className="flex items-baseline justify-between px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
									>
										<span>{item.label}</span>
										<span className="text-xs text-gray-400">
											{item.en}
										</span>
									</Link>
								))}
							</div>
						</>
					)}
				</div>
			</nav>
		</header>
	);
}
