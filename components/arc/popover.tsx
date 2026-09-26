"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import styles from "./popover.module.css";
import { cx } from "./tokens";

export const Popover = PopoverPrimitive.Root;
export const PopoverClose = PopoverPrimitive.Close;

export const PopoverTrigger = forwardRef<
  ElementRef<typeof PopoverPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof PopoverPrimitive.Trigger>
>(function PopoverTrigger({ className, ...props }, ref) {
  return (
    <PopoverPrimitive.Trigger
      {...props}
      ref={ref}
      className={cx(styles.anchor, className)}
    />
  );
});

export const PopoverContent = forwardRef<
  ElementRef<typeof PopoverPrimitive.Content>,
  ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(function PopoverContent(
  { className, align = "start", sideOffset = 6, collisionPadding = 10, ...props },
  ref,
) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        {...props}
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cx(styles.content, className)}
      />
    </PopoverPrimitive.Portal>
  );
});
