"use client";

import { Component, type ReactNode, Suspense } from "react";
import { COMPONENT_DEMOS } from "@/lib/component-demos";

class PreviewBoundary extends Component<
  { children: ReactNode; slug: string },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ color: "var(--danger)", fontSize: 13 }}>
          Preview error for <code>{this.props.slug}</code>:{" "}
          {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}

export function ComponentPreview({ slug }: { slug: string }) {
  const Demo = COMPONENT_DEMOS[slug];

  if (!Demo) {
    return (
      <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
        Interactive preview for <code>{slug}</code> is being wired in.
      </div>
    );
  }

  return (
    <PreviewBoundary key={slug} slug={slug}>
      <Suspense
        fallback={
          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
            Loading preview...
          </div>
        }
      >
        <Demo />
      </Suspense>
    </PreviewBoundary>
  );
}
