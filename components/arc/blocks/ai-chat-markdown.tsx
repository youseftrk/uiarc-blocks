"use client";

import { Check, CircleAlert, Copy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { createContext, Fragment, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./ai-chat.module.css";

type CiteRenderer = (n: number, key: string) => ReactNode;
const MarkdownContext = createContext<{ animate: boolean; cite: CiteRenderer }>({ animate: false, cite: (n) => `[${n}]` });

type Inline =
  | { kind: "text"; text: string }
  | { kind: "strong"; children: Inline[] }
  | { kind: "code"; text: string }
  | { kind: "cite"; n: number }
  | { kind: "link"; text: string; href: string };

type Block =
  | { kind: "h"; level: number; text: string }
  | { kind: "p"; lines: string[] }
  | { kind: "quote"; lines: string[] }
  | { kind: "ul" | "ol"; items: string[]; start: number }
  | { kind: "code"; lang: string; lines: string[]; closed: boolean }
  | { kind: "table"; head: string[]; rows: string[][]; align: ("left" | "center" | "right")[] };

const splitRow = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let at = 0;
  for (const m of text.matchAll(/\*\*([^*]+)\*\*|`([^`]+)`|\[(\d{1,2})\](?!\()|\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    const i = m.index ?? 0;
    if (i > at) out.push({ kind: "text", text: text.slice(at, i) });
    if (m[1] !== undefined) out.push({ kind: "strong", children: parseInline(m[1]) });
    else if (m[2] !== undefined) out.push({ kind: "code", text: m[2] });
    else if (m[3] !== undefined) out.push({ kind: "cite", n: Number(m[3]) });
    else out.push({ kind: "link", text: m[4], href: m[5] });
    at = i + m[0].length;
  }
  if (at < text.length) out.push({ kind: "text", text: text.slice(at) });
  return out;
}

export function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r/g, "").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = line.match(/^```\s*([\w+-]*)/);
    if (fence) {
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].startsWith("```"); ) code.push(lines[i++]);
      const closed = i < lines.length;
      if (closed) i++;
      blocks.push({ kind: "code", lang: fence[1] || "text", lines: code, closed });
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: "h", level: heading[1].length + 1, text: heading[2] });
      i++;
      continue;
    }
    if (line.startsWith("|") && /^\|\s*:?-/.test(lines[i + 1] ?? "")) {
      const head = splitRow(line);
      const align = splitRow(lines[i + 1]).map((c) => (c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : "left") as "left" | "center" | "right");
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) rows.push(splitRow(lines[i++]));
      blocks.push({ kind: "table", head, rows, align });
      continue;
    }
    const ul = /^[-*]\s+/;
    const ol = /^(\d+)\.\s+/;
    if (ul.test(line) || ol.test(line)) {
      const ordered = ol.test(line);
      const re = ordered ? ol : ul;
      const start = ordered ? Number(line.match(ol)?.[1] ?? 1) : 1;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i])) items.push(lines[i++].replace(re, ""));
      blocks.push({ kind: ordered ? "ol" : "ul", items, start });
      continue;
    }
    if (line.startsWith("> ")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) quote.push(lines[i++].slice(2));
      blocks.push({ kind: "quote", lines: quote });
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(```|#{1,3}\s|[-*]\s|\d+\.\s|> )/.test(lines[i]) &&
      !(lines[i].startsWith("|") && /^\|\s*:?-/.test(lines[i + 1] ?? ""))
    )
      para.push(lines[i++]);
    if (!para.length) para.push(lines[i++]);
    blocks.push({ kind: "p", lines: para });
  }
  return blocks;
}

function Word({ children }: { children: ReactNode }) {
  const { animate } = useContext(MarkdownContext);
  const [entered] = useState(animate);
  return <span className={entered ? `${styles.word} ${styles.wordIn}` : styles.word}>{children}</span>;
}

function Enter({ children }: { children: ReactNode }) {
  const { animate } = useContext(MarkdownContext);
  const [entered] = useState(animate);
  return (
    <span className={entered ? styles.wordIn : undefined} style={{ display: "inline-block" }}>
      {children}
    </span>
  );
}

function Words({ text, id }: { text: string; id: string }) {
  return (
    <>
      {text.split(/(\s+)/).map((part, i) =>
        !part ? null : /^\s+$/.test(part) ? <Fragment key={`${id}-${i}`}>{part}</Fragment> : <Word key={`${id}-${i}`}>{part}</Word>,
      )}
    </>
  );
}

function Inlines({ nodes, id }: { nodes: Inline[]; id: string }) {
  const { cite } = useContext(MarkdownContext);
  return (
    <>
      {nodes.map((node, i) => {
        const key = `${id}.${i}`;
        switch (node.kind) {
          case "text":
            return <Words key={key} text={node.text} id={key} />;
          case "strong":
            return (
              <strong key={key}>
                <Inlines nodes={node.children} id={key} />
              </strong>
            );
          case "code":
            return (
              <Enter key={key}>
                <code className={styles.inlineCode}>{node.text}</code>
              </Enter>
            );
          case "link":
            return (
              <a key={key} className={styles.link} href={node.href} target="_blank" rel="noreferrer">
                <Words text={node.text} id={key} />
              </a>
            );
          case "cite":
            return <Fragment key={key}>{cite(node.n, key)}</Fragment>;
        }
      })}
    </>
  );
}

const Rich = ({ text, id }: { text: string; id: string }) => <Inlines nodes={parseInline(text)} id={id} />;

const KEYWORDS: Record<string, RegExp> = {
  sql: /\b(select|from|where|and|or|not|in|join|left|right|inner|outer|on|group|by|order|having|limit|as|create|table|primary|key|default|insert|into|values|update|set|delete|distinct|count|sum|avg|now|interval|with|null|true|false|references|index|if|exists|desc|asc)\b/gi,
  ts: /\b(const|let|var|function|return|if|else|for|while|await|async|import|from|export|type|interface|new|class|extends|true|false|null|undefined)\b/g,
  bash: /\b(npm|npx|pnpm|git|cd|echo|export|curl|sudo)\b/g,
};
KEYWORDS.js = KEYWORDS.ts;
KEYWORDS.tsx = KEYWORDS.ts;
KEYWORDS.typescript = KEYWORDS.ts;
KEYWORDS.javascript = KEYWORDS.ts;
KEYWORDS.sh = KEYWORDS.bash;

function highlight(line: string, lang: string): ReactNode[] {
  const keywords = KEYWORDS[lang.toLowerCase()];
  if (!keywords) return [line];
  const marker = lang === "sql" ? "--" : lang === "bash" || lang === "sh" ? "#" : "//";
  const at = line.indexOf(marker);
  const code = at >= 0 ? line.slice(0, at) : line;
  const comment = at >= 0 ? line.slice(at) : "";
  const out: ReactNode[] = [];
  const re = new RegExp(`('[^']*'|"[^"]*"|\\$\\d+|\\b\\d+(?:\\.\\d+)?\\b|${keywords.source})`, "gi");
  let last = 0;
  let k = 0;
  for (const m of code.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push(code.slice(last, i));
    const tok = m[0];
    const kind = /^['"]/.test(tok) ? "string" : /^\$|^\d/.test(tok) ? "number" : "keyword";
    out.push(
      <span key={k++} className={styles[`tok-${kind}`]}>
        {tok}
      </span>,
    );
    last = i + tok.length;
  }
  if (last < code.length) out.push(code.slice(last));
  if (comment)
    out.push(
      <span key="comment" className={styles["tok-comment"]}>
        {comment}
      </span>,
    );
  return out;
}

function CodeLine({ line, lang }: { line: string; lang: string }) {
  const { animate } = useContext(MarkdownContext);
  const [entered] = useState(animate);
  return <span className={entered ? `${styles.codeLine} ${styles.lineIn}` : styles.codeLine}>{line ? highlight(line, lang) : " "}</span>;
}

export function useCopy(resetAfter = 1900) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setState("idle");
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const copy = useCallback(
    async (text: string) => {
      if (timer.current) clearTimeout(timer.current);
      try {
        await navigator.clipboard.writeText(text);
        setState("copied");
      } catch {
        setState("error");
      }
      timer.current = setTimeout(reset, resetAfter);
    },
    [reset, resetAfter],
  );
  return { state, copy, reset };
}

const POP = { initial: { opacity: 0, scale: 0.8 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.8 } };
const FADE = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };

export function CopyButton({
  value,
  label = "Copy",
  done = "Copied",
  reduced,
  className,
  iconOnly = false,
}: {
  value: string;
  label?: string;
  done?: string;
  reduced: boolean;
  className?: string;
  iconOnly?: boolean;
}) {
  const { state, copy } = useCopy(1600);
  const current = state === "copied" ? done : state === "error" ? "Failed" : label;
  const Icon = state === "copied" ? Check : state === "error" ? CircleAlert : Copy;
  return (
    <button type="button" className={className} data-state={state} aria-label={iconOnly ? current : undefined} onClick={() => copy(value)}>
      <span className={styles.swapCell} aria-hidden="true">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span key={state} className={styles.swapItem} {...(reduced ? FADE : POP)} transition={{ duration: reduced ? 0.1 : 0.2 }}>
            <Icon size={15} strokeWidth={1.75} />
          </motion.span>
        </AnimatePresence>
      </span>
      {!iconOnly && (
        <span className={styles.copyLabel}>
          {[label, done, "Failed"].map((text) => (
            <span key={text} data-on={text === current || undefined} aria-hidden={text !== current || undefined}>
              {text}
            </span>
          ))}
        </span>
      )}
      <span className={styles.srOnly} aria-live="polite">
        {state === "copied" ? "Copied to clipboard" : state === "error" ? "Copy failed" : ""}
      </span>
    </button>
  );
}

function CodeBlock({ lang, lines, closed, reduced }: { lang: string; lines: string[]; closed: boolean; reduced: boolean }) {
  return (
    <div className={styles.codeBlock} data-open={!closed || undefined}>
      <div className={styles.codeHead}>
        <span className={styles.codeLang}>{lang === "text" ? "Code" : lang.toUpperCase() === "SQL" ? "SQL" : lang}</span>
        <CopyButton value={lines.join("\n")} reduced={reduced} className={styles.codeCopy} />
      </div>
      <pre className={styles.pre}>
        <code>
          {lines.map((line, i) => (
            <CodeLine key={i} line={line} lang={lang} />
          ))}
        </code>
      </pre>
    </div>
  );
}

function Row({ cells, align, id, head = false }: { cells: string[]; align: ("left" | "center" | "right")[]; id: string; head?: boolean }) {
  const { animate } = useContext(MarkdownContext);
  const [entered] = useState(animate);
  const Cell = head ? "th" : "td";
  return (
    <tr className={entered ? styles.lineIn : undefined}>
      {cells.map((cell, i) => (
        <Cell key={i} style={{ textAlign: align[i] ?? "left" }} scope={head ? "col" : undefined}>
          <Rich text={cell} id={`${id}.${i}`} />
        </Cell>
      ))}
    </tr>
  );
}

export function Markdown({ text, streaming, reduced, cite }: { text: string; streaming: boolean; reduced: boolean; cite: CiteRenderer }) {
  const blocks = parseBlocks(text);
  return (
    <MarkdownContext.Provider value={{ animate: streaming && !reduced, cite }}>
      <div className={styles.markdown}>
        {blocks.map((block, i) => {
          const id = `b${i}`;
          switch (block.kind) {
            case "h": {
              const Tag = `h${block.level}` as "h2" | "h3" | "h4";
              return (
                <Tag key={id} className={styles.heading}>
                  <Rich text={block.text} id={id} />
                </Tag>
              );
            }
            case "p":
              return (
                <p key={id}>
                  {block.lines.map((line, j) => (
                    <Fragment key={j}>
                      {j > 0 && <br />}
                      <Rich text={line} id={`${id}.${j}`} />
                    </Fragment>
                  ))}
                </p>
              );
            case "quote":
              return (
                <blockquote key={id}>
                  {block.lines.map((line, j) => (
                    <p key={j}>
                      <Rich text={line} id={`${id}.${j}`} />
                    </p>
                  ))}
                </blockquote>
              );
            case "ul":
              return (
                <ul key={id}>
                  {block.items.map((item, j) => (
                    <li key={j}>
                      <Rich text={item} id={`${id}.${j}`} />
                    </li>
                  ))}
                </ul>
              );
            case "ol":
              return (
                <ol key={id} start={block.start}>
                  {block.items.map((item, j) => (
                    <li key={j}>
                      <Rich text={item} id={`${id}.${j}`} />
                    </li>
                  ))}
                </ol>
              );
            case "code":
              return <CodeBlock key={id} lang={block.lang} lines={block.lines} closed={block.closed} reduced={reduced} />;
            case "table":
              return (
                <div key={id} className={styles.tableWrap} tabIndex={0} role="region" aria-label="Table">
                  <table>
                    <thead>
                      <Row cells={block.head} align={block.align} id={`${id}.h`} head />
                    </thead>
                    <tbody>
                      {block.rows.map((row, j) => (
                        <Row key={j} cells={row} align={block.align} id={`${id}.${j}`} />
                      ))}
                    </tbody>
                  </table>
                </div>
              );
          }
        })}
      </div>
    </MarkdownContext.Provider>
  );
}

export function PlainText({ text, streaming, reduced, className }: { text: string; streaming: boolean; reduced: boolean; className?: string }) {
  return (
    <MarkdownContext.Provider value={{ animate: streaming && !reduced, cite: (n) => `[${n}]` }}>
      <p className={className}>
        {text.split("\n").map((line, i) => (
          <Fragment key={i}>
            {i > 0 && <br />}
            <Words text={line} id={`t${i}`} />
          </Fragment>
        ))}
      </p>
    </MarkdownContext.Provider>
  );
}
