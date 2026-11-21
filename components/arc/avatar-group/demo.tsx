"use client";

import { AvatarGroup } from "./avatar-group";

const team = [
  { name: "Maya Chen", src: "/people/maya.jpg", status: "online" as const },
  { name: "Leo Park" },
  { name: "Sara Ruiz" },
  { name: "Tom Hale" },
  { name: "Ines Ma" },
];

export default function Collaborators() {
  return <AvatarGroup members={team} max={3} label="Editors" />;
}
