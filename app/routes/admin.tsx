import type { Route } from "./+types/admin";
import { useState, useEffect } from "react";
import { PageLayout } from "../components/PageLayout";
import { useI18n } from "../lib/i18n";

interface Announcement {
	id: string;
	title: string;
	content: string;
	date: string;
	important: boolean;
	createdAt: string;
	updatedAt: string;
}

export function meta({}: Route.MetaArgs) {
	return [{ title: "管理后台 | 逐乐" }];
}

export default function Admin() {
	const { t } = useI18n();
	const [authenticated, setAuthenticated] = useState(false);
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [loginError, setLoginError] = useState<string | null>(null);
	const [rules, setRules] = useState<Announcement[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showForm, setShowForm] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [formData, setFormData] = useState({
		title: "",
		content: "",
		important: false,
	});

	// 页面加载时检查登录状态
	useEffect(() => {
		(async () => {
			try {
				const res = await fetch("/api/auth");
				const data = await res.json() as { authenticated: boolean };
				if (data.authenticated) {
					setAuthenticated(true);
					fetchRules();
				} else {
					setLoading(false);
				}
			} catch {
				setLoading(false);
			}
		})();
	}, []);

	// 登录验证
	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			const res = await fetch("/api/auth", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username, password }),
			});
			const data = await res.json() as { success: boolean; error?: string };
			if (data.success) {
				setAuthenticated(true);
				setLoginError(null);
				fetchRules();
			} else {
				setLoginError(data.error || t("admin.loginError"));
			}
		} catch {
			setLoginError(t("admin.networkError"));
		}
	};

	// 获取公告列表
	const fetchRules = async () => {
		try {
			setLoading(true);
			const response = await fetch("/api/rules");
			const data = await response.json() as { success: boolean; data: Announcement[]; error?: string };
			
			if (data.success) {
				setRules(data.data);
			} else {
				setError(data.error || t("admin.fetchError"));
			}
		} catch (err) {
			setError(t("admin.networkError"));
		} finally {
			setLoading(false);
		}
	};

	// 未登录时显示登录表单
	if (!authenticated) {
		return (
			<PageLayout>
				<div className="flex min-h-[60vh] items-center justify-center">
					<div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
						<form onSubmit={handleLogin}>
							<div className="mb-4">
								<label htmlFor="username" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
									{t("admin.username")}
								</label>
								<input
									type="text"
									id="username"
									value={username}
									onChange={(e) => setUsername(e.target.value)}
									className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
									required
								/>
							</div>
							<div className="mb-4">
								<label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
									{t("admin.password")}
								</label>
								<input
									type="password"
									id="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
									required
								/>
							</div>
							{loginError && (
								<div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
									{loginError}
								</div>
							)}
							<button
								type="submit"
								className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
							>
								{t("admin.login")}
							</button>
						</form>
					</div>
				</div>
			</PageLayout>
		);
	}

	// 处理表单提交
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		
		try {
			const response = await fetch("/api/rules", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(formData),
			});
			
			const data = await response.json() as { success: boolean; data?: Announcement; error?: string };
			
			if (data.success) {
				setFormData({ title: "", content: "", important: false });
				setShowForm(false);
				fetchRules();
			} else {
				setError(data.error || t("admin.createError"));
			}
		} catch (err) {
			setError(t("admin.networkError"));
		}
	};

	// 删除群规
	const handleDelete = async (id: string) => {
		if (!confirm(t("admin.deleteConfirm"))) {
			return;
		}
		
		try {
			const response = await fetch(`/api/rules?id=${id}`, {
				method: "DELETE",
			});
			
			const data = await response.json() as { success: boolean; error?: string };
			
			if (data.success) {
				fetchRules();
			} else {
				setError(data.error || t("admin.deleteError"));
			}
		} catch (err) {
			setError(t("admin.networkError"));
		}
	};

	// 开始编辑
	const startEdit = (rule: Announcement) => {
		setEditingId(rule.id);
		setFormData({
			title: rule.title,
			content: rule.content,
			important: rule.important,
		});
		setShowForm(true);
	};

	// 取消编辑
	const cancelEdit = () => {
		setEditingId(null);
		setFormData({ title: "", content: "", important: false });
		setShowForm(false);
	};

	// 登出
	const handleLogout = async () => {
		await fetch("/api/auth", { method: "DELETE" });
		setAuthenticated(false);
		setRules([]);
		setUsername("");
		setPassword("");
	};

	return (
		<PageLayout>
			<div className="mx-auto max-w-6xl px-4 py-8">
				<div className="mb-8 flex items-center justify-between">
					<div>
						<p className="text-gray-600 dark:text-gray-400">
							{t("admin.subtitle")}
						</p>
					</div>
					<div className="flex gap-2">
						<button
							onClick={() => {
								setEditingId(null);
								setFormData({ title: "", content: "", important: false });
								setShowForm(true);
							}}
							className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
						>
							{t("admin.create")}
						</button>
						<button
							onClick={handleLogout}
							className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
						>
							{t("admin.logout")}
						</button>
					</div>
				</div>

				{error && (
					<div className="mb-4 rounded-md bg-red-50 p-4 dark:bg-red-900">
						<div className="flex">
							<div className="flex-shrink-0">
								<svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
									<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
								</svg>
							</div>
							<div className="ml-3">
								<h3 className="text-sm font-medium text-red-800 dark:text-red-200">
									{error}
								</h3>
							</div>
						</div>
					</div>
				)}

				{/* 创建/编辑表单 */}
				{showForm && (
					<div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
						<h2 className="mb-4 text-lg font-medium text-gray-900 dark:text-gray-100">
							{editingId ? t("admin.edit") : t("admin.create")}
						</h2>
						<form onSubmit={handleSubmit}>
							<div className="mb-4">
								<label htmlFor="title" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
									{t("admin.form.title")}
								</label>
								<input
									type="text"
									id="title"
									value={formData.title}
									onChange={(e) => setFormData({ ...formData, title: e.target.value })}
									className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
									required
								/>
							</div>
							<div className="mb-4">
								<label htmlFor="content" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
									{t("admin.form.content")}
								</label>
								<textarea
									id="content"
									value={formData.content}
									onChange={(e) => setFormData({ ...formData, content: e.target.value })}
									rows={4}
									className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
									required
								/>
							</div>
							<div className="mb-6">
								<div className="flex items-center">
									<input
										type="checkbox"
										id="important"
										checked={formData.important}
										onChange={(e) => setFormData({ ...formData, important: e.target.checked })}
										className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
									/>
									<label htmlFor="important" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
										{t("admin.form.important")}
									</label>
								</div>
							</div>
							<div className="flex justify-end space-x-3">
								<button
									type="button"
									onClick={cancelEdit}
									className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
								>
									{t("admin.form.cancel")}
								</button>
								<button
									type="submit"
									className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
								>
									{editingId ? t("admin.form.save") : t("admin.form.create")}
								</button>
							</div>
						</form>
					</div>
				)}

				{/* 群规列表 */}
				{loading ? (
					<div className="flex items-center justify-center py-12">
						<div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
					</div>
				) : rules.length === 0 ? (
						<div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
						<p className="text-gray-500 dark:text-gray-400">{t("admin.empty")}</p>
					</div>
				) : (
					<div className="space-y-4">
						{rules.map((rule) => (
							<div
								key={rule.id}
								className={`rounded-2xl border p-6 ${
								rule.important
										? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
										: "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
								}`}
							>
								<div className="flex items-start justify-between">
									<div className="flex-1">
										<div className="flex items-center">
											<h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
												{rule.title}
											</h3>
												{!!rule.important && (
												<span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
													{t("admin.important")}
												</span>
											)}
										</div>
										<time className="mt-1 block text-sm text-gray-500 dark:text-gray-400">
											{rule.date}
										</time>
										<p className="mt-3 text-gray-700 dark:text-gray-300">
											{rule.content}
										</p>
									</div>
									<div className="ml-4 flex space-x-2">
										<button
											onClick={() => startEdit(rule)}
											className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
										>
											{t("admin.edit")}
										</button>
										<button
											onClick={() => handleDelete(rule.id)}
											className="rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800"
										>
											{t("admin.delete")}
										</button>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</PageLayout>
	);
}