"use client";

import { ChatThread, type ChatMessage } from "./chat-thread";

const participants = [
  { id: "me", name: "Alex Rivera" },
  { id: "sam", name: "Sam Lee", avatar: "/avatars/sam.jpg" },
];

const messages: ChatMessage[] = [
  { id: "m1", authorId: "sam", text: "Is the build green?", createdAt: "2026-09-23T09:12:00Z" },
  { id: "m2", authorId: "me", text: "Yes, shipping now.", createdAt: "2026-09-23T09:13:00Z", status: "delivered" },
];

export default function SupportChat() {
  return (
    <div style={{ height: 520 }}>
      <ChatThread
        participants={participants}
        currentUserId="me"
        defaultMessages={messages}
        readBy={{ sam: "m2" }}
        typing={["sam"]}
        onSend={draft => console.log(draft.text, draft.files)}
      />
    </div>
  );
}
