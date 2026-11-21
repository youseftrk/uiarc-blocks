"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Check, Loader2, RotateCcw, Sparkles, Square } from "lucide-react";
import styles from "./smart-form-fill.module.css";

export interface SmartFormFillField {
  id: string;
  label: string;
  kind?: "text" | "email" | "tel" | "company";
  placeholder?: string;
  span?: 1 | 2;
  autoComplete?: string;
}

export interface SmartFormFillEntry {
  value: string;
  confidence: number;
  source?: string;
  note?: string;
}

export type SmartFormFillResult = Record<string, SmartFormFillEntry>;

export interface SmartFormFillProps {
  fields?: SmartFormFillField[];
  defaultValues?: Record<string, string>;
  onValuesChange?: (values: Record<string, string>) => void;
  extract?: (text: string, signal: AbortSignal) => Promise<SmartFormFillResult>;
  reviewThreshold?: number;
  samples?: { label: string; text: string }[];
  autoPlay?: boolean;
  onFill?: (result: SmartFormFillResult) => void;
  onUndo?: (restored: Record<string, string>) => void;
  onSubmit?: (values: Record<string, string>) => void;
  className?: string;
}

const DEFAULT_FIELDS: SmartFormFillField[] = [
  { id: "name", label: "Full name", placeholder: "Maya Lin" },
  { id: "title", label: "Title", placeholder: "VP of Engineering" },
  { id: "company", label: "Company", kind: "company", placeholder: "Northwind Labs" },
  { id: "email", label: "Email", kind: "email", placeholder: "maya@northwind.io" },
  { id: "phone", label: "Phone", kind: "tel", placeholder: "+1 (415) 555-0192" },
  { id: "address", label: "Address", span: 2, placeholder: "548 Market St, San Francisco, CA" },
];

const DEFAULT_SAMPLES = [
  {
    label: "Email signature",
    text: `Best,\nElena Vance\nHead of Product, Kestrel Systems\nelena.vance@kestrel.dev · +1 (415) 555-0148\n420 Mission St, Suite 600, San Francisco, CA`,
  },
  {
    label: "Messy note",
    text: `met marcus chen from northwind @ conf — leads platform eng? email mchen@northwind.io or call 212-555-0173, nyc office 85 Broad St`,
  },
];

function localExtract(text: string): SmartFormFillResult {
  if (text.includes("Elena Vance")) {
    return {
      name: { value: "Elena Vance", confidence: 0.99, source: "Elena Vance" },
      title: { value: "Head of Product", confidence: 0.96, source: "Head of Product" },
      company: { value: "Kestrel Systems", confidence: 0.97, source: "Kestrel Systems" },
      email: { value: "elena.vance@kestrel.dev", confidence: 0.99, source: "elena.vance@kestrel.dev" },
      phone: { value: "+1 (415) 555-0148", confidence: 0.95, source: "+1 (415) 555-0148" },
      address: {
        value: "420 Mission St, Suite 600, San Francisco, CA",
        confidence: 0.92,
        source: "420 Mission St, Suite 600, San Francisco, CA",
      },
    };
  }
  if (text.includes("marcus chen")) {
    return {
      name: { value: "Marcus Chen", confidence: 0.95, source: "marcus chen" },
      title: { value: "Platform Engineering Lead", confidence: 0.68, source: "leads platform eng?", note: "Inferred title" },
      company: { value: "Northwind", confidence: 0.88, source: "northwind" },
      email: { value: "mchen@northwind.io", confidence: 0.98, source: "mchen@northwind.io" },
      phone: { value: "212-555-0173", confidence: 0.94, source: "212-555-0173" },
      address: { value: "85 Broad St, New York, NY", confidence: 0.72, source: "nyc office 85 Broad St" },
    };
  }
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const phone = text.match(/(\+?\d[\d\s().-]{7,}\d)/)?.[0];
  const firstLine = text.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  const out: SmartFormFillResult = {};
  if (firstLine) out.name = { value: firstLine.slice(0, 48), confidence: 0.74, source: firstLine };
  if (email) out.email = { value: email, confidence: 0.98, source: email };
  if (phone) out.phone = { value: phone, confidence: 0.92, source: phone };
  return out;
}

export function SmartFormFill({
  fields = DEFAULT_FIELDS,
  defaultValues = {},
  onValuesChange,
  extract,
  reviewThreshold = 0.8,
  samples = DEFAULT_SAMPLES,
  autoPlay = false,
  onFill,
  onUndo,
  onSubmit,
  className,
}: SmartFormFillProps) {
  const [values, setValues] = useState<Record<string, string>>(defaultValues);
  const [pastedText, setPastedText] = useState("");
  const [meta, setMeta] = useState<SmartFormFillResult>({});
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});
  const [flashing, setFlashing] = useState<Record<string, boolean>>({});
  const [activeField, setActiveField] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState<Record<string, string> | null>(null);
  const [sampleIdx, setSampleIdx] = useState(0);
  const [saved, setSaved] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const autoPlayedRef = useRef(false);

  const updateValues = useCallback(
    (next: Record<string, string>) => {
      setValues(next);
      onValuesChange?.(next);
    },
    [onValuesChange]
  );

  const stopExtract = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setExtracting(false);
  }, []);

  const runExtract = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setExtracting(true);
      setSaved(false);
      setUndoSnapshot({ ...values });

      try {
        const result = extract
          ? await extract(text, ctrl.signal)
          : await new Promise<SmartFormFillResult>((resolve, reject) => {
              const t = window.setTimeout(() => resolve(localExtract(text)), 360);
              ctrl.signal.addEventListener("abort", () => {
                window.clearTimeout(t);
                reject(new DOMException("Aborted", "AbortError"));
              });
            });

        if (ctrl.signal.aborted) return;

        let working = { ...values };
        const nextMeta: SmartFormFillResult = {};
        setReviewed({});

        for (const f of fields) {
          if (ctrl.signal.aborted) return;
          const entry = result[f.id];
          if (!entry) continue;
          await new Promise((r) => setTimeout(r, 110));
          if (ctrl.signal.aborted) return;
          working = { ...working, [f.id]: entry.value };
          nextMeta[f.id] = entry;
          setMeta({ ...nextMeta });
          updateValues(working);
          setFlashing((prev) => ({ ...prev, [f.id]: true }));
          window.setTimeout(() => {
            setFlashing((prev) => ({ ...prev, [f.id]: false }));
          }, 550);
        }

        onFill?.(result);
      } catch {
        // aborted or failed
      } finally {
        if (abortRef.current === ctrl) {
          abortRef.current = null;
          setExtracting(false);
        }
      }
    },
    [extract, fields, onFill, updateValues, values]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && extracting) {
        stopExtract();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [extracting, stopExtract]);

  useEffect(() => {
    if (!autoPlay || autoPlayedRef.current || samples.length === 0) return;
    autoPlayedRef.current = true;
    const sample = samples[0];
    const t = window.setTimeout(() => {
      setPastedText(sample.text);
      void runExtract(sample.text);
    }, 350);
    return () => window.clearTimeout(t);
  }, [autoPlay, samples, runExtract]);

  const handleUndo = () => {
    if (!undoSnapshot) return;
    updateValues(undoSnapshot);
    onUndo?.(undoSnapshot);
    setUndoSnapshot(null);
    setMeta({});
    setReviewed({});
    setSaved(false);
  };

  const handleTrySample = () => {
    if (samples.length === 0) return;
    const sample = samples[sampleIdx % samples.length];
    setSampleIdx((i) => i + 1);
    setPastedText(sample.text);
    void runExtract(sample.text);
  };

  const unreviewedCount = fields.filter((f) => {
    const m = meta[f.id];
    return m && m.confidence < reviewThreshold && !reviewed[f.id];
  }).length;

  const activeSource = activeField ? meta[activeField]?.source : undefined;

  const renderHighlightedSource = () => {
    if (!activeSource || !pastedText.includes(activeSource)) return pastedText;
    const idx = pastedText.indexOf(activeSource);
    return (
      <>
        {pastedText.slice(0, idx)}
        <mark className={styles.highlight}>{activeSource}</mark>
        {pastedText.slice(idx + activeSource.length)}
      </>
    );
  };

  return (
    <div className={`${styles.card} ${className ?? ""}`}>
      <div className={styles.pasteZone}>
        <div className={styles.pasteHeader}>
          <span className={styles.pasteTitle}>
            <Sparkles size={13} />
            Paste signature or notes
          </span>
          <div className={styles.pasteActions}>
            {samples.length > 0 && (
              <button type="button" className={styles.pillBtn} onClick={handleTrySample}>
                Try sample
              </button>
            )}
            {extracting ? (
              <button type="button" className={styles.pillBtn} onClick={stopExtract}>
                <Square size={10} />
                Stop
              </button>
            ) : (
              <button
                type="button"
                className={`${styles.pillBtn} ${styles.pillBtnPrimary}`}
                onClick={() => void runExtract(pastedText)}
                disabled={!pastedText.trim()}
              >
                Fill fields
              </button>
            )}
          </div>
        </div>

        {activeSource ? (
          <div className={styles.sourcePreview}>{renderHighlightedSource()}</div>
        ) : (
          <textarea
            className={styles.textarea}
            placeholder="Paste an email signature, LinkedIn bio, or messy meeting notes…"
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text");
              if (pasted.trim()) {
                window.setTimeout(() => void runExtract(pasted), 40);
              }
            }}
          />
        )}
      </div>

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          if (unreviewedCount > 0) return;
          setSaved(true);
          onSubmit?.(values);
        }}
      >
        {fields.map((field) => {
          const entry = meta[field.id];
          const needsReview = Boolean(
            entry && entry.confidence < reviewThreshold && !reviewed[field.id]
          );
          const isFlashing = Boolean(flashing[field.id]);

          return (
            <div
              key={field.id}
              className={`${styles.field} ${field.span === 2 ? styles.fieldFull : ""}`}
              onMouseEnter={() => setActiveField(field.id)}
              onMouseLeave={() => setActiveField(null)}
            >
              <div className={styles.labelRow}>
                <label htmlFor={`sff-${field.id}`} className={styles.label}>
                  {field.label}
                </label>
                {entry && (
                  <span className={styles.confBadge}>
                    <span
                      className={`${styles.confDot} ${needsReview ? styles.confDotReview : ""}`}
                    />
                    {needsReview ? (
                      <button
                        type="button"
                        className={styles.reviewChip}
                        onClick={() =>
                          setReviewed((prev) => ({ ...prev, [field.id]: true }))
                        }
                      >
                        Review ({Math.round(entry.confidence * 100)}%)
                      </button>
                    ) : (
                      <span>{Math.round(entry.confidence * 100)}%</span>
                    )}
                  </span>
                )}
              </div>

              <motion.div
                className={styles.inputWrap}
                animate={isFlashing ? { scale: [1, 1.015, 1] } : undefined}
                transition={{ duration: 0.25 }}
              >
                <input
                  id={`sff-${field.id}`}
                  type={field.kind === "email" ? "email" : field.kind === "tel" ? "tel" : "text"}
                  autoComplete={field.autoComplete}
                  placeholder={field.placeholder}
                  value={values[field.id] ?? ""}
                  onFocus={() => setActiveField(field.id)}
                  onBlur={() => setActiveField(null)}
                  onChange={(e) => {
                    const next = { ...values, [field.id]: e.target.value };
                    updateValues(next);
                    if (needsReview) {
                      setReviewed((prev) => ({ ...prev, [field.id]: true }));
                    }
                    setSaved(false);
                  }}
                  className={`${styles.input} ${isFlashing ? styles.inputFlash : ""} ${
                    needsReview ? styles.inputReview : ""
                  }`}
                />
              </motion.div>
            </div>
          );
        })}

        <div className={`${styles.footer} ${styles.fieldFull}`}>
          <span className={styles.statusText}>
            {extracting ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Loader2 size={12} /> Reading pasted text…
              </span>
            ) : unreviewedCount > 0 ? (
              `${unreviewedCount} field${unreviewedCount === 1 ? "" : "s"} need review before saving`
            ) : saved ? (
              "Contact saved"
            ) : (
              "Hover any filled field to highlight its source"
            )}
          </span>

          <div className={styles.footerActions}>
            {undoSnapshot && (
              <button type="button" className={styles.pillBtn} onClick={handleUndo}>
                <RotateCcw size={12} />
                Undo
              </button>
            )}
            <button type="submit" className={styles.saveBtn} disabled={unreviewedCount > 0 || extracting}>
              {saved && <Check size={14} />}
              {saved ? "Saved" : "Save contact"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
