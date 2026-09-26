import styles from "./pro-badge.module.css";
import { cx } from "./tokens";

export function ProBadge({
  size = "sm",
  className,
}: {
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cx(styles.badge, size === "md" && styles.md, className)}
      data-arc-pro-badge={size}
    >
      <span className={styles.label}>Pro</span>
    </span>
  );
}
