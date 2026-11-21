"use client";

import { useState } from "react";
import { Bell, Camera, ChevronRight, Shield, User } from "lucide-react";
import { Sheet, SheetStack, SheetTrigger, useSheetStack } from "./sheet-stack";

function DoneFooter({ label = "Done" }: { label?: string }) {
  const { close } = useSheetStack();
  return (
    <button
      type="button"
      onClick={close}
      style={{
        padding: "7px 14px",
        borderRadius: 8,
        border: "none",
        background: "var(--accent)",
        color: "var(--accent-contrast)",
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

const rowStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 13.5,
  fontWeight: 500,
  cursor: "pointer",
  textAlign: "left",
};

export default function SheetStackDemo() {
  const [mode, setMode] = useState<"auto" | "sheet" | "dialog">("auto");
  const [stack, setStack] = useState<string[]>([]);
  const [avatarHue, setAvatarHue] = useState(215);

  return (
    <div style={{ width: "100%", maxWidth: 460, display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          position: "relative",
          minHeight: 380,
          borderRadius: 18,
          border: "1px solid var(--border)",
          background: "var(--surface-subtle)",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          overflow: "hidden",
        }}
      >
        <SheetStack
          contained
          mode={mode}
          stack={stack}
          onStackChange={setStack}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "999px",
                  background: `hsl(${avatarHue} 65% 52%)`,
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 15,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                EC
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
                  Emma Collins
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                  Product designer · Studio team
                </div>
              </div>
            </div>

            <SheetTrigger
              sheet="settings"
              style={{
                alignSelf: "flex-start",
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text)",
                fontSize: 13.5,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Open settings
            </SheetTrigger>

            <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
              Open settings, then drill into your profile and photo. Drag a sheet down or press Escape to go back a level.
            </p>
          </div>

          <Sheet
            id="settings"
            title="Settings"
            description="Manage your account and preferences."
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <SheetTrigger sheet="profile" style={rowStyle}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <User size={15} /> Profile
                </span>
                <ChevronRight size={15} style={{ color: "var(--text-muted)" }} />
              </SheetTrigger>
              <SheetTrigger sheet="notifications" style={rowStyle}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Bell size={15} /> Notifications
                </span>
                <ChevronRight size={15} style={{ color: "var(--text-muted)" }} />
              </SheetTrigger>
              <SheetTrigger sheet="security" style={rowStyle}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Shield size={15} /> Security
                </span>
                <ChevronRight size={15} style={{ color: "var(--text-muted)" }} />
              </SheetTrigger>
            </div>
          </Sheet>

          <Sheet
            id="profile"
            title="Profile"
            description="Update how teammates see you."
            footer={<DoneFooter label="Save profile" />}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <SheetTrigger sheet="photo" style={rowStyle}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Camera size={15} /> Change photo
                </span>
                <ChevronRight size={15} style={{ color: "var(--text-muted)" }} />
              </SheetTrigger>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5 }}>
                <span style={{ color: "var(--text-muted)" }}>Display name</span>
                <input
                  defaultValue="Emma Collins"
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--surface-subtle)",
                    color: "var(--text)",
                    fontSize: 13.5,
                  }}
                />
              </label>
            </div>
          </Sheet>

          <Sheet
            id="photo"
            title="Profile photo"
            description="Pick a color accent for your avatar."
            footer={<DoneFooter label="Apply photo" />}
          >
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[215, 340, 155, 28, 270].map((hue) => (
                <button
                  key={hue}
                  type="button"
                  onClick={() => setAvatarHue(hue)}
                  aria-label={`Accent ${hue}`}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "999px",
                    border: avatarHue === hue ? "2px solid var(--text)" : "2px solid transparent",
                    background: `hsl(${hue} 65% 52%)`,
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>
          </Sheet>

          <Sheet
            id="notifications"
            title="Notifications"
            footer={<DoneFooter label="Save" />}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13.5 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" defaultChecked /> Email me about mentions
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" defaultChecked /> Weekly digest summary
              </label>
            </div>
          </Sheet>

          <Sheet
            id="security"
            title="Security"
            footer={<DoneFooter label="Done" />}
          >
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
              Two-factor authentication is enabled on your account. Last sign-in was 2 hours ago.
            </p>
          </Sheet>
        </SheetStack>
      </div>

      <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
        {(["auto", "sheet", "dialog"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            style={{
              padding: "5px 11px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: mode === m ? "var(--accent)" : "var(--surface)",
              color: mode === m ? "var(--accent-contrast)" : "var(--text-muted)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {m === "auto" ? "Auto" : m === "sheet" ? "Sheets" : "Dialogs"}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setStack([])}
          style={{
            padding: "5px 11px",
            borderRadius: 999,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text-muted)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
