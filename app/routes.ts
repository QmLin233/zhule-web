import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("download", "routes/download.tsx"),
	route("ip", "routes/ip.tsx"),
	route("image-host", "routes/image-host.tsx"),
	route("game", "routes/game.tsx"),
	route("more", "routes/more.tsx"),
	route("settings", "routes/settings.tsx"),
] satisfies RouteConfig;
