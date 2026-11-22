import Link from "next/link";
import { notFound } from "next/navigation";
import { ComponentPreview } from "@/app/components/[slug]/component-preview";
import { ThemeToggle } from "@/app/theme-toggle";
import {
  UIARC_COMPONENTS,
  UIARC_COMPONENTS_BY_NAME,
} from "@/lib/uiarc-catalog";
import styles from "./preview.module.css";

export default async function PreviewPage({
  params,
}: PageProps<"/preview/[slug]">) {
  const { slug } = await params;
  const item = UIARC_COMPONENTS_BY_NAME[slug];
  if (!item) notFound();

  const idx = UIARC_COMPONENTS.findIndex((c) => c.name === slug);
  const prev = idx > 0 ? UIARC_COMPONENTS[idx - 1] : null;
  const next =
    idx >= 0 && idx < UIARC_COMPONENTS.length - 1
      ? UIARC_COMPONENTS[idx + 1]
      : null;

  return (
    <div className={styles.previewPage}>
      <div className={styles.stage}>
        <div className={styles.stageLook}>
          <ComponentPreview slug={item.name} />
        </div>
      </div>

      <div className={styles.topLeft}>
        <Link href="/" className={styles.backLink}>
          ← index
        </Link>
        <span className={styles.slugMeta}>
          {item.name} ({item.tier})
        </span>
      </div>

      <div className={styles.topRight}>
        {prev && (
          <Link href={`/preview/${prev.name}`} className={styles.iconBtn} title={prev.name}>
            ← prev
          </Link>
        )}
        {next && (
          <Link href={`/preview/${next.name}`} className={styles.iconBtn} title={next.name}>
            next →
          </Link>
        )}
        <ThemeToggle className={styles.iconBtn} />
      </div>
    </div>
  );
}
