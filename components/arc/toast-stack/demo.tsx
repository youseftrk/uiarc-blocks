"use client";

import { ToastStack, ToastStackProvider, useToastStack } from "./toast-stack";

function PublishButton() {
  const { toast, update } = useToastStack();
  async function publish() {
    const id = toast({ type: "loading", title: "Publishing" });
    await new Promise((r) => setTimeout(r, 900));
    update(id, { type: "success", title: "Published", action: { label: "View", onClick: () => {} } });
  }
  return (
    <button
      type="button"
      onClick={publish}
      style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: "pointer" }}
    >
      Publish
    </button>
  );
}

export default function ToastStackDemo() {
  return (
    <ToastStackProvider>
      <PublishButton />
      <ToastStack />
    </ToastStackProvider>
  );
}
