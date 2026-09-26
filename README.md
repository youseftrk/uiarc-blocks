# UIarc Blocks

A recreation of the four blocks shown in the [UIarc](https://uiarc.dev/#blocks) landing page "Complete blocks, ready to ship" section, plus the shared primitives they are built from.

## Blocks

| Block | Path | Highlights |
| --- | --- | --- |
| Agent run | `components/arc/blocks/agent-run.tsx` | Step timeline, pause/resume, restart, approval boundary, expandable details, simulated PR result |
| Wallet card | `components/arc/blocks/wallet-card.tsx` | Wallet switching, hide balance, chart scrubbing, period selector, search, notifications, send/deposit/swap/buy forms with validation, activity list |
| Invite people | `components/arc/blocks/invite-people.tsx` | Name/email parsing, paste lists, duplicate and pending checks, roles, seat meter, Starter to Team upgrade, send/resend/revoke |
| AI chat | `components/arc/blocks/ai-chat.tsx` | Conversation history, model switcher, streaming with thinking, tool chips, sources and citation cards, Markdown/tables/code, edit, regenerate, attachments, narrow drawer |

## Shared primitives (`components/arc`)

`AnimatedCounter`, `ProBadge`, `SegmentedControl`, `DropdownMenu`, `Popover`, `Button`, `TextShimmer`, `TextScramble`, motion tokens (`tokens.ts`) and a reduced-motion hook.

Everything is plain TypeScript/React with CSS Modules, [Motion](https://motion.dev), [Radix](https://www.radix-ui.com/primitives) and [Lucide](https://lucide.dev). No network calls: the AI chat streams scripted answers through the `respond` prop, which you can swap for a real model.

## Develop

```bash
npm install
npm run dev     # http://localhost:3000
npm run lint
npx tsc --noEmit -p .
npm run build
```

Light and dark themes follow `data-theme` on `<html>`; the showcase page has a toggle.
