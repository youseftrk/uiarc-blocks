"use client";

import { useRef } from "react";
import { CookieConsent, type CookieConsentHandle } from "./cookie-consent";

export default function Consent() {
  const consent = useRef<CookieConsentHandle>(null);
  return (
    <>
      <CookieConsent
        ref={consent}
        storageKey="acme-consent-demo"
        policy={{ label: "Cookie policy", href: "#cookies" }}
        onChange={() => {}}
      />
      <button
        type="button"
        onClick={() => consent.current?.openPreferences()}
        style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: "pointer" }}
      >
        Cookie settings
      </button>
    </>
  );
}
