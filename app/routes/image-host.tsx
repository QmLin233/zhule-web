import type { Route } from "./+types/image-host";
import { PlaceholderPage } from "../components/PlaceholderPage";

export function meta({}: Route.MetaArgs) {
	return [{ title: "图床 | 逐乐" }];
}

export default function ImageHost() {
	return <PlaceholderPage title="图床" />;
}
