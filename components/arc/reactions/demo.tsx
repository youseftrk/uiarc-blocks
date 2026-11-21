"use client";

import { Reactions } from "./reactions";
import { Heart, PartyPopper, ThumbsUp } from "lucide-react";

const options = [
  { id: "like", label: "Like", icon: ThumbsUp },
  { id: "love", label: "Love", icon: Heart },
  { id: "party", label: "Celebrate", icon: PartyPopper },
];

export default function CommentReactions() {
  return (
    <Reactions
      options={options}
      defaultValue={[{ id: "like", count: 3, reacted: false }]}
    />
  );
}
