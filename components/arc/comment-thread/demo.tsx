"use client";

import { CommentThread, type ThreadComment } from "./comment-thread";

const INITIAL: ThreadComment[] = [
  {
    id: "c1",
    author: { id: "u1", name: "Elena Vance" },
    body: "Should we tighten the hero subheading to two lines on mobile?",
    createdAt: "2h ago",
  },
  {
    id: "c2",
    author: { id: "u2", name: "Marcus Chen" },
    body: "Yes — trimming the second clause keeps the CTA above the fold.",
    createdAt: "1h ago",
  },
];

export default function HeadlineDiscussion() {
  return (
    <CommentThread
      title="Hero headline"
      currentUser={{ id: "u3", name: "Alex Rivera" }}
      defaultComments={INITIAL}
    />
  );
}
