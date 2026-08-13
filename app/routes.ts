import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("ip", "routes/ip.tsx"),
	route("image-host", "routes/image-host.tsx"),
	route("more", "routes/more.tsx"),
	route("settings", "routes/settings.tsx"),
] satisfies RouteConfig;
