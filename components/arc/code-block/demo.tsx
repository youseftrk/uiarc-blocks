"use client";

import { CodeBlock } from "./code-block";

const snippet = `export default function hello() {
  return "world";
}`;

export default function Example() {
  return <CodeBlock code={snippet} filename="hello.ts" language="ts" maxLines={12} />;
}
