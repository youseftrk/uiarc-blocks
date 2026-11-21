"use client";

import { UserMenu } from "./user-menu";
import { CreditCard, Settings, UserRound } from "lucide-react";

export default function TopBarAccount() {
  return (
    <UserMenu
      user={{ name: "Ada Lovelace", email: "ada@uiarc.dev", plan: "Pro" }}
      showName
      items={[
        { label: "Profile", icon: <UserRound size={16} />, onSelect: () => {} },
        { label: "Settings", icon: <Settings size={16} />, keys: ["⌘", ","], onSelect: () => {} },
        { label: "Billing", icon: <CreditCard size={16} />, onSelect: () => {} },
      ]}
      onSignOut={() => {}}
    />
  );
}
