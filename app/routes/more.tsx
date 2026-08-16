import type { Route } from "./+types/more";
import { PlaceholderPage } from "../components/PlaceholderPage";

export function meta({}: Route.MetaArgs) {
	return [{ title: "更多 | 逐乐" }];
}

export default function More() {
	return <PlaceholderPage title="更多" />;
}
