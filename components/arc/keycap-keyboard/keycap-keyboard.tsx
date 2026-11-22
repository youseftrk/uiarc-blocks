"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { CornerDownLeft, Delete } from "lucide-react";
import styles from "./keycap-keyboard.module.css";

export interface KeycapKeyboardProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  layout?: "compact" | "letters";
  rows?: string[][];
  maxLength?: number;
  listen?: "focus" | "window";
  placeholder?: string;
  showOutput?: boolean;
  label?: string;
  className?: string;
}

interface KeyDef {
  id: string;
  action: string;
  label: string;
  legend?: string;
  icon?: "backspace" | "enter";
  width: number;
  corner?: boolean;
  accent?: boolean;
  codes: string[];
}

const SHIFT_MAP: Record<string, string> = {
  "`": "~",
  "1": "!",
  "2": "@",
  "3": "#",
  "4": "$",
  "5": "%",
  "6": "^",
  "7": "&",
  "8": "*",
  "9": "(",
  "0": ")",
  "-": "_",
  "=": "+",
  "[": "{",
  "]": "}",
  "\\": "|",
  ";": ":",
  "'": '"',
  ",": "<",
  ".": ">",
  "/": "?",
};

function charToCodes(ch: string): string[] {
  const lower = ch.toLowerCase();
  if (lower >= "a" && lower <= "z") return [`Key${lower.toUpperCase()}`];
  if (lower >= "0" && lower <= "9") return [`Digit${lower}`];
  const map: Record<string, string> = {
    "`": "Backquote",
    "-": "Minus",
    "=": "Equal",
    "[": "BracketLeft",
    "]": "BracketRight",
    "\\": "Backslash",
    ";": "Semicolon",
    "'": "Quote",
    ",": "Comma",
    ".": "Period",
    "/": "Slash",
  };
  return map[lower] ? [map[lower]] : [];
}

function makeCharKey(ch: string, idPrefix = ""): KeyDef {
  const upper = ch.length === 1 && ch >= "a" && ch <= "z" ? ch.toUpperCase() : ch;
  return {
    id: `${idPrefix}${ch}`,
    action: ch,
    label: upper,
    legend: upper,
    width: 1,
    codes: charToCodes(ch),
  };
}

const COMPACT_ROWS: KeyDef[][] = [
  [
    ..."`1234567890-=".split("").map((c) => makeCharKey(c)),
    {
      id: "backspace",
      action: "backspace",
      label: "Delete",
      icon: "backspace",
      width: 2,
      corner: true,
      codes: ["Backspace"],
    },
  ],
  [
    {
      id: "tab",
      action: "tab",
      label: "Tab",
      legend: "tab",
      width: 1.5,
      corner: true,
      codes: ["Tab"],
    },
    ..."qwertyuiop[]\\".split("").map((c) => makeCharKey(c)),
  ].map((k) => (k.id === "\\" ? { ...k, width: 1.5 } : k)),
  [
    {
      id: "caps",
      action: "caps",
      label: "Caps Lock",
      legend: "caps",
      width: 1.75,
      corner: true,
      codes: ["CapsLock"],
    },
    ..."asdfghjkl;'".split("").map((c) => makeCharKey(c)),
    {
      id: "enter",
      action: "enter",
      label: "Return",
      icon: "enter",
      width: 2.25,
      accent: true,
      codes: ["Enter"],
    },
  ],
  [
    {
      id: "shift-l",
      action: "shift",
      label: "Shift",
      legend: "shift",
      width: 2.25,
      corner: true,
      codes: ["ShiftLeft"],
    },
    ..."zxcvbnm,./".split("").map((c) => makeCharKey(c)),
    {
      id: "shift-r",
      action: "shift",
      label: "Shift",
      legend: "shift",
      width: 2.75,
      corner: true,
      codes: ["ShiftRight"],
    },
  ],
  [
    {
      id: "ctrl-l",
      action: "ctrl",
      label: "Control",
      legend: "ctrl",
      width: 1.25,
      corner: true,
      codes: ["ControlLeft"],
    },
    {
      id: "alt-l",
      action: "alt",
      label: "Option",
      legend: "opt",
      width: 1.25,
      corner: true,
      codes: ["AltLeft"],
    },
    {
      id: "meta-l",
      action: "meta",
      label: "Command",
      legend: "cmd",
      width: 1.5,
      corner: true,
      codes: ["MetaLeft"],
    },
    {
      id: "space",
      action: "space",
      label: "Space",
      legend: "",
      width: 6.5,
      codes: ["Space"],
    },
    {
      id: "meta-r",
      action: "meta",
      label: "Command",
      legend: "cmd",
      width: 1.5,
      corner: true,
      codes: ["MetaRight"],
    },
    {
      id: "alt-r",
      action: "alt",
      label: "Option",
      legend: "opt",
      width: 1.5,
      corner: true,
      codes: ["AltRight"],
    },
    {
      id: "ctrl-r",
      action: "ctrl",
      label: "Control",
      legend: "ctrl",
      width: 1.5,
      corner: true,
      codes: ["ControlRight"],
    },
  ],
];

const LETTERS_ROWS: KeyDef[][] = [
  ..."qwertyuiop".split("").map((c) => [makeCharKey(c)]).reduce<KeyDef[][]>(
    (acc, item) => {
      acc[0].push(item[0]);
      return acc;
    },
    [[]],
  ),
  ..."asdfghjkl".split("").map((c) => [makeCharKey(c)]).reduce<KeyDef[][]>(
    (acc, item) => {
      acc[0].push(item[0]);
      return acc;
    },
    [[]],
  ),
  [
    {
      id: "shift-l",
      action: "shift",
      label: "Shift",
      legend: "shift",
      width: 1.5,
      corner: true,
      codes: ["ShiftLeft", "ShiftRight"],
    },
    ..."zxcvbnm".split("").map((c) => makeCharKey(c)),
    {
      id: "backspace",
      action: "backspace",
      label: "Delete",
      icon: "backspace",
      width: 1.5,
      corner: true,
      codes: ["Backspace"],
    },
  ],
  [
    {
      id: "space",
      action: "space",
      label: "Space",
      legend: "",
      width: 6,
      codes: ["Space"],
    },
    {
      id: "enter",
      action: "enter",
      label: "Return",
      icon: "enter",
      width: 2,
      accent: true,
      codes: ["Enter"],
    },
  ],
];

function buildCustomRows(rows: string[][]): KeyDef[][] {
  return rows.map((row, ri) =>
    row.map((token, ci) => {
      const lower = token.toLowerCase();
      const uid = `r${ri}c${ci}-${lower}`;
      if (lower === "space") {
        return { id: uid, action: "space", label: "Space", legend: "", width: 5, codes: ["Space"] };
      }
      if (lower === "backspace") {
        return { id: uid, action: "backspace", label: "Delete", icon: "backspace", width: 1.75, corner: true, codes: ["Backspace"] };
      }
      if (lower === "enter") {
        return { id: uid, action: "enter", label: "Return", icon: "enter", width: 2, accent: true, codes: ["Enter"] };
      }
      if (lower === "shift") {
        return { id: uid, action: "shift", label: "Shift", legend: "shift", width: 1.75, corner: true, codes: ["ShiftLeft", "ShiftRight"] };
      }
      if (lower === "tab") {
        return { id: uid, action: "tab", label: "Tab", legend: "tab", width: 1.5, corner: true, codes: ["Tab"] };
      }
      if (lower === "caps") {
        return { id: uid, action: "caps", label: "Caps Lock", legend: "caps", width: 1.75, corner: true, codes: ["CapsLock"] };
      }
      return makeCharKey(token, `r${ri}c${ci}-`);
    }),
  );
}

interface KeycapButtonProps {
  def: KeyDef;
  registerEl: (id: string, el: HTMLButtonElement | null) => void;
  onPressDown: (def: KeyDef, el: HTMLButtonElement) => void;
  onPressUp: (def: KeyDef, el: HTMLButtonElement) => void;
  onKeyActivate: (def: KeyDef, el: HTMLButtonElement) => void;
}

const KeycapButton = memo(function KeycapButton({
  def,
  registerEl,
  onPressDown,
  onPressUp,
  onKeyActivate,
}: KeycapButtonProps) {
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const setRef = useCallback(
    (node: HTMLButtonElement | null) => {
      btnRef.current = node;
      registerEl(def.id, node);
    },
    [def.id, registerEl],
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      onPressDown(def, e.currentTarget);
    },
    [def, onPressDown],
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      onPressUp(def, e.currentTarget);
    },
    [def, onPressUp],
  );

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        onKeyActivate(def, e.currentTarget);
      }
    },
    [def, onKeyActivate],
  );

  return (
    <button
      ref={setRef}
      type="button"
      className={styles.key}
      style={{ "--w": def.width } as CSSProperties}
      data-keycap=""
      data-corner={def.corner ? "" : undefined}
      data-accent={def.accent ? "" : undefined}
      aria-label={def.label}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
    >
      <span className={styles.glow} aria-hidden="true" />
      <span className={styles.housing} aria-hidden="true" />
      <span className={styles.cap} aria-hidden="true">
        <span className={styles.face}>
          <span className={styles.legend}>
            {def.icon === "backspace" ? (
              <Delete strokeWidth={1.75} aria-hidden="true" />
            ) : def.icon === "enter" ? (
              <CornerDownLeft strokeWidth={1.75} aria-hidden="true" />
            ) : (
              def.legend
            )}
          </span>
        </span>
      </span>
    </button>
  );
});

export function KeycapKeyboard({
  value: controlledValue,
  defaultValue = "",
  onValueChange,
  layout = "compact",
  rows: customRows,
  maxLength = 280,
  listen = "focus",
  placeholder = "Start typing",
  showOutput = true,
  label = "Keyboard",
  className,
}: KeycapKeyboardProps) {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const textValue = isControlled ? controlledValue : internalValue;
  const textRef = useRef(textValue);
  useEffect(() => {
    textRef.current = textValue;
  }, [textValue]);

  const [typing, setTyping] = useState(false);
  const idleTimerRef = useRef<number | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const buttonElsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const shiftLatchedRef = useRef(false);
  const capsLatchedRef = useRef(false);
  const repeatTimerRef = useRef<number | null>(null);
  const repeatIntervalRef = useRef<number | null>(null);

  const keyRows = useMemo<KeyDef[][]>(() => {
    if (customRows && customRows.length > 0) return buildCustomRows(customRows);
    return layout === "letters" ? LETTERS_ROWS : COMPACT_ROWS;
  }, [customRows, layout]);

  const maxUnits = useMemo(() => {
    return keyRows.reduce((max, row) => {
      const sum = row.reduce((acc, k) => acc + k.width, 0);
      return Math.max(max, sum);
    }, 1);
  }, [keyRows]);

  const codeToDefs = useMemo(() => {
    const map = new Map<string, KeyDef[]>();
    for (const row of keyRows) {
      for (const def of row) {
        for (const code of def.codes) {
          const list = map.get(code) ?? [];
          list.push(def);
          map.set(code, list);
        }
      }
    }
    return map;
  }, [keyRows]);

  const registerEl = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) {
      buttonElsRef.current.set(id, el);
    } else {
      buttonElsRef.current.delete(id);
    }
  }, []);

  const syncLatchDom = useCallback(() => {
    for (const row of keyRows) {
      for (const def of row) {
        const el = buttonElsRef.current.get(def.id);
        if (!el) continue;
        const latched =
          (def.action === "shift" && shiftLatchedRef.current) ||
          (def.action === "caps" && capsLatchedRef.current);
        if (latched) {
          el.setAttribute("data-latched", "");
        } else {
          el.removeAttribute("data-latched");
        }
      }
    }
  }, [keyRows]);

  const markTyping = useCallback(() => {
    setTyping(true);
    if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      setTyping(false);
      idleTimerRef.current = null;
    }, 600);
  }, []);

  const commitText = useCallback(
    (next: string) => {
      const clamped = next.length > maxLength ? next.slice(next.length - maxLength) : next;
      textRef.current = clamped;
      if (!isControlled) setInternalValue(clamped);
      onValueChange?.(clamped);
      markTyping();
    },
    [isControlled, maxLength, onValueChange, markTyping],
  );

  const applyAction = useCallback(
    (action: string, fromPhysical = false, physicalKey?: string) => {
      if (action === "shift") {
        if (!fromPhysical) {
          shiftLatchedRef.current = !shiftLatchedRef.current;
          syncLatchDom();
        }
        return;
      }
      if (action === "caps") {
        capsLatchedRef.current = !capsLatchedRef.current;
        syncLatchDom();
        return;
      }
      if (action === "tab" || action === "ctrl" || action === "alt" || action === "meta") {
        return;
      }
      if (action === "backspace") {
        const cur = textRef.current;
        if (cur.length > 0) {
          commitText(cur.slice(0, -1));
        }
        return;
      }
      if (action === "enter") {
        commitText(textRef.current + "\n");
        return;
      }
      if (action === "space") {
        commitText(textRef.current + " ");
        return;
      }

      let out = physicalKey ?? action;
      if (!fromPhysical && out.length === 1) {
        const isLetter = out >= "a" && out <= "z";
        if (isLetter) {
          const upper = shiftLatchedRef.current !== capsLatchedRef.current;
          out = upper ? out.toUpperCase() : out;
        } else if (shiftLatchedRef.current && SHIFT_MAP[out]) {
          out = SHIFT_MAP[out];
        }
        if (shiftLatchedRef.current) {
          shiftLatchedRef.current = false;
          syncLatchDom();
        }
      }
      commitText(textRef.current + out);
    },
    [commitText, syncLatchDom],
  );

  const clearPointerRepeat = useCallback(() => {
    if (repeatTimerRef.current !== null) {
      window.clearTimeout(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
    if (repeatIntervalRef.current !== null) {
      window.clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
  }, []);

  const handlePressDown = useCallback(
    (def: KeyDef, el: HTMLButtonElement) => {
      el.setAttribute("data-pressed", "");
      applyAction(def.action, false);
      clearPointerRepeat();
      if (def.action === "backspace") {
        repeatTimerRef.current = window.setTimeout(() => {
          repeatIntervalRef.current = window.setInterval(() => {
            applyAction("backspace", false);
          }, 55);
        }, 380);
      }
    },
    [applyAction, clearPointerRepeat],
  );

  const handlePressUp = useCallback(
    (_def: KeyDef, el: HTMLButtonElement) => {
      el.removeAttribute("data-pressed");
      clearPointerRepeat();
    },
    [clearPointerRepeat],
  );

  const handleKeyActivate = useCallback(
    (def: KeyDef, el: HTMLButtonElement) => {
      el.setAttribute("data-pressed", "");
      applyAction(def.action, false);
      window.setTimeout(() => {
        el.removeAttribute("data-pressed");
      }, 120);
    },
    [applyAction],
  );

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      if (rootRef.current?.contains(target)) return false;
      const tag = target.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      );
    };

    const setCodePressed = (code: string, pressed: boolean) => {
      const defs = codeToDefs.get(code);
      if (!defs) return;
      for (const def of defs) {
        const el = buttonElsRef.current.get(def.id);
        if (!el) continue;
        if (pressed) el.setAttribute("data-pressed", "");
        else el.removeAttribute("data-pressed");
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (listen === "window" && isEditableTarget(e.target)) return;
      if (listen === "focus") {
        const active = document.activeElement;
        if (!rootRef.current || !active || !rootRef.current.contains(active)) return;
        // Let Enter/Space on focused keycap button be handled by button
        if (
          active instanceof HTMLButtonElement &&
          active.hasAttribute("data-keycap") &&
          (e.key === "Enter" || e.key === " ")
        ) {
          return;
        }
      }

      // Light physical keycap even for modifiers
      setCodePressed(e.code, true);

      // Shortcuts with Command, Control, or Alt pass through untouched
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Tab") return;
      if (e.key === "Shift") return;
      if (e.key === "CapsLock") {
        capsLatchedRef.current = e.getModifierState("CapsLock");
        syncLatchDom();
        return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        applyAction("backspace", true);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        applyAction("enter", true);
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        applyAction("space", true);
        return;
      }
      if (e.key.length === 1) {
        e.preventDefault();
        applyAction(e.key.toLowerCase(), true, e.key);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      setCodePressed(e.code, false);
    };

    const onBlur = () => {
      buttonElsRef.current.forEach((el) => el.removeAttribute("data-pressed"));
    };

    const target: Window | HTMLDivElement | null =
      listen === "window" ? window : rootRef.current;
    if (!target) return;

    target.addEventListener("keydown", onKeyDown as EventListener);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return () => {
      target.removeEventListener("keydown", onKeyDown as EventListener);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      clearPointerRepeat();
      if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
    };
  }, [listen, codeToDefs, applyAction, syncLatchDom, clearPointerRepeat]);

  const chars = useMemo(() => Array.from(textValue), [textValue]);

  return (
    <div
      ref={rootRef}
      className={`${styles.root}${className ? ` ${className}` : ""}`}
      style={{ "--units": maxUnits } as CSSProperties}
    >
      {showOutput && (
        <div
          ref={outputRef}
          className={styles.output}
          role="textbox"
          aria-readonly="true"
          aria-multiline="true"
          aria-label="Typed text"
          tabIndex={0}
          data-typing={typing ? "" : undefined}
        >
          <p className={styles.text}>
            {chars.map((ch, idx) => (
              <span key={`${idx}-${ch}`} className={styles.char}>
                {ch}
              </span>
            ))}
            <span className={styles.caret} aria-hidden="true" />
            {chars.length === 0 && (
              <span className={styles.placeholder}>{placeholder}</span>
            )}
          </p>
        </div>
      )}

      <div className={styles.plate} role="group" aria-label={label}>
        {keyRows.map((row, ri) => (
          <div key={ri} className={styles.row}>
            {row.map((def) => (
              <KeycapButton
                key={def.id}
                def={def}
                registerEl={registerEl}
                onPressDown={handlePressDown}
                onPressUp={handlePressUp}
                onKeyActivate={handleKeyActivate}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default KeycapKeyboard;
