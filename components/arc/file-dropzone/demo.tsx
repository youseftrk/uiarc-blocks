"use client";

import { FileDropzone } from "./file-dropzone";

export default function AttachmentUpload() {
  return (
    <FileDropzone
      accept=".pdf,image/*"
      maxFiles={3}
      maxSize={10 * 1024 * 1024}
      onUpload={async (_item, { onProgress }) => {
        for (const pct of [25, 60, 100]) {
          await new Promise((r) => setTimeout(r, 250));
          onProgress(pct);
        }
      }}
    />
  );
}
