"use client";

import { ResizablePanel, ResizablePanels } from "./resizable-panels";

export default function MailLayout() {
  return (
    <div style={{ height: 320, width: "100%" }}>
      <ResizablePanels label="Mail">
        <ResizablePanel id="folders" label="Folders" defaultSize={28} minSize={120} collapsible>
          <div style={{ padding: 14, fontSize: 13 }}>Inbox · Sent · Drafts · Archive</div>
        </ResizablePanel>
        <ResizablePanel id="messages" label="Messages" defaultSize={72}>
          <div style={{ padding: 14, fontSize: 13 }}>Select a message to read its contents.</div>
        </ResizablePanel>
      </ResizablePanels>
    </div>
  );
}
