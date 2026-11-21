"use client";

import type { ComponentType, LazyExoticComponent } from "react";

/**
 * Populated automatically from every `components/arc/<slug>/demo.tsx`
 * using module-level `lazy(() => import(...))`.
 */
export const COMPONENT_DEMOS: Record<
  string,
  LazyExoticComponent<ComponentType>
> = {};
