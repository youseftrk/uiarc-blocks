import type { CSSProperties } from "react";
import { AgentRun } from "@/components/arc/blocks/agent-run";
import { AiChat } from "@/components/arc/blocks/ai-chat";
import { InvitePeople } from "@/components/arc/blocks/invite-people";
import { WalletCard } from "@/components/arc/blocks/wallet-card";
import styles from "./page.module.css";
import { ThemeToggle } from "./theme-toggle";

const BLOCKS = [
  { id: "agent-run", label: "Agent run", width: 7, className: styles.agentRun, description: "Timeline, approvals, pause and restart", node: <AgentRun /> },
  { id: "wallet-card", label: "Wallet card", width: 5, className: styles.walletCard, description: "Balance, chart scrubbing, transfers and activity", node: <WalletCard /> },
  { id: "invite-people", label: "Invite people", width: 5, className: styles.invitePeople, description: "Parsing, roles, seat limits and pending invites", node: <InvitePeople /> },
  { id: "ai-chat", label: "AI chat", width: 7, className: styles.aiChat, description: "Streaming answers, tools, sources and editing", node: <AiChat /> },
];

export default function Home() {
  return (
    <div className={styles.page}>
      <main>
        <section className={styles.section} id="blocks" aria-labelledby="blocks-title">
          <div className={styles.head}>
            <div className={styles.headRow}>
              <h1 id="blocks-title">Complete blocks, ready to ship</h1>
              <ThemeToggle className={styles.theme} />
            </div>
            <p>Whole flows built from the same parts, including interfaces for the AI products you build.</p>
          </div>
          <div className={styles.blocks}>
            {BLOCKS.map((block) => (
              <div key={block.id} id={block.id} className={styles.show} style={{ "--w": block.width } as CSSProperties} role="group" aria-label={block.label}>
                <div className={`${styles.mount} ${block.className}`}>
                  <div className={styles.mountInner}>{block.node}</div>
                </div>
                <p className={styles.caption}>
                  <strong>{block.label}</strong>
                  <span>{block.description}</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
