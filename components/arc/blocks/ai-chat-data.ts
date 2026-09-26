export type Model = { id: string; name: string; description: string };
export type Attachment = { id: string; name: string; url: string; width?: number; height?: number };
export type Source = { url: string; title: string; snippet?: string };
export type ToolKind = "search" | "read" | "image" | "code";
export type ToolStatus = "running" | "done" | "error";
export type ToolCall = { id: string; kind: ToolKind; running: string; done: string; detail?: string; status: ToolStatus };
export type AnswerStatus = "thinking" | "streaming" | "done" | "stopped" | "error";
export type Answer = {
  text: string;
  status: AnswerStatus;
  model: string;
  thinking?: string;
  thoughtFor?: number;
  tools?: ToolCall[];
  sources?: Source[];
};
export type UserMessage = { id: string; role: "user"; text: string; attachments?: Attachment[] };
export type AssistantMessage = { id: string; role: "assistant"; current: number; versions: Answer[] };
export type Message = UserMessage | AssistantMessage;
export type Conversation = { id: string; title: string; group: string; messages: Message[] };
export type Suggestion = { label: string; prompt: string; attachments?: Attachment[] };
export type StreamEvent =
  | { type: "thinking"; text: string }
  | { type: "tool"; tool: ToolCall }
  | { type: "sources"; sources: Source[] }
  | { type: "text"; text: string };
export type RespondInput = {
  conversationId: string;
  messages: Message[];
  prompt: string;
  attachments: Attachment[];
  model: string;
};
export type Responder = (input: RespondInput, signal: AbortSignal) => AsyncIterable<StreamEvent>;

export const MODELS: Model[] = [
  { id: "atlas-deep", name: "Atlas 4 Deep", description: "Thinks longer for analysis and code" },
  { id: "atlas", name: "Atlas 4", description: "Balanced for everyday work" },
  { id: "atlas-swift", name: "Atlas 4 Swift", description: "Fastest answers, no reasoning" },
];

export const SUGGESTIONS: Suggestion[] = [
  { label: "Compare Postgres and SQLite for offline sync", prompt: "Should our mobile app use Postgres or SQLite for offline sync?" },
  { label: "Write a query for weekly active teams", prompt: "Write a SQL query for weekly active teams over the last 12 weeks." },
  { label: "Draft a launch email for offline mode", prompt: "Draft a short launch email for offline mode. Keep it plain." },
  {
    label: "Suggest a palette for this room",
    prompt: "Suggest a color palette for this room.",
    attachments: [{ id: "sample-living-room", name: "living-room.jpg", url: "/media/photos/living-room.jpg", width: 1200, height: 1600 }],
  },
];

type Script = { thinking?: string; tools?: Omit<ToolCall, "status">[]; sources?: Source[]; text: string };

const SCRIPTS: Record<"sync" | "query" | "email" | "palette" | "fallback", Script> = {
  sync: {
    thinking:
      "The team ships a mobile app that has to work offline. The real question is where the source of truth lives and how conflicts resolve. SQLite runs on the device and Postgres on the server, so the answer is probably both. I should compare the jobs each one does and suggest a simple sync model to start with.",
    tools: [{ id: "search", kind: "search", running: "Searching the web", done: "Searched 3 sources", detail: "postgres sqlite offline sync mobile" }],
    sources: [
      { url: "https://www.sqlite.org/whentouse.html", title: "Appropriate uses for SQLite", snippet: "SQLite does not compete with client/server databases. SQLite competes with fopen()." },
      {
        url: "https://www.postgresql.org/docs/current/logical-replication.html",
        title: "Logical replication",
        snippet: "Logical replication is a method of replicating data objects and their changes, based upon their replication identity.",
      },
      {
        url: "https://www.inkandswitch.com/local-first/",
        title: "Local-first software",
        snippet: "You own your data, in spite of the cloud. Local-first apps keep the primary copy of the data on the device.",
      },
    ],
    text: `Use both. SQLite on the device and Postgres on the server, with a sync layer between them. They solve different halves of the problem [1].
## Where each one fits
- **SQLite** lives inside the app, so reads and writes work with no connection at all [1].
- **Postgres** stays the source of truth. Logical replication can stream row changes to your sync service [2].
- **The sync layer** decides what happens when two people edit the same record offline [3].
| | SQLite | Postgres |
| --- | --- | --- |
| Runs on | Each device | Your servers |
| Works offline | Yes | No |
| Concurrent writers | One at a time | Thousands |
| Typical size | A few GB | Terabytes |
## A starting schema
Track a version on every row so a device can ask for only what changed:
\`\`\`sql
create table tasks (
  id uuid primary key,
  title text not null,
  done boolean default false,
  version bigint not null default 1
);
select * from tasks
where version > $1
order by version;
\`\`\`
Start with last write wins per field. Reach for a CRDT only on fields people truly edit together, like shared notes [3].`,
  },
  query: {
    thinking:
      "Weekly active teams means a team with at least one member doing something meaningful that week. Page views should not count. I will check the schema for the events table first.",
    tools: [{ id: "schema", kind: "read", running: "Reading schema.sql", done: "Read schema.sql", detail: "events, teams, memberships" }],
    text: `This counts a team as active when any member creates or edits something that week. Page views are left out on purpose.
\`\`\`sql
select
  date_trunc('week', e.created_at) as week,
  count(distinct m.team_id) as active_teams
from events e
join memberships m on m.user_id = e.user_id
where e.name in ('doc_created', 'doc_edited', 'task_completed')
  and e.created_at >= now() - interval '12 weeks'
group by 1
order by 1;
\`\`\`
A few notes:
1. \`date_trunc\` starts weeks on Monday in Postgres.
2. A person in two teams counts toward both.
3. Add an index on \`events (name, created_at)\` if this runs on a schedule.`,
  },
  email: {
    thinking: "Plain tone, short, and it should say what changed and what to do next.",
    text: `**Subject:** Tandem now works offline
Hi Jordan,
Tandem now opens, saves, and syncs without a connection. Write on a flight, check tasks in a tunnel, and everything catches up the moment you are back online.
### What changed
- Notes, tasks, and comments load straight from your device.
- Edits made offline sync in the order you made them.
- If two people change the same note, you see both versions side by side.
Offline mode is on for every plan starting today. Update to version 4.3 to get it.
Thanks for waiting on this one,
Sofia`,
  },
  palette: {
    thinking:
      "A bright living room with timber beams, arched windows, and cream sofas. The palette should build on the warm wood and the pale plaster, with one deeper accent to ground it.",
    tools: [{ id: "image", kind: "image", running: "Looking at living-room.jpg", done: "Looked at living-room.jpg", detail: "Timber beams, arched windows, cream sofas" }],
    sources: [
      {
        url: "https://www.energy.gov/energysaver/lighting-choices-save-you-money",
        title: "Lighting choices to save you money",
        snippet: "Warm white bulbs give off a yellowish light that suits living rooms and bedrooms.",
      },
      {
        url: "https://www.nps.gov/articles/000/preservation-brief-10-exterior-paint.htm",
        title: "Paint and wood surfaces",
        snippet: "Choose finishes that let natural wood read as a material rather than a flat color.",
      },
    ],
    text: `The room already has a strong base in the pale plaster and the honey timber. Build on those and add one grounded accent.
### Suggested palette
| Role | Color | Hex |
| --- | --- | --- |
| Walls | Limewash white | \`#F2EDE4\` |
| Wood | Honey oak | \`#B98A5A\` |
| Textiles | Oat linen | \`#DCCFBC\` |
| Accent | Olive | \`#6B6B47\` |
- Keep the sofas cream and bring olive in through cushions or one armchair.
- Use warm white bulbs so the timber reads golden at night [1].
- Repeat the oak once more, such as a side table, so the beams do not float [2].`,
  },
  fallback: {
    thinking: "This preview only has scripted answers, so I should say so and show what a formatted reply looks like.",
    sources: [{ url: "https://commonmark.org", title: "CommonMark", snippet: "A strongly defined, highly compatible specification of Markdown." }],
    text: `This preview runs on scripted answers, so it cannot read your question yet. Connect \`respond\` to your model and the same surface streams real replies.
A reply can include:
- **Markdown** with headings, lists, tables, and code
- **Citations** that open a source card on hover [1]
- **Tool calls** that show what the assistant did along the way
Try one of the suggested prompts to see a full answer.`,
  },
};

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });

function pickScript(prompt: string, attachments: Attachment[]): Script {
  const p = prompt.toLowerCase();
  if (attachments.length || /palette|color|colour|room/.test(p)) return SCRIPTS.palette;
  if (/sqlite|postgres|offline sync|database/.test(p)) return SCRIPTS.sync;
  if (/sql|query|active teams|weekly/.test(p)) return SCRIPTS.query;
  if (/email|launch|announce/.test(p)) return SCRIPTS.email;
  return SCRIPTS.fallback;
}

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  const lines = text.split("\n");
  let inCode = false;
  let pending = "";
  const push = (piece: string) => {
    chunks.push(pending + piece);
    pending = "";
  };
  lines.forEach((line, i) => {
    if (!inCode && /^\|\s*-/.test(line)) return;
    pending += i === 0 ? "" : "\n";
    if (line.startsWith("```")) {
      inCode = !inCode;
      push(line);
      return;
    }
    if (inCode) return void push(line);
    if (!line.trim()) return;
    if (line.startsWith("|")) {
      const next = lines[i + 1] ?? "";
      push(/^\|\s*-/.test(next) ? `${line}\n${next}` : line);
      return;
    }
    const prefix = line.match(/^(#{1,3} |- |\d+\. |> )/)?.[0] ?? "";
    (line.slice(prefix.length).match(/\*\*[^*]+\*\*\S*|`[^`]+`\S*|\S+/g) ?? []).forEach((word, j) => push(j === 0 ? prefix + word : ` ${word}`));
  });
  if (pending) chunks.push(pending);
  return chunks;
}

export async function* scriptedRespond(input: RespondInput, signal: AbortSignal): AsyncGenerator<StreamEvent> {
  const script = pickScript(input.prompt, input.attachments);
  const deep = input.model === "atlas-deep";
  const swift = input.model === "atlas-swift";
  await sleep(swift ? 250 : 450, signal);
  if (script.thinking && !swift) {
    const words = script.thinking.split(" ");
    const step = deep ? 1 : 2;
    for (let i = 0; i < words.length; i += step) {
      yield { type: "thinking", text: (i ? " " : "") + words.slice(i, i + step).join(" ") };
      await sleep(deep ? 70 : 55, signal);
    }
    await sleep(300, signal);
  }
  for (const tool of script.tools ?? []) {
    yield { type: "tool", tool: { ...tool, status: "running" } };
    await sleep(swift ? 600 : 1100, signal);
    yield { type: "tool", tool: { ...tool, status: "done" } };
    await sleep(220, signal);
  }
  if (script.sources) yield { type: "sources", sources: script.sources };
  for (const chunk of chunkText(script.text)) {
    yield { type: "text", text: chunk };
    const long = chunk.length > 24;
    await sleep((swift ? 18 : 30) + (long ? 50 : 26 * Math.random()), signal);
  }
}

const answer = (a: Partial<Answer> & { text: string }): Answer => ({ model: "atlas", status: "done", ...a });

export const DEFAULT_CONVERSATIONS: Conversation[] = [
  {
    id: "pricing-test",
    title: "Annual discount test",
    group: "Today",
    messages: [
      { id: "pricing-q", role: "user", text: "Summarize the annual discount test so far." },
      {
        id: "pricing-a",
        role: "assistant",
        current: 0,
        versions: [
          answer({
            thoughtFor: 3,
            thinking: "Two weeks of data. Compare annual share, refunds, and revenue per visitor between control and the 20% discount.",
            text: `After 14 days, the 20% annual discount lifts annual plan share without hurting refunds.
| | Control | Discount |
| --- | --- | --- |
| Annual share | 29% | 38% |
| Refund requests | 1.2% | 1.1% |
| Revenue per visitor | $4.10 | $4.06 |
Revenue per visitor has not moved yet, because more people pick Starter. Offering the discount only on Team and above should keep the lift without the downgrade.`,
          }),
        ],
      },
    ],
  },
  {
    id: "checklist-copy",
    title: "Onboarding checklist copy",
    group: "Today",
    messages: [
      {
        id: "checklist-q",
        role: "user",
        text: "Make these onboarding steps shorter: connect your calendar so we can suggest meeting times, invite at least two teammates to your workspace, create your first project from a template.",
      },
      {
        id: "checklist-a",
        role: "assistant",
        current: 0,
        versions: [
          answer({
            model: "atlas-swift",
            text: `Here are shorter versions that still say what happens:
1. **Connect your calendar** to get suggested times
2. **Invite two teammates**
3. **Start a project** from a template
Each one starts with the action, so the list scans in a second.`,
          }),
        ],
      },
    ],
  },
  {
    id: "churn-interviews",
    title: "Churn interview themes",
    group: "Previous 7 days",
    messages: [
      { id: "churn-q", role: "user", text: "What came up most in the September churn interviews?" },
      {
        id: "churn-a",
        role: "assistant",
        current: 0,
        versions: [
          answer({
            thoughtFor: 5,
            tools: [{ id: "read", kind: "read", running: "Reading interviews.md", done: "Read 14 interviews", status: "done", detail: "september-interviews.md" }],
            text: `Three themes came up across the 14 interviews.
- **Setup took longer than the trial.** Seven teams never connected their calendar.
- **Managers had no shared view**, so the tool stayed with one person.
- **Budget freezes** ended two accounts that would not have stayed at any price.
Fix setup first. Every team that finished it within two days is still paying.`,
          }),
        ],
      },
    ],
  },
  {
    id: "incident-review",
    title: "Status page incident draft",
    group: "Previous 7 days",
    messages: [
      { id: "incident-q", role: "user", text: "Draft a status update for the sync delay this morning." },
      {
        id: "incident-a",
        role: "assistant",
        current: 0,
        versions: [
          answer({
            model: "atlas-swift",
            text: `**Resolved: delayed sync on mobile**
Between 8:12 and 8:47 AM Eastern, changes made on mobile took up to 20 minutes to appear on other devices. No data was lost. A queue worker stopped after a configuration change, and we have added an alert so a stalled queue pages the on call engineer within two minutes.`,
          }),
        ],
      },
    ],
  },
];
