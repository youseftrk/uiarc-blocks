import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  UIARC_COMPONENTS,
  UIARC_COMPONENTS_BY_NAME,
} from "@/lib/uiarc-catalog";
import { ThemeToggle } from "../../theme-toggle";
import styles from "../components-catalog.module.css";
import { ComponentPreview } from "./component-preview";

export default async function ComponentDetailPage({
  params,
}: PageProps<"/components/[slug]">) {
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
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brandRow}>
            <Link href="/" className={styles.brandLink}>
              UIarc
            </Link>
            <nav className={styles.navLinks} aria-label="Main navigation">
              <Link href="/" className={styles.navLink}>
                Blocks
              </Link>
              <Link
                href="/components"
                className={`${styles.navLink} ${styles.navLinkActive}`}
              >
                Components ({UIARC_COMPONENTS.length})
              </Link>
            </nav>
          </div>
          <ThemeToggle className={styles.themeBtn} />
        </div>
      </header>

      <main className={styles.detailWrap}>
        <Link href="/components" className={styles.backLink}>
          <ArrowLeft size={14} aria-hidden="true" />
          All components
        </Link>

        <div className={styles.detailHead}>
          <div>
            <h1 className={styles.title}>{item.title}</h1>
            <p className={styles.subtitle}>{item.description}</p>
          </div>
          <div className={styles.badges}>
            <span className={styles.catBadge}>{item.category}</span>
            {item.tier === "pro" ? (
              <span className={styles.proBadge}>Pro</span>
            ) : (
              <span className={styles.freeBadge}>Free</span>
            )}
          </div>
        </div>

        <section className={styles.stage} aria-label={`${item.title} live preview`}>
          <ComponentPreview slug={item.name} />
        </section>

        <nav className={styles.detailNav} aria-label="Adjacent components">
          <div>
            {prev && (
              <Link href={`/components/${prev.name}`} className={styles.detailNavLink}>
                <span className={styles.detailNavLabel}>Previous</span>
                <span>{prev.title}</span>
              </Link>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            {next && (
              <Link href={`/components/${next.name}`} className={styles.detailNavLink}>
                <span className={styles.detailNavLabel}>Next</span>
                <span>{next.title}</span>
              </Link>
            )}
          </div>
        </nav>
      </main>
    </div>
  );
}
