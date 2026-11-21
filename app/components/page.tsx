import type { Metadata } from "next";
import { ComponentsCatalog } from "./components-catalog";

export const metadata: Metadata = {
  title: "Components — UIarc",
  description: "All 252 UIArc components (121 Free MIT + 131 Pro) with live interactive previews.",
};

export default function ComponentsPage() {
  return <ComponentsCatalog />;
}
