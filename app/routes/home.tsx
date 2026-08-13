import type { Route } from "./+types/home";
import { Welcome } from "../welcome/welcome";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "逐乐" },
		{ name: "description", content: "逐乐 ZHU LE" },
	];
}

export default function Home() {
	return <Welcome />;
}
