"use client";

import { useState } from "react";
import { RichTextEditor, type RichTextValue } from "./rich-text-editor";

export default function PostEditor() {
  const [doc, setDoc] = useState<RichTextValue | null>(null);
  return (
    <>
      <RichTextEditor
        aria-label="Post body"
        placeholder="Write your update"
        defaultMarkdown={"# Release notes\n\n- Faster search\n- New **dark** theme"}
        onChange={setDoc}
      />
      <button type="button" disabled={!doc || doc.empty} onClick={() => save(doc!.markdown)}>
        Publish
      </button>
    </>
  );
}

declare function save(markdown: string): void;
