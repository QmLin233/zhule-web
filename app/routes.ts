import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("download", "routes/download.tsx"),
	route("ip", "routes/ip.tsx"),
	route("api/ip", "routes/api.ip.ts"),
	route("api/download", "routes/api.download.ts"),
	route("api/rules", "routes/api.rules.ts"),
	route("api/auth", "routes/api.auth.ts"),
	route("image-host", "routes/image-host.tsx"),
	route("game", "routes/game.tsx"),
	route("more", "routes/more.tsx"),
	route("settings", "routes/settings.tsx"),
	route("rules", "routes/rules.tsx"),
	route("admin", "routes/admin.tsx"),
] satisfies RouteConfig;
