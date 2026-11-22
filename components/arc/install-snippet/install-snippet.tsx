"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertCircle, Check, Copy, KeyRound, Loader2 } from "lucide-react";
import styles from "./install-snippet.module.css";

export type InstallSnippetPackageManager = "npm" | "pnpm" | "yarn" | "bun";

export interface InstallSnippetFramework {
  id: string;
  label: string;
  install:
    | { packages: string[] }
    | { file: string; code: string };
  key: { file: string; code: string };
  code: { file: string; code: string };
}

export interface InstallSnippetProps {
  title?: ReactNode;
  description?: ReactNode;
  version?: ReactNode | null;
  frameworks?: InstallSnippetFramework[];
  framework?: string;
  defaultFramework?: string;
  onFrameworkChange?: (id: string) => void;
  packageManager?: InstallSnippetPackageManager;
  defaultPackageManager?: InstallSnippetPackageManager;
  onPackageManagerChange?: (id: InstallSnippetPackageManager) => void;
  apiKey?: string;
  keyPlaceholder?: string;
  generateKey?: (signal: AbortSignal) => Promise<string>;
  onKeyGenerated?: (key: string) => void;
  onCopy?: (step: "install" | "key" | "code", value: string) => void;
  className?: string;
}

const PACKAGE_MANAGERS: InstallSnippetPackageManager[] = [
  "npm",
  "pnpm",
  "yarn",
  "bun",
];

const DEFAULT_FRAMEWORKS: InstallSnippetFramework[] = [
  {
    id: "next",
    label: "Next.js",
    install: { packages: ["@lumen/next"] },
    key: {
      file: ".env.local",
      code: "NEXT_PUBLIC_LUMEN_KEY={{key}}",
    },
    code: {
      file: "app/layout.tsx",
      code: `import { LumenProvider } from "@lumen/next";

export default function Layout({ children }) {
  return (
    <LumenProvider apiKey={process.env.NEXT_PUBLIC_LUMEN_KEY}>
      {children}
    </LumenProvider>
  );
}`,
    },
  },
  {
    id: "react",
    label: "React",
    install: { packages: ["@lumen/react"] },
    key: {
      file: ".env",
      code: "VITE_LUMEN_KEY={{key}}",
    },
    code: {
      file: "src/main.tsx",
      code: `import { LumenProvider } from "@lumen/react";

createRoot(root).render(
  <LumenProvider apiKey={import.meta.env.VITE_LUMEN_KEY}>
    <App />
  </LumenProvider>,
);`,
    },
  },
  {
    id: "vue",
    label: "Vue",
    install: { packages: ["@lumen/vue"] },
    key: {
      file: ".env",
      code: "VITE_LUMEN_KEY={{key}}",
    },
    code: {
      file: "src/main.ts",
      code: `import { createApp } from "vue";
import { lumen } from "@lumen/vue";
import App from "./App.vue";

createApp(App)
  .use(lumen, { apiKey: import.meta.env.VITE_LUMEN_KEY })
  .mount("#app");`,
    },
  },
  {
    id: "html",
    label: "HTML",
    install: {
      file: "index.html",
      code: `<script src="https://cdn.lumen.dev/v2/lumen.min.js" defer></script>`,
    },
    key: {
      file: "index.html",
      code: `<meta name="lumen-key" content="{{key}}" />`,
    },
    code: {
      file: "index.html",
      code: `<script>
  window.addEventListener("load", () => {
    window.lumen?.track("page_view");
  });
</script>`,
    },
  },
];

function FrameworkMark({ id }: { id: string }) {
  if (id === "next") {
    return (
      <svg width="14" height="14" viewBox="0 0 180 180" fill="none" aria-hidden="true">
        <circle cx="90" cy="90" r="82" stroke="currentColor" strokeWidth="14" />
        <path d="M62 128V54l76 96" stroke="currentColor" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M122 54v52" stroke="currentColor" strokeWidth="14" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === "react") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="2.1" fill="currentColor" />
        <ellipse cx="12" cy="12" rx="10" ry="4" stroke="currentColor" strokeWidth="1.5" />
        <ellipse cx="12" cy="12" rx="10" ry="4" stroke="currentColor" strokeWidth="1.5" transform="rotate(60 12 12)" />
        <ellipse cx="12" cy="12" rx="10" ry="4" stroke="currentColor" strokeWidth="1.5" transform="rotate(120 12 12)" />
      </svg>
    );
  }
  if (id === "vue") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M2 4h4.5L12 13.5 17.5 4H22L12 21 2 4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M6.8 4 12 13 17.2 4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    );
  }
  if (id === "html") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M8 7 3 12l5 5M16 7l5 5-5 5M13.5 5l-3 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return null;
}

function PmMark({ id }: { id: InstallSnippetPackageManager }) {
  if (id === "npm") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 16V8h8v8h-3v-5h-2v5H8Z" fill="currentColor" />
      </svg>
    );
  }
  if (id === "pnpm") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="5" height="5" rx="0.8" fill="currentColor" />
        <rect x="9.5" y="3" width="5" height="5" rx="0.8" fill="currentColor" />
        <rect x="16" y="3" width="5" height="5" rx="0.8" fill="currentColor" />
        <rect x="9.5" y="9.5" width="5" height="5" rx="0.8" fill="currentColor" />
        <rect x="16" y="9.5" width="5" height="5" rx="0.8" fill="currentColor" />
        <rect x="3" y="16" width="5" height="5" rx="0.8" fill="currentColor" />
        <rect x="9.5" y="16" width="5" height="5" rx="0.8" fill="currentColor" />
        <rect x="16" y="16" width="5" height="5" rx="0.8" fill="currentColor" />
      </svg>
    );
  }
  if (id === "yarn") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8.5 8.5c2 2.5 5 4.5 7.5 6.5M15.5 8.5c-2.5 2-4.5 5-6.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <ellipse cx="12" cy="13" rx="8.5" ry="6.5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9.2" cy="12.5" r="1.1" fill="currentColor" />
      <circle cx="14.8" cy="12.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

function formatInstallCommand(
  pm: InstallSnippetPackageManager,
  packages: string[],
): string {
  const list = packages.join(" ");
  if (pm === "npm") return `npm install ${list}`;
  if (pm === "pnpm") return `pnpm add ${list}`;
  if (pm === "yarn") return `yarn add ${list}`;
  return `bun add ${list}`;
}

interface Token {
  type: "plain" | "kw" | "str" | "fn" | "tag" | "attr" | "num" | "cm" | "punct" | "key";
  value: string;
}

const TOKEN_RE =
  /(\{\{key\}\}|\/\/.*$|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\b(?:import|export|default|from|function|return|const|let|var|new|async|await)\b|<\/?[A-Za-z][A-Za-z0-9-]*|\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\()|\b\d+(?:\.\d+)?\b|\b[A-Za-z-]+(?==)|[{}()[\].,;:=<>?\/]+)/gm;

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(line)) !== null) {
    if (m.index > last) {
      tokens.push({ type: "plain", value: line.slice(last, m.index) });
    }
    const text = m[0];
    let type: Token["type"] = "plain";
    if (text === "{{key}}") type = "key";
    else if (text.startsWith("//")) type = "cm";
    else if (text.startsWith('"') || text.startsWith("'")) type = "str";
    else if (text.startsWith("<")) type = "tag";
    else if (/^(?:import|export|default|from|function|return|const|let|var|new|async|await)$/.test(text))
      type = "kw";
    else if (/^\d/.test(text)) type = "num";
    else if (/^[{}()[\].,;:=<>?/]+$/.test(text)) type = "punct";
    else if (line[m.index + text.length] === "=") type = "attr";
    else type = "fn";
    tokens.push({ type, value: text });
    last = m.index + text.length;
  }
  if (last < line.length) {
    tokens.push({ type: "plain", value: line.slice(last) });
  }
  return tokens;
}

function makeSimulatedKey(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "lm_live_";
  for (let i = 0; i < 16; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

const TAB_SPRING = { type: "spring" as const, visualDuration: 0.24, bounce: 0 };

function KeySlot({
  apiKey,
  placeholder,
  fresh,
  reduced,
}: {
  apiKey: string | null;
  placeholder: string;
  fresh: boolean;
  reduced: boolean;
}) {
  const text = apiKey ?? placeholder;
  const filled = apiKey !== null;

  return (
    <motion.span
      className={styles.keySlot}
      data-filled={filled ? "" : undefined}
      data-fresh={fresh ? "" : undefined}
      animate={{ width: `${text.length}ch` }}
      transition={
        reduced
          ? { duration: 0 }
          : { duration: 0.34, ease: [0.22, 1, 0.36, 1] }
      }
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          className={styles.keyText}
          initial={
            reduced
              ? { opacity: 1 }
              : { clipPath: "inset(0 100% 0 0)" }
          }
          animate={
            reduced
              ? { opacity: 1 }
              : { clipPath: "inset(0 0% 0 0)" }
          }
          exit={
            reduced
              ? { opacity: 0 }
              : { opacity: 0 }
          }
          transition={
            reduced
              ? { duration: 0 }
              : { duration: 0.34, ease: [0.22, 1, 0.36, 1] }
          }
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}

function HighlightedCode({
  code,
  showLineNumbers,
  apiKey,
  placeholder,
  freshKey,
  reduced,
}: {
  code: string;
  showLineNumbers: boolean;
  apiKey: string | null;
  placeholder: string;
  freshKey: boolean;
  reduced: boolean;
}) {
  const lines = useMemo(
    () => code.split("\n").map((line) => tokenizeLine(line)),
    [code],
  );

  return (
    <pre className={styles.pre}>
      <code>
        {lines.map((tokens, idx) => (
          <span key={idx} className={styles.line}>
            {showLineNumbers && (
              <span className={styles.ln} aria-hidden="true">
                {idx + 1}
              </span>
            )}
            {tokens.map((tok, ti) => {
              if (tok.type === "key") {
                return (
                  <KeySlot
                    key={ti}
                    apiKey={apiKey}
                    placeholder={placeholder}
                    fresh={freshKey}
                    reduced={reduced}
                  />
                );
              }
              if (tok.type === "plain") {
                return <span key={ti}>{tok.value}</span>;
              }
              return (
                <span key={ti} className={styles[tok.type]}>
                  {tok.value}
                </span>
              );
            })}
          </span>
        ))}
      </code>
    </pre>
  );
}

export function InstallSnippet({
  title = "Get started in 30 seconds",
  description = "Three steps to your first event.",
  version = "v2.4.0",
  frameworks = DEFAULT_FRAMEWORKS,
  framework: frameworkProp,
  defaultFramework,
  onFrameworkChange,
  packageManager: pmProp,
  defaultPackageManager = "npm",
  onPackageManagerChange,
  apiKey: apiKeyProp,
  keyPlaceholder = "YOUR_LUMEN_KEY",
  generateKey,
  onKeyGenerated,
  onCopy,
  className,
}: InstallSnippetProps) {
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const panelId = `${uid}-panel`;

  const [uncontrolledFw, setUncontrolledFw] = useState(
    defaultFramework ?? frameworks[0]?.id ?? "",
  );
  const fwControlled = frameworkProp !== undefined;
  const activeFwId = fwControlled ? frameworkProp : uncontrolledFw;
  const activeFw =
    frameworks.find((f) => f.id === activeFwId) ?? frameworks[0];

  const [uncontrolledPm, setUncontrolledPm] =
    useState<InstallSnippetPackageManager>(defaultPackageManager);
  const pmControlled = pmProp !== undefined;
  const activePm = pmControlled ? pmProp : uncontrolledPm;

  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [freshKey, setFreshKey] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [simulatedNotice, setSimulatedNotice] = useState(false);

  const [doneSteps, setDoneSteps] = useState<Record<"install" | "key" | "code", boolean>>({
    install: false,
    key: false,
    code: false,
  });
  const [copiedStep, setCopiedStep] = useState<"install" | "key" | "code" | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const freshTimerRef = useRef<number>(0);
  const copyTimerRef = useRef<number>(0);

  const fwTrackRef = useRef<HTMLDivElement>(null);
  const fwBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [fwRect, setFwRect] = useState<{ left: number; width: number } | null>(null);

  const pmTrackRef = useRef<HTMLDivElement>(null);
  const pmBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [pmRect, setPmRect] = useState<{ left: number; width: number } | null>(null);

  const effectiveKey = apiKeyProp ?? generatedKey;
  const isExternalKey = apiKeyProp !== undefined;

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      window.clearTimeout(freshTimerRef.current);
      window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const measureFwIndicator = useCallback(() => {
    const track = fwTrackRef.current;
    const btn = fwBtnRefs.current.get(activeFw.id);
    if (!track || !btn) return;
    const tr = track.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    setFwRect({ left: br.left - tr.left, width: br.width });
  }, [activeFw.id]);

  const measurePmIndicator = useCallback(() => {
    const track = pmTrackRef.current;
    const btn = pmBtnRefs.current.get(activePm);
    if (!track || !btn) return;
    const tr = track.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    setPmRect({ left: br.left - tr.left, width: br.width });
  }, [activePm]);

  useLayoutEffect(() => {
    measureFwIndicator();
  }, [measureFwIndicator, frameworks]);

  useLayoutEffect(() => {
    measurePmIndicator();
  }, [measurePmIndicator, activeFw.id]);

  useEffect(() => {
    const ro = new ResizeObserver(() => {
      measureFwIndicator();
      measurePmIndicator();
    });
    if (fwTrackRef.current) ro.observe(fwTrackRef.current);
    if (pmTrackRef.current) ro.observe(pmTrackRef.current);
    return () => ro.disconnect();
  }, [measureFwIndicator, measurePmIndicator]);

  const maxLines = useMemo(() => {
    let installLines = 1;
    let keyLines = 1;
    let codeLines = 1;
    for (const fw of frameworks) {
      if ("code" in fw.install) {
        installLines = Math.max(installLines, fw.install.code.split("\n").length);
      }
      keyLines = Math.max(keyLines, fw.key.code.split("\n").length);
      codeLines = Math.max(codeLines, fw.code.code.split("\n").length);
    }
    return { installLines, keyLines, codeLines };
  }, [frameworks]);

  const selectFramework = useCallback(
    (id: string) => {
      if (id === activeFw.id) return;
      if (!fwControlled) setUncontrolledFw(id);
      onFrameworkChange?.(id);
      const next = frameworks.find((f) => f.id === id);
      if (next) setAnnouncement(`Switched to ${next.label}`);
    },
    [activeFw.id, frameworks, fwControlled, onFrameworkChange],
  );

  const selectPm = useCallback(
    (pm: InstallSnippetPackageManager) => {
      if (pm === activePm) return;
      if (!pmControlled) setUncontrolledPm(pm);
      onPackageManagerChange?.(pm);
    },
    [activePm, onPackageManagerChange, pmControlled],
  );

  const handleFwKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const idx = frameworks.findIndex((f) => f.id === activeFw.id);
      let nextIdx = -1;
      if (e.key === "ArrowRight") nextIdx = (idx + 1) % frameworks.length;
      else if (e.key === "ArrowLeft")
        nextIdx = (idx - 1 + frameworks.length) % frameworks.length;
      else if (e.key === "Home") nextIdx = 0;
      else if (e.key === "End") nextIdx = frameworks.length - 1;
      else return;
      e.preventDefault();
      const target = frameworks[nextIdx];
      if (!target) return;
      selectFramework(target.id);
      fwBtnRefs.current.get(target.id)?.focus();
    },
    [activeFw.id, frameworks, selectFramework],
  );

  const handlePmKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const idx = PACKAGE_MANAGERS.indexOf(activePm);
      let nextIdx = -1;
      if (e.key === "ArrowRight") nextIdx = (idx + 1) % PACKAGE_MANAGERS.length;
      else if (e.key === "ArrowLeft")
        nextIdx = (idx - 1 + PACKAGE_MANAGERS.length) % PACKAGE_MANAGERS.length;
      else if (e.key === "Home") nextIdx = 0;
      else if (e.key === "End") nextIdx = PACKAGE_MANAGERS.length - 1;
      else return;
      e.preventDefault();
      const target = PACKAGE_MANAGERS[nextIdx];
      selectPm(target);
      pmBtnRefs.current.get(target)?.focus();
    },
    [activePm, selectPm],
  );

  const handleGenerate = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setGenerating(true);
    setGenError(null);

    try {
      let nextKey: string;
      if (generateKey) {
        nextKey = await generateKey(ac.signal);
        setSimulatedNotice(false);
      } else {
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(resolve, 260);
          ac.signal.addEventListener("abort", () => {
            window.clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
        nextKey = makeSimulatedKey();
        setSimulatedNotice(true);
      }
      if (ac.signal.aborted) return;
      setGeneratedKey(nextKey);
      setFreshKey(true);
      window.clearTimeout(freshTimerRef.current);
      freshTimerRef.current = window.setTimeout(() => setFreshKey(false), 750);
      setDoneSteps((prev) => ({ ...prev, key: true }));
      onKeyGenerated?.(nextKey);
      setAnnouncement(
        generateKey
          ? "API key generated and inserted into step 2."
          : "Sample API key generated locally and inserted into step 2.",
      );
    } catch (err) {
      if (ac.signal.aborted) return;
      setGenError(
        err instanceof Error && err.message
          ? err.message
          : "Could not create a key",
      );
      setAnnouncement("Failed to generate API key. Try again.");
    } finally {
      if (!ac.signal.aborted) setGenerating(false);
    }
  }, [generateKey, onKeyGenerated]);

  const copySnippet = useCallback(
    async (step: "install" | "key" | "code", raw: string) => {
      const resolved = raw.replaceAll("{{key}}", effectiveKey ?? keyPlaceholder);
      try {
        await navigator.clipboard?.writeText(resolved);
      } catch {
        // Ignore clipboard denial in restricted contexts
      }
      setCopiedStep(step);
      setDoneSteps((prev) => ({ ...prev, [step]: true }));
      onCopy?.(step, resolved);
      window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedStep((prev) => (prev === step ? null : prev));
      }, 1600);
    },
    [effectiveKey, keyPlaceholder, onCopy],
  );

  const installSnippetText =
    "packages" in activeFw.install
      ? formatInstallCommand(activePm, activeFw.install.packages)
      : activeFw.install.code;

  const swapTransition = reduced
    ? { duration: 0 }
    : { duration: 0.16, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <section
      className={className ? `${styles.root} ${className}` : styles.root}
    >
      <div className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <header className={styles.header}>
        <div className={styles.headerText}>
          <h3 className={styles.title}>{title}</h3>
          {description != null && (
            <p className={styles.subtitle}>{description}</p>
          )}
        </div>
        {version != null && <span className={styles.version}>{version}</span>}
      </header>

      <div className={styles.tabsWrap}>
        <div
          ref={fwTrackRef}
          role="tablist"
          aria-label="Framework"
          className={styles.tabs}
          style={{
            gridTemplateColumns: `repeat(${frameworks.length}, minmax(0, 1fr))`,
          }}
          onKeyDown={handleFwKeyDown}
        >
          {fwRect && (
            <motion.div
              className={styles.indicator}
              initial={false}
              animate={{ x: fwRect.left, width: fwRect.width }}
              transition={reduced ? { duration: 0 } : TAB_SPRING}
              aria-hidden="true"
            />
          )}
          {frameworks.map((fw) => {
            const selected = fw.id === activeFw.id;
            return (
              <button
                key={fw.id}
                ref={(el) => {
                  if (el) fwBtnRefs.current.set(fw.id, el);
                  else fwBtnRefs.current.delete(fw.id);
                }}
                type="button"
                role="tab"
                id={`${uid}-tab-${fw.id}`}
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                className={styles.tab}
                data-selected={selected ? "" : undefined}
                onClick={() => selectFramework(fw.id)}
              >
                <FrameworkMark id={fw.id} />
                <span className={styles.tabLabel}>{fw.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <ol
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${uid}-tab-${activeFw.id}`}
        className={styles.steps}
      >
        {/* Step 1: Install */}
        <li className={styles.step}>
          <span
            className={styles.circle}
            data-done={doneSteps.install ? "" : undefined}
            aria-hidden="true"
          >
            <span className={`${styles.swap} ${styles.circleSwap}`}>
              {doneSteps.install ? (
                <Check size={13} strokeWidth={2.2} />
              ) : (
                <span>1</span>
              )}
            </span>
          </span>

          <div className={styles.stepMain}>
            <div className={styles.stepHead}>
              <div className={styles.stepText}>
                <h4 className={styles.stepTitle}>
                  Install
                  {doneSteps.install && (
                    <span className={styles.srOnly}>, done</span>
                  )}
                </h4>
                <div className={`${styles.stepDesc} ${styles.swap}`}>
                  <span className={`${styles.stepDescItem} ${styles.swapItem}`}>
                    {"packages" in activeFw.install
                      ? "Add the SDK package to your project."
                      : "Load the script tag in your page head."}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.code}>
              <div className={styles.codeHead}>
                <div className={styles.codeHeadMain}>
                  {"packages" in activeFw.install ? (
                    <div
                      ref={pmTrackRef}
                      role="tablist"
                      aria-label="Package manager"
                      className={styles.pmTabs}
                      onKeyDown={handlePmKeyDown}
                    >
                      {pmRect && (
                        <motion.div
                          className={styles.pmIndicator}
                          initial={false}
                          animate={{ x: pmRect.left, width: pmRect.width }}
                          transition={reduced ? { duration: 0 } : TAB_SPRING}
                          aria-hidden="true"
                        />
                      )}
                      {PACKAGE_MANAGERS.map((pm) => {
                        const selected = pm === activePm;
                        return (
                          <button
                            key={pm}
                            ref={(el) => {
                              if (el) pmBtnRefs.current.set(pm, el);
                              else pmBtnRefs.current.delete(pm);
                            }}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            aria-label={pm}
                            tabIndex={selected ? 0 : -1}
                            className={styles.pmTab}
                            data-selected={selected ? "" : undefined}
                            onClick={() => selectPm(pm)}
                          >
                            <PmMark id={pm} />
                            <span className={styles.pmLabel}>{pm}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <span className={styles.file}>{activeFw.install.file}</span>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.copy}
                  data-copied={copiedStep === "install" ? "" : undefined}
                  aria-label={
                    copiedStep === "install"
                      ? "Copied install command"
                      : "Copy install command"
                  }
                  onClick={() => copySnippet("install", installSnippetText)}
                >
                  {copiedStep === "install" ? (
                    <Check size={14} strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <Copy size={14} strokeWidth={1.75} aria-hidden="true" />
                  )}
                </button>
              </div>
              <div
                className={styles.codeBody}
                style={{
                  minHeight: `calc(${maxLines.installLines} * var(--is-line) + 2 * var(--is-pad-y))`,
                }}
              >
                <div className={`${styles.swap} ${styles.layers}`}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div
                      key={`${activeFw.id}-${activePm}`}
                      className={`${styles.swapItem} ${styles.layer}`}
                      initial={reduced ? { opacity: 1 } : { opacity: 0, y: 2 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduced ? { opacity: 0 } : { opacity: 0 }}
                      transition={swapTransition}
                    >
                      <HighlightedCode
                        code={installSnippetText}
                        showLineNumbers={false}
                        apiKey={effectiveKey}
                        placeholder={keyPlaceholder}
                        freshKey={freshKey}
                        reduced={reduced}
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </li>

        {/* Step 2: Add your key */}
        <li className={styles.step}>
          <span
            className={styles.circle}
            data-done={doneSteps.key ? "" : undefined}
            aria-hidden="true"
          >
            <span className={`${styles.swap} ${styles.circleSwap}`}>
              {doneSteps.key ? (
                <Check size={13} strokeWidth={2.2} />
              ) : (
                <span>2</span>
              )}
            </span>
          </span>

          <div className={styles.stepMain}>
            <div className={styles.stepHead}>
              <div className={styles.stepText}>
                <h4 className={styles.stepTitle}>
                  Add your key
                  {doneSteps.key && (
                    <span className={styles.srOnly}>, done</span>
                  )}
                </h4>
                <div className={`${styles.stepDesc} ${styles.swap}`}>
                  <span className={`${styles.stepDescItem} ${styles.swapItem}`}>
                    {genError ? (
                      <span className={styles.descError}>
                        <AlertCircle size={14} strokeWidth={1.75} aria-hidden="true" />
                        {genError}
                      </span>
                    ) : simulatedNotice ? (
                      "Sample key generated locally (nothing sent)."
                    ) : effectiveKey ? (
                      "Key ready. Paste into your environment file."
                    ) : (
                      "Create a publishable key for your workspace."
                    )}
                  </span>
                </div>
              </div>

              {!isExternalKey && (
                <button
                  type="button"
                  className={styles.generate}
                  disabled={generating}
                  onClick={handleGenerate}
                >
                  {generating ? (
                    <Loader2 size={13} strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <KeyRound size={13} strokeWidth={1.75} aria-hidden="true" />
                  )}
                  <span>
                    {genError
                      ? "Try again"
                      : effectiveKey
                        ? "Regenerate"
                        : "Generate key"}
                  </span>
                </button>
              )}
            </div>

            <div className={styles.code}>
              <div className={styles.codeHead}>
                <div className={styles.codeHeadMain}>
                  <span className={styles.file}>{activeFw.key.file}</span>
                </div>
                <button
                  type="button"
                  className={styles.copy}
                  data-copied={copiedStep === "key" ? "" : undefined}
                  aria-label={
                    copiedStep === "key" ? "Copied API key snippet" : "Copy API key snippet"
                  }
                  onClick={() => copySnippet("key", activeFw.key.code)}
                >
                  {copiedStep === "key" ? (
                    <Check size={14} strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <Copy size={14} strokeWidth={1.75} aria-hidden="true" />
                  )}
                </button>
              </div>
              <div
                className={styles.codeBody}
                style={{
                  minHeight: `calc(${maxLines.keyLines} * var(--is-line) + 2 * var(--is-pad-y))`,
                }}
              >
                <div className={`${styles.swap} ${styles.layers}`}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div
                      key={activeFw.id}
                      className={`${styles.swapItem} ${styles.layer}`}
                      initial={reduced ? { opacity: 1 } : { opacity: 0, y: 2 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduced ? { opacity: 0 } : { opacity: 0 }}
                      transition={swapTransition}
                    >
                      <HighlightedCode
                        code={activeFw.key.code}
                        showLineNumbers={false}
                        apiKey={effectiveKey}
                        placeholder={keyPlaceholder}
                        freshKey={freshKey}
                        reduced={reduced}
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </li>

        {/* Step 3: Ship */}
        <li className={styles.step}>
          <span
            className={styles.circle}
            data-done={doneSteps.code ? "" : undefined}
            aria-hidden="true"
          >
            <span className={`${styles.swap} ${styles.circleSwap}`}>
              {doneSteps.code ? (
                <Check size={13} strokeWidth={2.2} />
              ) : (
                <span>3</span>
              )}
            </span>
          </span>

          <div className={styles.stepMain}>
            <div className={styles.stepHead}>
              <div className={styles.stepText}>
                <h4 className={styles.stepTitle}>
                  Ship
                  {doneSteps.code && (
                    <span className={styles.srOnly}>, done</span>
                  )}
                </h4>
                <div className={`${styles.stepDesc} ${styles.swap}`}>
                  <span className={`${styles.stepDescItem} ${styles.swapItem}`}>
                    Wrap your app and record your first event.
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.code}>
              <div className={styles.codeHead}>
                <div className={styles.codeHeadMain}>
                  <span className={styles.file}>{activeFw.code.file}</span>
                </div>
                <button
                  type="button"
                  className={styles.copy}
                  data-copied={copiedStep === "code" ? "" : undefined}
                  aria-label={
                    copiedStep === "code" ? "Copied setup code" : "Copy setup code"
                  }
                  onClick={() => copySnippet("code", activeFw.code.code)}
                >
                  {copiedStep === "code" ? (
                    <Check size={14} strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <Copy size={14} strokeWidth={1.75} aria-hidden="true" />
                  )}
                </button>
              </div>
              <div
                className={styles.codeBody}
                style={{
                  minHeight: `calc(${maxLines.codeLines} * var(--is-line) + 2 * var(--is-pad-y))`,
                }}
              >
                <div className={`${styles.swap} ${styles.layers}`}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div
                      key={activeFw.id}
                      className={`${styles.swapItem} ${styles.layer}`}
                      initial={reduced ? { opacity: 1 } : { opacity: 0, y: 2 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduced ? { opacity: 0 } : { opacity: 0 }}
                      transition={swapTransition}
                    >
                      <HighlightedCode
                        code={activeFw.code.code}
                        showLineNumbers
                        apiKey={effectiveKey}
                        placeholder={keyPlaceholder}
                        freshKey={freshKey}
                        reduced={reduced}
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </li>
      </ol>
    </section>
  );
}

export default InstallSnippet;
