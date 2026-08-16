import type { Route } from "./+types/home";
import { HomeHero } from "../components/HomeHero";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "逐乐" },
		{ name: "description", content: "逐乐 ZHU LE" },
	];
}

export default function Home() {
	return <HomeHero />;
}
