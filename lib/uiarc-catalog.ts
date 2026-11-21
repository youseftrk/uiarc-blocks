export type ComponentTier = "free" | "pro";

export interface CatalogComponent {
  name: string;
  title: string;
  category: string;
  tier: ComponentTier;
  description: string;
  docs: string;
}

export const UIARC_CATEGORIES = [
  "Actions",
  "Data",
  "Disclosure",
  "Feedback",
  "Inputs",
  "Text",
  "Special",
] as const;

export const UIARC_COMPONENTS: CatalogComponent[] = [
  {
    "name": "action-button",
    "title": "Action button",
    "category": "Actions",
    "tier": "free",
    "description": "A compact button for frequent toolbar actions.",
    "docs": "https://uiarc.dev/components/action-button"
  },
  {
    "name": "action-swap",
    "title": "Action swap",
    "category": "Actions",
    "tier": "free",
    "description": "Swap an action label while preserving its place and intent.",
    "docs": "https://uiarc.dev/components/action-swap"
  },
  {
    "name": "button",
    "title": "Button",
    "category": "Actions",
    "tier": "free",
    "description": "A clear, responsive action with quiet secondary states.",
    "docs": "https://uiarc.dev/components/button"
  },
  {
    "name": "button-group",
    "title": "Button group",
    "category": "Actions",
    "tier": "free",
    "description": "Related actions joined into one surface with hairline dividers: a hover highlight glides between segments, the pressed one answers in place, and an attached menu can close the row.",
    "docs": "https://uiarc.dev/components/button-group"
  },
  {
    "name": "confirm-morph",
    "title": "Confirm morph",
    "category": "Actions",
    "tier": "free",
    "description": "A destructive button that morphs into an inline confirmation, a spinner, and a result with undo.",
    "docs": "https://uiarc.dev/components/confirm-morph"
  },
  {
    "name": "context-menu",
    "title": "Context menu",
    "category": "Actions",
    "tier": "free",
    "description": "Secondary actions kept close to the selected object.",
    "docs": "https://uiarc.dev/components/context-menu"
  },
  {
    "name": "copy-button",
    "title": "Copy button",
    "category": "Actions",
    "tier": "free",
    "description": "Copy a value with immediate confirmation.",
    "docs": "https://uiarc.dev/components/copy-button"
  },
  {
    "name": "dropdown-menu",
    "title": "Dropdown menu",
    "category": "Actions",
    "tier": "free",
    "description": "A focused list of actions anchored to a trigger.",
    "docs": "https://uiarc.dev/components/dropdown-menu"
  },
  {
    "name": "expanding-button-group",
    "title": "Expanding button group",
    "category": "Actions",
    "tier": "free",
    "description": "Icon buttons in a compact group: the one you point at or focus grows to reveal its label while its neighbours slide aside, and an action confirms in place.",
    "docs": "https://uiarc.dev/components/expanding-button-group"
  },
  {
    "name": "floating-button-group",
    "title": "Floating button group",
    "category": "Actions",
    "tier": "free",
    "description": "Separate soft buttons in a quiet tray, with one shared highlight that morphs from button to button as you move, and a pressed state that settles in place.",
    "docs": "https://uiarc.dev/components/floating-button-group"
  },
  {
    "name": "hold-to-confirm",
    "title": "Hold to confirm",
    "category": "Actions",
    "tier": "free",
    "description": "Confirm a destructive action by holding, not tapping.",
    "docs": "https://uiarc.dev/components/hold-to-confirm"
  },
  {
    "name": "icon-morph",
    "title": "Icon morph",
    "category": "Actions",
    "tier": "free",
    "description": "Icons that morph between states: menu to close, play to pause, copy to check, and more.",
    "docs": "https://uiarc.dev/components/icon-morph"
  },
  {
    "name": "reactions",
    "title": "Reactions",
    "category": "Actions",
    "tier": "free",
    "description": "Acknowledge a post in one tap, with counts that roll.",
    "docs": "https://uiarc.dev/components/reactions"
  },
  {
    "name": "split-button",
    "title": "Split button",
    "category": "Actions",
    "tier": "free",
    "description": "A primary action with a menu of nearby alternatives.",
    "docs": "https://uiarc.dev/components/split-button"
  },
  {
    "name": "swipe-actions",
    "title": "Swipe actions",
    "category": "Actions",
    "tier": "free",
    "description": "Reveal row actions with a swipe, or from the same actions in a menu.",
    "docs": "https://uiarc.dev/components/swipe-actions"
  },
  {
    "name": "theme-switch",
    "title": "Theme switcher",
    "category": "Actions",
    "tier": "free",
    "description": "Four smooth ways to move between light and dark appearance.",
    "docs": "https://uiarc.dev/components/theme-switch"
  },
  {
    "name": "theme-switch-eclipse",
    "title": "Eclipse",
    "category": "Actions",
    "tier": "free",
    "description": "The next appearance crosses the page like an eclipse.",
    "docs": "https://uiarc.dev/components/theme-switch-eclipse"
  },
  {
    "name": "theme-switch-rise",
    "title": "Rise",
    "category": "Actions",
    "tier": "free",
    "description": "The next appearance rises into place.",
    "docs": "https://uiarc.dev/components/theme-switch-rise"
  },
  {
    "name": "theme-switch-split",
    "title": "Split",
    "category": "Actions",
    "tier": "free",
    "description": "The next appearance opens from a slim center seam.",
    "docs": "https://uiarc.dev/components/theme-switch-split"
  },
  {
    "name": "user-menu",
    "title": "User menu",
    "category": "Actions",
    "tier": "free",
    "description": "Your account, settings, theme, and sign out behind the avatar. Opens as a bottom sheet on phones.",
    "docs": "https://uiarc.dev/components/user-menu"
  },
  {
    "name": "activity-heatmap",
    "title": "Activity heatmap",
    "category": "Data",
    "tier": "free",
    "description": "See a year of activity at a glance, one square per day.",
    "docs": "https://uiarc.dev/components/activity-heatmap"
  },
  {
    "name": "animated-counter",
    "title": "Animated counter",
    "category": "Data",
    "tier": "free",
    "description": "Give changing totals a clear sense of movement.",
    "docs": "https://uiarc.dev/components/animated-counter"
  },
  {
    "name": "avatar",
    "title": "Avatar",
    "category": "Data",
    "tier": "free",
    "description": "A compact identity marker for people and accounts.",
    "docs": "https://uiarc.dev/components/avatar"
  },
  {
    "name": "avatar-group",
    "title": "Avatar group",
    "category": "Data",
    "tier": "free",
    "description": "Show a team or set of contributors in a small space.",
    "docs": "https://uiarc.dev/components/avatar-group"
  },
  {
    "name": "badge",
    "title": "Badge",
    "category": "Data",
    "tier": "free",
    "description": "A small label for status, category, or metadata.",
    "docs": "https://uiarc.dev/components/badge"
  },
  {
    "name": "bar-chart",
    "title": "Bar chart",
    "category": "Data",
    "tier": "free",
    "description": "Compare one measure across days and scrub any bar for its value.",
    "docs": "https://uiarc.dev/components/bar-chart"
  },
  {
    "name": "brush-chart",
    "title": "Brush chart",
    "category": "Data",
    "tier": "free",
    "description": "A dense time series with an overview strip: drag a window to zoom, resize it by its handles, and read events in place.",
    "docs": "https://uiarc.dev/components/brush-chart"
  },
  {
    "name": "card",
    "title": "Card",
    "category": "Data",
    "tier": "free",
    "description": "A contained group of related content and actions.",
    "docs": "https://uiarc.dev/components/card"
  },
  {
    "name": "card-stack",
    "title": "Card stack",
    "category": "Data",
    "tier": "free",
    "description": "Review a deck one card at a time, with a throw and an undo.",
    "docs": "https://uiarc.dev/components/card-stack"
  },
  {
    "name": "carousel",
    "title": "Carousel",
    "category": "Data",
    "tier": "free",
    "description": "Browse a row of slides by dragging, flicking, or arrowing through them.",
    "docs": "https://uiarc.dev/components/carousel"
  },
  {
    "name": "chat-thread",
    "title": "Chat thread",
    "category": "Data",
    "tier": "free",
    "description": "A chat thread with grouped messages, reactions, read receipts, typing, and a composer with attachments.",
    "docs": "https://uiarc.dev/components/chat-thread"
  },
  {
    "name": "code-block",
    "title": "Code block",
    "category": "Data",
    "tier": "free",
    "description": "Present code with legible hierarchy and copy access.",
    "docs": "https://uiarc.dev/components/code-block"
  },
  {
    "name": "comment-thread",
    "title": "Comment thread",
    "category": "Data",
    "tier": "free",
    "description": "Threaded comments with replies, reactions, mentions, inline edit, and resolve.",
    "docs": "https://uiarc.dev/components/comment-thread"
  },
  {
    "name": "data-grid",
    "title": "Data grid",
    "category": "Data",
    "tier": "pro",
    "description": "A spreadsheet grid with range selection, inline editing, a fill handle, and animated sorting.",
    "docs": "https://uiarc.dev/components/data-grid"
  },
  {
    "name": "donut-chart",
    "title": "Donut chart",
    "category": "Data",
    "tier": "free",
    "description": "A donut whose arcs morph between datasets, with the active value rolling into the center.",
    "docs": "https://uiarc.dev/components/donut-chart"
  },
  {
    "name": "empty-state",
    "title": "Empty state",
    "category": "Data",
    "tier": "free",
    "description": "A useful next step when there is nothing to show yet.",
    "docs": "https://uiarc.dev/components/empty-state"
  },
  {
    "name": "filter-toolbar",
    "title": "Filter toolbar",
    "category": "Data",
    "tier": "free",
    "description": "Keep collection filters close and easy to reset.",
    "docs": "https://uiarc.dev/components/filter-toolbar"
  },
  {
    "name": "funnel-chart",
    "title": "Funnel chart",
    "category": "Data",
    "tier": "pro",
    "description": "A tapered conversion funnel with drop-off at every step, a device split that morphs the band, and dots that stream through it.",
    "docs": "https://uiarc.dev/components/funnel-chart"
  },
  {
    "name": "gauge",
    "title": "Gauge",
    "category": "Data",
    "tier": "free",
    "description": "Show a value against a known range.",
    "docs": "https://uiarc.dev/components/gauge"
  },
  {
    "name": "image-compare",
    "title": "Image compare",
    "category": "Data",
    "tier": "free",
    "description": "Drag a divider across two images to see what changed.",
    "docs": "https://uiarc.dev/components/image-compare"
  },
  {
    "name": "json-viewer",
    "title": "JSON viewer",
    "category": "Data",
    "tier": "free",
    "description": "A collapsible JSON tree with search, paging for long arrays, and copy value or path.",
    "docs": "https://uiarc.dev/components/json-viewer"
  },
  {
    "name": "line-chart",
    "title": "Line chart",
    "category": "Data",
    "tier": "free",
    "description": "A multi-series line chart with a gliding crosshair, legend toggles, and paths that morph between ranges.",
    "docs": "https://uiarc.dev/components/line-chart"
  },
  {
    "name": "metric-card",
    "title": "Metric card",
    "category": "Data",
    "tier": "free",
    "description": "A compact summary for a number that needs context.",
    "docs": "https://uiarc.dev/components/metric-card"
  },
  {
    "name": "metric-ticker",
    "title": "Metric ticker",
    "category": "Data",
    "tier": "pro",
    "description": "A strip of live KPIs that roll to new values digit by digit and flash their change; rest on one to pause the strip and open its recent trend as a sparkline.",
    "docs": "https://uiarc.dev/components/metric-ticker"
  },
  {
    "name": "pagination",
    "title": "Pagination",
    "category": "Data",
    "tier": "free",
    "description": "Move through a long collection with clear bounds.",
    "docs": "https://uiarc.dev/components/pagination"
  },
  {
    "name": "presence-stack",
    "title": "Presence stack",
    "category": "Data",
    "tier": "pro",
    "description": "Avatars of the people here now: joins pop in as the stack reflows, a counter rolls past the limit, dots show typing and idle, and hover fans it out with a gliding name label.",
    "docs": "https://uiarc.dev/components/presence-stack"
  },
  {
    "name": "race-bar-chart",
    "title": "Race bar chart",
    "category": "Data",
    "tier": "pro",
    "description": "A ranking over time: bars overtake each other on springs, values count up, and a timeline you can play or scrub.",
    "docs": "https://uiarc.dev/components/race-bar-chart"
  },
  {
    "name": "radar-chart",
    "title": "Radar chart",
    "category": "Data",
    "tier": "pro",
    "description": "Two or three profiles on one web: shapes morph when you swap a profile, and a sweep across the axes compares values in place.",
    "docs": "https://uiarc.dev/components/radar-chart"
  },
  {
    "name": "realtime-stream",
    "title": "Realtime stream",
    "category": "Data",
    "tier": "pro",
    "description": "A live line that scrolls at 60fps as readings arrive, holds still on hover to read, and pops a marker on every anomaly.",
    "docs": "https://uiarc.dev/components/realtime-stream"
  },
  {
    "name": "reorderable-list",
    "title": "Reorderable list",
    "category": "Data",
    "tier": "free",
    "description": "Organize items with direct drag and drop.",
    "docs": "https://uiarc.dev/components/reorderable-list"
  },
  {
    "name": "ridgeline",
    "title": "Ridgeline",
    "category": "Data",
    "tier": "free",
    "description": "Overlapping distributions, one ridge per group: hover to lift a ridge and read its quartiles, switch datasets and every curve morphs.",
    "docs": "https://uiarc.dev/components/ridgeline"
  },
  {
    "name": "sankey-flow",
    "title": "Sankey flow",
    "category": "Data",
    "tier": "pro",
    "description": "Flows between stages as ribbons with drifting particles; hover any node or ribbon to pour its share through the whole journey.",
    "docs": "https://uiarc.dev/components/sankey-flow"
  },
  {
    "name": "slope-chart",
    "title": "Slope chart",
    "category": "Data",
    "tier": "free",
    "description": "Before and after on two axes: lines draw in, rank moves sit beside each value, and switching datasets slides every line to its new slope.",
    "docs": "https://uiarc.dev/components/slope-chart"
  },
  {
    "name": "sortable-data-table",
    "title": "Sortable data table",
    "category": "Data",
    "tier": "free",
    "description": "Compare structured records with sortable columns.",
    "docs": "https://uiarc.dev/components/sortable-data-table"
  },
  {
    "name": "sparkline",
    "title": "Sparkline",
    "category": "Data",
    "tier": "free",
    "description": "Show a compact trend beside a value.",
    "docs": "https://uiarc.dev/components/sparkline"
  },
  {
    "name": "split-bar",
    "title": "Split bar",
    "category": "Data",
    "tier": "pro",
    "description": "A single 100% bar split into shares: rest on a segment to widen it and read its exact figures, toggle segments from the legend and the rest reflow, with labels inside when they fit and on leader lines when they don't.",
    "docs": "https://uiarc.dev/components/split-bar"
  },
  {
    "name": "streamgraph",
    "title": "Streamgraph",
    "category": "Data",
    "tier": "free",
    "description": "Layered streams on a wiggle baseline that morph between ranges, with a layer you can isolate and read week by week.",
    "docs": "https://uiarc.dev/components/streamgraph"
  },
  {
    "name": "sunburst",
    "title": "Sunburst",
    "category": "Data",
    "tier": "pro",
    "description": "A hierarchy in rings: click a segment and every arc swings around it as the new centre, with a breadcrumb back and a rolling total.",
    "docs": "https://uiarc.dev/components/sunburst"
  },
  {
    "name": "timeline",
    "title": "Timeline",
    "category": "Data",
    "tier": "free",
    "description": "Follow what happened, newest first, grouped by day.",
    "docs": "https://uiarc.dev/components/timeline"
  },
  {
    "name": "tree-table",
    "title": "Tree table",
    "category": "Data",
    "tier": "free",
    "description": "A table with nested rows, tri-state selection, hierarchy-preserving sort, and lazy-loaded children.",
    "docs": "https://uiarc.dev/components/tree-table"
  },
  {
    "name": "tree-view",
    "title": "Tree view",
    "category": "Data",
    "tier": "free",
    "description": "Navigate nested folders and structured content.",
    "docs": "https://uiarc.dev/components/tree-view"
  },
  {
    "name": "treemap",
    "title": "Treemap",
    "category": "Data",
    "tier": "free",
    "description": "A squarified treemap: click to drill and the tiles grow to fill the view, with a breadcrumb back and metrics that morph every tile.",
    "docs": "https://uiarc.dev/components/treemap"
  },
  {
    "name": "waffle-chart",
    "title": "Waffle chart",
    "category": "Data",
    "tier": "free",
    "description": "A ten by ten unit chart where every cell is one percent, and cells fly to their new group when the data changes.",
    "docs": "https://uiarc.dev/components/waffle-chart"
  },
  {
    "name": "accordion",
    "title": "Accordion",
    "category": "Disclosure",
    "tier": "free",
    "description": "Progressively reveal supporting information in place.",
    "docs": "https://uiarc.dev/components/accordion"
  },
  {
    "name": "bottom-sheet",
    "title": "Bottom sheet",
    "category": "Disclosure",
    "tier": "free",
    "description": "A sheet that rests at a peek or full height and follows your finger.",
    "docs": "https://uiarc.dev/components/bottom-sheet"
  },
  {
    "name": "breadcrumb",
    "title": "Breadcrumb",
    "category": "Disclosure",
    "tier": "free",
    "description": "Show where a page sits in a hierarchy.",
    "docs": "https://uiarc.dev/components/breadcrumb"
  },
  {
    "name": "confirm-popover",
    "title": "Confirm popover",
    "category": "Disclosure",
    "tier": "pro",
    "description": "A destructive button that grows into a small confirmation card, with the consequence, optional type-to-confirm, progress on the Confirm button, and a check or error before folding back.",
    "docs": "https://uiarc.dev/components/confirm-popover"
  },
  {
    "name": "dialog",
    "title": "Dialog",
    "category": "Disclosure",
    "tier": "free",
    "description": "A focused surface for decisions that need attention.",
    "docs": "https://uiarc.dev/components/dialog"
  },
  {
    "name": "drawer",
    "title": "Drawer",
    "category": "Disclosure",
    "tier": "free",
    "description": "A temporary side surface for focused work.",
    "docs": "https://uiarc.dev/components/drawer"
  },
  {
    "name": "expandable-card",
    "title": "Expandable card",
    "category": "Disclosure",
    "tier": "free",
    "description": "Give a dense card more room when requested.",
    "docs": "https://uiarc.dev/components/expandable-card"
  },
  {
    "name": "expandable-text",
    "title": "Expandable text",
    "category": "Disclosure",
    "tier": "free",
    "description": "Long text clamped to a few lines with a soft fade that glides open with Read more and closes with Show less, shown only when the text overflows.",
    "docs": "https://uiarc.dev/components/expandable-text"
  },
  {
    "name": "hover-card",
    "title": "Hover card",
    "category": "Disclosure",
    "tier": "free",
    "description": "Preview a person or link on hover or focus without leaving the page.",
    "docs": "https://uiarc.dev/components/hover-card"
  },
  {
    "name": "mega-menu-morph",
    "title": "Mega menu morph",
    "category": "Disclosure",
    "tier": "pro",
    "description": "A site header whose menus share one floating panel. Moving between sections morphs its size, slides the next menu in from that side and glides the caret under the new trigger, with hover intent, a safe triangle and an accordion sheet on narrow screens.",
    "docs": "https://uiarc.dev/components/mega-menu-morph"
  },
  {
    "name": "popover",
    "title": "Popover",
    "category": "Disclosure",
    "tier": "free",
    "description": "A small anchored surface for contextual information.",
    "docs": "https://uiarc.dev/components/popover"
  },
  {
    "name": "resizable-panels",
    "title": "Resizable panels",
    "category": "Disclosure",
    "tier": "free",
    "description": "Trade space between panes by dragging the divider between them.",
    "docs": "https://uiarc.dev/components/resizable-panels"
  },
  {
    "name": "scroll-area",
    "title": "Scroll area",
    "category": "Disclosure",
    "tier": "free",
    "description": "A native scroll container with thin overlay scrollbars and edge fades that appear only when content overflows.",
    "docs": "https://uiarc.dev/components/scroll-area"
  },
  {
    "name": "share-access",
    "title": "Share access",
    "category": "Disclosure",
    "tier": "pro",
    "description": "A share panel: invite people as validated email chips with suggestions, change roles from a compact menu, remove with undo, switch link access and copy the link, with every change landing in place.",
    "docs": "https://uiarc.dev/components/share-access"
  },
  {
    "name": "tabs",
    "title": "Tabs",
    "category": "Disclosure",
    "tier": "free",
    "description": "Switch between related content in the same context.",
    "docs": "https://uiarc.dev/components/tabs"
  },
  {
    "name": "toc-progress",
    "title": "Table of contents progress",
    "category": "Disclosure",
    "tier": "pro",
    "description": "A table of contents that reads along with you: a line bends through the nested headings, fills as you scroll, and carries a marker to the current section, with smooth jumps and a time-left countdown.",
    "docs": "https://uiarc.dev/components/toc-progress"
  },
  {
    "name": "tooltip",
    "title": "Tooltip",
    "category": "Disclosure",
    "tier": "free",
    "description": "Short supporting text for unfamiliar controls.",
    "docs": "https://uiarc.dev/components/tooltip"
  },
  {
    "name": "alert",
    "title": "Alert",
    "category": "Feedback",
    "tier": "free",
    "description": "A persistent message that helps people recover or continue.",
    "docs": "https://uiarc.dev/components/alert"
  },
  {
    "name": "announcement-bar",
    "title": "Announcement bar",
    "category": "Feedback",
    "tier": "free",
    "description": "A top banner that rotates messages, counts down, and collapses smoothly when dismissed.",
    "docs": "https://uiarc.dev/components/announcement-bar"
  },
  {
    "name": "cookie-consent",
    "title": "Cookie consent",
    "category": "Feedback",
    "tier": "free",
    "description": "A consent bar that morphs into preferences and folds into a reopen button.",
    "docs": "https://uiarc.dev/components/cookie-consent"
  },
  {
    "name": "countdown",
    "title": "Countdown",
    "category": "Feedback",
    "tier": "free",
    "description": "A launch countdown with rolling digits that morphs into a live state at zero.",
    "docs": "https://uiarc.dev/components/countdown"
  },
  {
    "name": "onboarding-checklist",
    "title": "Onboarding checklist",
    "category": "Feedback",
    "tier": "free",
    "description": "Guide a new workspace through setup, one step at a time.",
    "docs": "https://uiarc.dev/components/onboarding-checklist"
  },
  {
    "name": "progress",
    "title": "Progress",
    "category": "Feedback",
    "tier": "free",
    "description": "Show how much of a known task is complete.",
    "docs": "https://uiarc.dev/components/progress"
  },
  {
    "name": "skeleton",
    "title": "Skeleton",
    "category": "Feedback",
    "tier": "free",
    "description": "Reserve space while content is still loading.",
    "docs": "https://uiarc.dev/components/skeleton"
  },
  {
    "name": "stepper",
    "title": "Stepper",
    "category": "Feedback",
    "tier": "free",
    "description": "Show where a person is in a multi-step flow and what is done.",
    "docs": "https://uiarc.dev/components/stepper"
  },
  {
    "name": "toast",
    "title": "Toast",
    "category": "Feedback",
    "tier": "free",
    "description": "Brief confirmation for a completed background action.",
    "docs": "https://uiarc.dev/components/toast"
  },
  {
    "name": "toast-stack",
    "title": "Toast stack",
    "category": "Feedback",
    "tier": "free",
    "description": "Stack short results at the edge until you reach for them.",
    "docs": "https://uiarc.dev/components/toast-stack"
  },
  {
    "name": "undo-toast",
    "title": "Undo toast",
    "category": "Feedback",
    "tier": "pro",
    "description": "Archive or delete rows with a second chance: the gap closes, a countdown toast merges repeat actions, and Undo or \\u2318Z puts every row back exactly where it was.",
    "docs": "https://uiarc.dev/components/undo-toast"
  },
  {
    "name": "usage-meter",
    "title": "Usage meter",
    "category": "Feedback",
    "tier": "free",
    "description": "Show what fills an allowance and how close it is to the limit.",
    "docs": "https://uiarc.dev/components/usage-meter"
  },
  {
    "name": "avatar-upload",
    "title": "Avatar upload",
    "category": "Inputs",
    "tier": "pro",
    "description": "Click or drop a photo onto the avatar to crop it in place with drag, pinch and zoom. It uploads through a progress ring and settles, with clear errors and retry.",
    "docs": "https://uiarc.dev/components/avatar-upload"
  },
  {
    "name": "billing-toggle",
    "title": "Billing toggle",
    "category": "Inputs",
    "tier": "free",
    "description": "A monthly and yearly switch with a savings badge and prices that roll to the new amount.",
    "docs": "https://uiarc.dev/components/billing-toggle"
  },
  {
    "name": "calendar",
    "title": "Calendar",
    "category": "Inputs",
    "tier": "free",
    "description": "Browse dates in a clear, compact month view.",
    "docs": "https://uiarc.dev/components/calendar"
  },
  {
    "name": "checkbox",
    "title": "Checkbox",
    "category": "Inputs",
    "tier": "free",
    "description": "A binary choice with a precise, legible state.",
    "docs": "https://uiarc.dev/components/checkbox"
  },
  {
    "name": "chip-group",
    "title": "Chip group",
    "category": "Inputs",
    "tier": "free",
    "description": "Filter by a few facets with chips that morph as you pick them.",
    "docs": "https://uiarc.dev/components/chip-group"
  },
  {
    "name": "color-picker",
    "title": "Color picker",
    "category": "Inputs",
    "tier": "free",
    "description": "A swatch that grows into a picker with format morphing, eyedropper, saved swatches, and contrast readout.",
    "docs": "https://uiarc.dev/components/color-picker"
  },
  {
    "name": "combobox",
    "title": "Combobox",
    "category": "Inputs",
    "tier": "free",
    "description": "Search and select from a list without leaving the field.",
    "docs": "https://uiarc.dev/components/combobox"
  },
  {
    "name": "date-picker",
    "title": "Date picker",
    "category": "Inputs",
    "tier": "free",
    "description": "Choose a date without losing context.",
    "docs": "https://uiarc.dev/components/date-picker"
  },
  {
    "name": "date-range-picker",
    "title": "Date range picker",
    "category": "Inputs",
    "tier": "free",
    "description": "A range picker that grows from its trigger into two months with presets and a stretching range highlight.",
    "docs": "https://uiarc.dev/components/date-range-picker"
  },
  {
    "name": "elastic-slider",
    "title": "Elastic slider",
    "category": "Inputs",
    "tier": "free",
    "description": "A slider that stretches like rubber past its ends, with a swaying value tag and detents the thumb clicks into.",
    "docs": "https://uiarc.dev/components/elastic-slider"
  },
  {
    "name": "emoji-picker",
    "title": "Emoji picker",
    "category": "Inputs",
    "tier": "pro",
    "description": "A full emoji picker with instant search, scroll-synced categories, skin tones, recently used emoji, and a virtualized, keyboard-navigable grid.",
    "docs": "https://uiarc.dev/components/emoji-picker"
  },
  {
    "name": "expanding-search",
    "title": "Expanding search",
    "category": "Inputs",
    "tier": "free",
    "description": "An icon that morphs into a search field with results beneath it.",
    "docs": "https://uiarc.dev/components/expanding-search"
  },
  {
    "name": "file-dropzone",
    "title": "File dropzone",
    "category": "Inputs",
    "tier": "free",
    "description": "A generous target for dropping one or more files.",
    "docs": "https://uiarc.dev/components/file-dropzone"
  },
  {
    "name": "inline-edit",
    "title": "Inline edit",
    "category": "Inputs",
    "tier": "free",
    "description": "Rename in place: the text becomes a field without moving.",
    "docs": "https://uiarc.dev/components/inline-edit"
  },
  {
    "name": "input",
    "title": "Input",
    "category": "Inputs",
    "tier": "free",
    "description": "A single line field with clear labels and useful states.",
    "docs": "https://uiarc.dev/components/input"
  },
  {
    "name": "lens-range",
    "title": "Lens range",
    "category": "Inputs",
    "tier": "pro",
    "description": "A range on a fine scale that magnifies like a dock under each thumb, with magnetic presets and value bubbles that fuse into one when they meet.",
    "docs": "https://uiarc.dev/components/lens-range"
  },
  {
    "name": "mention-input",
    "title": "Mention input",
    "category": "Inputs",
    "tier": "free",
    "description": "A textarea with @people and #channel mentions that act as single tokens, with suggestions at the caret.",
    "docs": "https://uiarc.dev/components/mention-input"
  },
  {
    "name": "money-input",
    "title": "Money input",
    "category": "Inputs",
    "tier": "free",
    "description": "A currency field with live grouping, stable width, rolling digits, and minor-unit output.",
    "docs": "https://uiarc.dev/components/money-input"
  },
  {
    "name": "morph-select",
    "title": "Morph select",
    "category": "Inputs",
    "tier": "free",
    "description": "A select whose trigger grows into the list, with a gliding highlight and type-ahead.",
    "docs": "https://uiarc.dev/components/morph-select"
  },
  {
    "name": "multi-select",
    "title": "Multi-select",
    "category": "Inputs",
    "tier": "free",
    "description": "Select several values while keeping the field readable.",
    "docs": "https://uiarc.dev/components/multi-select"
  },
  {
    "name": "number-field",
    "title": "Number field",
    "category": "Inputs",
    "tier": "free",
    "description": "Enter a bounded number with clear increment controls.",
    "docs": "https://uiarc.dev/components/number-field"
  },
  {
    "name": "password-field",
    "title": "Password field",
    "category": "Inputs",
    "tier": "free",
    "description": "Capture sensitive text with a visible reveal control.",
    "docs": "https://uiarc.dev/components/password-field"
  },
  {
    "name": "password-strength",
    "title": "Password strength",
    "category": "Inputs",
    "tier": "free",
    "description": "Show how strong a new password is while it is typed.",
    "docs": "https://uiarc.dev/components/password-strength"
  },
  {
    "name": "phone-input",
    "title": "Phone input",
    "category": "Inputs",
    "tier": "free",
    "description": "A phone field with a country picker, formatting as you type, and E.164 output.",
    "docs": "https://uiarc.dev/components/phone-input"
  },
  {
    "name": "radio-cards",
    "title": "Radio cards",
    "category": "Inputs",
    "tier": "free",
    "description": "Selectable option cards with a sliding selection ring, price and description slots, and radio keyboard behavior.",
    "docs": "https://uiarc.dev/components/radio-cards"
  },
  {
    "name": "radio-group",
    "title": "Radio group",
    "category": "Inputs",
    "tier": "free",
    "description": "Choose one option from a visible set.",
    "docs": "https://uiarc.dev/components/radio-group"
  },
  {
    "name": "range-histogram-slider",
    "title": "Range histogram slider",
    "category": "Inputs",
    "tier": "free",
    "description": "A price range over a live histogram of the data, lighting the bars inside the range and settling on bar edges.",
    "docs": "https://uiarc.dev/components/range-histogram-slider"
  },
  {
    "name": "rating",
    "title": "Rating",
    "category": "Inputs",
    "tier": "free",
    "description": "A simple, accessible way to capture a numeric opinion.",
    "docs": "https://uiarc.dev/components/rating"
  },
  {
    "name": "rich-text-editor",
    "title": "Rich text editor",
    "category": "Inputs",
    "tier": "free",
    "description": "A lightweight editor with markdown shortcuts, a floating toolbar, a slash menu, and HTML and markdown output.",
    "docs": "https://uiarc.dev/components/rich-text-editor"
  },
  {
    "name": "ruler-slider",
    "title": "Ruler slider",
    "category": "Inputs",
    "tier": "free",
    "description": "A tape of ticks that slides under a fixed needle, with momentum, snapping, and a rolling readout.",
    "docs": "https://uiarc.dev/components/ruler-slider"
  },
  {
    "name": "scrub-input",
    "title": "Scrub input",
    "category": "Inputs",
    "tier": "free",
    "description": "A Figma-style number field: drag the label to scrub, or type values, units, and arithmetic.",
    "docs": "https://uiarc.dev/components/scrub-input"
  },
  {
    "name": "search-field",
    "title": "Search field",
    "category": "Inputs",
    "tier": "free",
    "description": "A recognizable search entry point with clear affordances.",
    "docs": "https://uiarc.dev/components/search-field"
  },
  {
    "name": "segmented-control",
    "title": "Segmented control",
    "category": "Inputs",
    "tier": "free",
    "description": "Switch between a small set of related views.",
    "docs": "https://uiarc.dev/components/segmented-control"
  },
  {
    "name": "select",
    "title": "Select",
    "category": "Inputs",
    "tier": "free",
    "description": "A compact choice field with a keyboard friendly menu.",
    "docs": "https://uiarc.dev/components/select"
  },
  {
    "name": "shortcut-recorder",
    "title": "Shortcut recorder",
    "category": "Inputs",
    "tier": "free",
    "description": "Record key combinations into key caps, with conflict warnings, Kbd, and a searchable cheatsheet.",
    "docs": "https://uiarc.dev/components/shortcut-recorder"
  },
  {
    "name": "signature-pad",
    "title": "Signature pad",
    "category": "Inputs",
    "tier": "free",
    "description": "Smooth ink that thins with speed, with undo, replay, and PNG or SVG export.",
    "docs": "https://uiarc.dev/components/signature-pad"
  },
  {
    "name": "slider",
    "title": "Slider",
    "category": "Inputs",
    "tier": "free",
    "description": "Pick a value or a range on a track that follows your finger.",
    "docs": "https://uiarc.dev/components/slider"
  },
  {
    "name": "switch",
    "title": "Switch",
    "category": "Inputs",
    "tier": "free",
    "description": "A tactile toggle for settings that take effect immediately.",
    "docs": "https://uiarc.dev/components/switch"
  },
  {
    "name": "tag-input",
    "title": "Tag input",
    "category": "Inputs",
    "tier": "free",
    "description": "Turn short text values into removable tags.",
    "docs": "https://uiarc.dev/components/tag-input"
  },
  {
    "name": "textarea",
    "title": "Textarea",
    "category": "Inputs",
    "tier": "free",
    "description": "A multiline field for notes, descriptions, and longer text.",
    "docs": "https://uiarc.dev/components/textarea"
  },
  {
    "name": "time-picker",
    "title": "Time picker",
    "category": "Inputs",
    "tier": "free",
    "description": "Choose a time with sensible keyboard behavior.",
    "docs": "https://uiarc.dev/components/time-picker"
  },
  {
    "name": "toggle-group",
    "title": "Toggle group",
    "category": "Inputs",
    "tier": "free",
    "description": "A row of icon or text toggles, single or multiple: one pressed fill glides between options, or each fades in on its own and neighbours join, as in a formatting toolbar.",
    "docs": "https://uiarc.dev/components/toggle-group"
  },
  {
    "name": "window-range",
    "title": "Window range",
    "category": "Inputs",
    "tier": "pro",
    "description": "A time window over a live area chart: drag its edges to resize, drag or flick it to pan with momentum, and the dates roll to their new values.",
    "docs": "https://uiarc.dev/components/window-range"
  },
  {
    "name": "action-morph",
    "title": "Action morph",
    "category": "Special",
    "tier": "pro",
    "description": "A floating button that morphs into a quick-action menu, then an inline form, then back with a check.",
    "docs": "https://uiarc.dev/components/action-morph"
  },
  {
    "name": "activity-rings",
    "title": "Activity rings",
    "category": "Special",
    "tier": "pro",
    "description": "Daily goals as tick rings that sweep, count up, and trace a second lap past 100%.",
    "docs": "https://uiarc.dev/components/activity-rings"
  },
  {
    "name": "agent-cursor",
    "title": "Agent cursor",
    "category": "Special",
    "tier": "pro",
    "description": "A live document where Claude edits like a collaborator. Its labeled cursor comes out of its avatar, selects a paragraph and streams in a rewrite, adds a heading and fixes a typo, while a teammate's cursor reads along. Changes stay tinted until someone accepts or undoes them from a floating review bar.",
    "docs": "https://uiarc.dev/components/agent-cursor"
  },
  {
    "name": "agent-handoff",
    "title": "Agent handoff",
    "category": "Special",
    "tier": "pro",
    "description": "A support conversation where an AI assistant hands off to a person. When it transfers, a card shows the summary it passes to the team and the typical wait. The person then joins and takes over, and a thin timeline on the left marks each step.",
    "docs": "https://uiarc.dev/components/agent-handoff"
  },
  {
    "name": "agent-loop",
    "title": "Agent loop",
    "category": "Special",
    "tier": "pro",
    "description": "An illustration of the agent loop: gather context, take action, verify, repeat, with a bright head circling three stations around the model.",
    "docs": "https://uiarc.dev/components/agent-loop"
  },
  {
    "name": "agent-plan",
    "title": "Agent plan",
    "category": "Special",
    "tier": "pro",
    "description": "The plan an agent writes before it acts: edit, reorder or add steps while it is a draft, then watch it work through them as a live checklist.",
    "docs": "https://uiarc.dev/components/agent-plan"
  },
  {
    "name": "agent-status",
    "title": "Agent status",
    "category": "Special",
    "tier": "pro",
    "description": "A compact live status pill for a running AI agent: the agent's mark in a live ring, the current activity and an elapsed timer, opening into the steps so far.",
    "docs": "https://uiarc.dev/components/agent-status"
  },
  {
    "name": "agent-timeline",
    "title": "Agent timeline",
    "category": "Special",
    "tier": "pro",
    "description": "A compact timeline of one orchestrated agent run: the orchestrator and its subagents share a time axis, handoffs draw in between rows, and a playhead replays thinking, tool calls and waiting while the header counts time, tokens and cost. Hover a span for what it did, or click it to trace its handoff path.",
    "docs": "https://uiarc.dev/components/agent-timeline"
  },
  {
    "name": "ai-command",
    "title": "AI command",
    "category": "Special",
    "tier": "pro",
    "description": "A Cmd+K command palette with an AI mode. Search pages and actions, or press Tab to ask a question: the answer streams inside the palette with numbered sources, and the next steps it suggests, like filing a Linear issue or opening a Notion doc, run straight from the list.",
    "docs": "https://uiarc.dev/components/ai-command"
  },
  {
    "name": "ai-mascot",
    "title": "AI mascot",
    "category": "Special",
    "tier": "pro",
    "description": "A small assistant character, a soft pebble with pill eyes and a companion dot, that shows what the AI is doing. It breathes and glances when idle, leans in to listen, looks up while the dot orbits its head, reads along the line it writes, squints with a sparkle when done and shakes once with worried brows on an error.",
    "docs": "https://uiarc.dev/components/ai-mascot"
  },
  {
    "name": "ai-spark",
    "title": "AI spark",
    "category": "Special",
    "tier": "pro",
    "description": "A brand-quality animated spark mark. Four tapered rays and four lighter diagonals breathe at rest, ripple while thinking, pulse like a heartbeat while writing, then gather and settle when done. Every status change blends from the pose the mark is already in.",
    "docs": "https://uiarc.dev/components/ai-spark"
  },
  {
    "name": "ai-translate",
    "title": "AI translate",
    "category": "Special",
    "tier": "pro",
    "description": "A message card where picking a language streams the AI translation in place, sentence by sentence over the dimmed original, with a detected-language chip, a Show original toggle and a status line credited to the model's mark.",
    "docs": "https://uiarc.dev/components/ai-translate"
  },
  {
    "name": "ai-workflow",
    "title": "AI workflow",
    "category": "Special",
    "tier": "pro",
    "description": "A Linear-style AI workflow card where a Gmail trigger, a Claude step, a branch and Slack and Linear actions sit on one hairline rail, and a test run glides down it, opening each step's output inline. Steps are added from a compact command menu with real app marks.",
    "docs": "https://uiarc.dev/components/ai-workflow"
  },
  {
    "name": "arming-switch",
    "title": "Arming switch",
    "category": "Special",
    "tier": "pro",
    "description": "An aircraft style guarded switch for dangerous actions such as a production deploy. Lift the translucent red cover on its hinge, throw the chrome bat toggle until it snaps over center and the lamp flickers on, then press and hold the lamp to run the action. Closing the cover throws an armed switch back to safe.",
    "docs": "https://uiarc.dev/components/arming-switch"
  },
  {
    "name": "ask-your-data",
    "title": "Ask your data",
    "category": "Special",
    "tier": "pro",
    "description": "A natural language to chart card: you ask a question, PostgreSQL streams into a collapsible, syntax highlighted panel, the query runs with a rolling row count, and the answer builds as stacked bars, lines or a table, with a one line insight streamed in underneath.",
    "docs": "https://uiarc.dev/components/ask-your-data"
  },
  {
    "name": "black-hole",
    "title": "Black hole",
    "category": "Special",
    "tier": "pro",
    "description": "A delete transition that pulls the chosen items into a tiny singularity while the rest of the list bends around it; undo spins them back out.",
    "docs": "https://uiarc.dev/components/black-hole"
  },
  {
    "name": "booking-pill",
    "title": "Booking pill",
    "category": "Special",
    "tier": "pro",
    "description": "One pill that reshapes through party size, date, time, and a ticket.",
    "docs": "https://uiarc.dev/components/booking-pill"
  },
  {
    "name": "branch-graph",
    "title": "Branch graph",
    "category": "Special",
    "tier": "pro",
    "description": "A git commit graph where branches draw in as colored lanes, merge commits join lines, a rebase lifts commits and replays them onto main, a squash folds them into one, and hovering a commit shows its message, author and diff stats.",
    "docs": "https://uiarc.dev/components/branch-graph"
  },
  {
    "name": "card-to-article",
    "title": "Card to article",
    "category": "Special",
    "tier": "pro",
    "description": "Story cards that open into full articles with one seamless morph and shrink back into their exact slot when dragged down.",
    "docs": "https://uiarc.dev/components/card-to-article"
  },
  {
    "name": "celebrate-button",
    "title": "Celebrate button",
    "category": "Special",
    "tier": "pro",
    "description": "A button that bursts confetti from its own edges on success while the label morphs to done.",
    "docs": "https://uiarc.dev/components/celebrate-button"
  },
  {
    "name": "charge-session",
    "title": "Charge session",
    "category": "Special",
    "tier": "pro",
    "description": "An EV or device charging card. Energy packets flow from a charger along the cable into the battery pack, which fills toward a draggable charge limit. The charge curve tapers near full, and power, energy, time to limit and cost update live. Stop charging drains the flow.",
    "docs": "https://uiarc.dev/components/charge-session"
  },
  {
    "name": "code-magic-move",
    "title": "Code magic move",
    "category": "Special",
    "tier": "pro",
    "description": "A code block that animates between versions of a snippet: unchanged tokens glide to their new line and column, removed tokens fade and lift out, added tokens type in behind an accent caret. Step dots, arrow keys, and a sideways drag walk a tutorial or changelog through each change.",
    "docs": "https://uiarc.dev/components/code-magic-move"
  },
  {
    "name": "code-suggestion",
    "title": "Code suggestion",
    "category": "Special",
    "tier": "pro",
    "description": "An AI code edit suggestion where the model's proposed changes stream into a small editor panel as inline diff hunks, and you accept or reject each one, or all at once with Cmd+Enter. Accepted hunks fold into the file with a smooth height change.",
    "docs": "https://uiarc.dev/components/code-suggestion"
  },
  {
    "name": "connector-setup",
    "title": "Connector setup",
    "category": "Special",
    "tier": "pro",
    "description": "A \"Connect your tools\" card for an AI assistant. Each app connects inline: it redirects, authorizes and runs a first sync with a progress hairline, then lists the scopes it was granted and offers Disconnect with an inline confirm.",
    "docs": "https://uiarc.dev/components/connector-setup"
  },
  {
    "name": "context-window",
    "title": "Context window",
    "category": "Special",
    "tier": "pro",
    "description": "An AI context window as a grid of 200 cells: the system prompt, tools, files, summary and messages fill it in order, a threshold row marks where compaction starts, and sending a message, attaching a file or compacting shows exactly how much still fits.",
    "docs": "https://uiarc.dev/components/context-window"
  },
  {
    "name": "control-center",
    "title": "Control center",
    "category": "Special",
    "tier": "pro",
    "description": "Workspace quick settings: tiles that morph into detail, a duration dial, and rubber-banded meters.",
    "docs": "https://uiarc.dev/components/control-center"
  },
  {
    "name": "cover-flow",
    "title": "Cover flow",
    "category": "Special",
    "tier": "pro",
    "description": "A depth rail of images you can throw, with soft grounded shadows and a quiet reflection.",
    "docs": "https://uiarc.dev/components/cover-flow"
  },
  {
    "name": "cube-mascot",
    "title": "Cube mascot",
    "category": "Special",
    "tier": "pro",
    "description": "An isometric cube mascot where three shaded faces and a painted-on face show what the assistant is doing. It turns a quarter turn in eased steps while thinking, prints lines onto the floor while writing, settles with a sparkle when done, and shakes once on error.",
    "docs": "https://uiarc.dev/components/cube-mascot"
  },
  {
    "name": "cursor-trail-draw",
    "title": "Cursor trail draw",
    "category": "Special",
    "tier": "pro",
    "description": "A whiteboard where ink is smoothed and shaped by pressure, a laser pointer leaves a fading trail, and rough circles, boxes, triangles and lines snap to clean shapes on a small spring when the pen lifts.",
    "docs": "https://uiarc.dev/components/cursor-trail-draw"
  },
  {
    "name": "data-flow",
    "title": "Data flow",
    "category": "Special",
    "tier": "pro",
    "description": "Data flow illustration. Sources (app, database, events) are on the left, a processing core with a live count sits in the middle, and destinations (warehouse, dashboard, alerts) are on the right. Records leave as hollow dots and travel curved paths. In the core they turn into solid accent squares, then fan out to each destination; alerts receives about every third record.",
    "docs": "https://uiarc.dev/components/data-flow"
  },
  {
    "name": "date-reel",
    "title": "Date reel",
    "category": "Special",
    "tier": "pro",
    "description": "A 3D wheel date and time picker (like iOS reels) with momentum scrolling, snapping, curved perspective, and full keyboard support.",
    "docs": "https://uiarc.dev/components/date-reel"
  },
  {
    "name": "dictation-button",
    "title": "Dictation button",
    "category": "Special",
    "tier": "pro",
    "description": "A chat composer with voice input, where the mic springs into a recording pill with a smooth live waveform, a timer, and cancel and insert buttons. Words stream into the field as you speak, muted until the recognizer settles them.",
    "docs": "https://uiarc.dev/components/dictation-button"
  },
  {
    "name": "dns-resolution",
    "title": "DNS resolution",
    "category": "Special",
    "tier": "pro",
    "description": "A browser asks for a domain and the query hops from the resolver to a root server, the TLD server and the authoritative nameserver, each pointing to the next, until an IP address comes back and the page connects. The resolver keeps the answer with a TTL ring that drains, and a second lookup is answered straight from that cache in one short hop.",
    "docs": "https://uiarc.dev/components/dns-resolution"
  },
  {
    "name": "dock",
    "title": "Dock",
    "category": "Special",
    "tier": "pro",
    "description": "A floating tool dock with a gliding label, a springy selection, and trays that grow out of it.",
    "docs": "https://uiarc.dev/components/dock"
  },
  {
    "name": "dot-grid",
    "title": "Dot grid",
    "category": "Special",
    "tier": "pro",
    "description": "A dot field that bulges around the cursor like a lens and ripples from every click.",
    "docs": "https://uiarc.dev/components/dot-grid"
  },
  {
    "name": "dot-matrix-loader",
    "title": "Dot matrix loader",
    "category": "Special",
    "tier": "pro",
    "description": "Six dot grid loaders that play a pattern while waiting, fill in their own order as progress arrives and resolve into a check or cross drawn in dots.",
    "docs": "https://uiarc.dev/components/dot-matrix-loader"
  },
  {
    "name": "enrich-column",
    "title": "Enrich column",
    "category": "Special",
    "tier": "pro",
    "description": "An AI enrichment column for a data table, where one prompt runs down every row and each cell shimmers while it works, then settles into a value with its source or a failure you can retry.",
    "docs": "https://uiarc.dev/components/enrich-column"
  },
  {
    "name": "feedback-morph",
    "title": "Feedback morph",
    "category": "Special",
    "tier": "pro",
    "description": "A feedback button that becomes a form, then a thank-you, in one shape.",
    "docs": "https://uiarc.dev/components/feedback-morph"
  },
  {
    "name": "generation-stats",
    "title": "Generation stats",
    "category": "Special",
    "tier": "pro",
    "description": "A live stats strip for a streaming LLM response where time to first token, speed with a sparkline, output tokens and cost count up in tabular numerals beside the model's real mark, then settle and open into a latency and token cost breakdown.",
    "docs": "https://uiarc.dev/components/generation-stats"
  },
  {
    "name": "ghost-mascot",
    "title": "Ghost mascot",
    "category": "Special",
    "tier": "pro",
    "description": "A floating ghost mascot whose soft sheet ripples at the hem while it hovers. It blinks when idle, turns toward you to listen, fades a little translucent while thinking, draws a tiny pen line while writing, smiles with a sparkle when done and wobbles once on an error.",
    "docs": "https://uiarc.dev/components/ghost-mascot"
  },
  {
    "name": "ghost-text",
    "title": "Ghost text",
    "category": "Special",
    "tier": "pro",
    "description": "An inline AI autocomplete where muted ghost text continues your sentence exactly at the caret and Tab turns it solid in place. Cmd+Right takes it one word at a time, Escape fades it away, and a calm chip shows the model behind it.",
    "docs": "https://uiarc.dev/components/ghost-text"
  },
  {
    "name": "glass-card",
    "title": "Glass card",
    "category": "Special",
    "tier": "pro",
    "description": "A glass info panel over a photo whose rim catches a pointer-following highlight while the card tilts; tap to morph it into a detail sheet.",
    "docs": "https://uiarc.dev/components/glass-card"
  },
  {
    "name": "glass-menu",
    "title": "Glass menu",
    "category": "Special",
    "tier": "pro",
    "description": "A glass action menu whose trigger morphs into the panel, with a highlight pill that glides between rows, one in-place submenu, and full keyboard support.",
    "docs": "https://uiarc.dev/components/glass-menu"
  },
  {
    "name": "glass-segmented",
    "title": "Glass segmented",
    "category": "Special",
    "tier": "pro",
    "description": "A glass segmented control whose liquid indicator stretches between segments and can be dragged and flung.",
    "docs": "https://uiarc.dev/components/glass-segmented"
  },
  {
    "name": "glass-tabbar",
    "title": "Glass tab bar",
    "category": "Special",
    "tier": "pro",
    "description": "A floating Liquid Glass tab bar that refracts what scrolls beneath it, with a glass lens that glides, magnifies and can be dragged between tabs, and an optional search bubble; it compacts on scroll down.",
    "docs": "https://uiarc.dev/components/glass-tabbar"
  },
  {
    "name": "gravity-well",
    "title": "Gravity well",
    "category": "Special",
    "tier": "pro",
    "description": "A grid of tiles that bends toward the cursor like spacetime, with a click that sends a shockwave through it.",
    "docs": "https://uiarc.dev/components/gravity-well"
  },
  {
    "name": "holo-card",
    "title": "Holo card",
    "category": "Special",
    "tier": "pro",
    "description": "A member card that tilts toward you with a holographic foil and flips to its back.",
    "docs": "https://uiarc.dev/components/holo-card"
  },
  {
    "name": "image-generation",
    "title": "Image generation",
    "category": "Special",
    "tier": "pro",
    "description": "An image studio where each image forms on a dot matrix: a soft halftone wave breathes across the grid, the dots take the colours of the coming photo and grow into a coloured halftone, then blur away into the sharp photo. One large canvas with a mono size label, a filmstrip of four variations, a prompt bar with model and ratio, and upscale with a sweeping dot band, vary or download, with real provider marks and a built-in simulation.",
    "docs": "https://uiarc.dev/components/image-generation"
  },
  {
    "name": "image-reveal",
    "title": "Image reveal",
    "category": "Special",
    "tier": "pro",
    "description": "An image generation canvas where a soft, blurred preview made from the image's own colors sharpens top to bottom behind a soft-edged band. It works the way ChatGPT, Midjourney and Gemini show images forming, with fine film grain, a translucent progress pill and calm queued and error states.",
    "docs": "https://uiarc.dev/components/image-reveal"
  },
  {
    "name": "image-trail",
    "title": "Image trail",
    "category": "Special",
    "tier": "pro",
    "description": "Moving the pointer leaves a curated trail of photos that pop in, lean, and fade away.",
    "docs": "https://uiarc.dev/components/image-trail"
  },
  {
    "name": "ink-fluid",
    "title": "Ink fluid",
    "category": "Special",
    "tier": "pro",
    "description": "A real time fluid simulation behind your hero: the cursor stirs soft ink that swirls, settles and fades; calm when left alone.",
    "docs": "https://uiarc.dev/components/ink-fluid"
  },
  {
    "name": "install-snippet",
    "title": "Install snippet",
    "category": "Special",
    "tier": "pro",
    "description": "A \"get started in 30 seconds\" card where framework tabs, three numbered steps and highlighted snippets take a developer from install to first event. Generate key wipes a fresh API key into the placeholder in place.",
    "docs": "https://uiarc.dev/components/install-snippet"
  },
  {
    "name": "keycap-keyboard",
    "title": "Keycap keyboard",
    "category": "Special",
    "tier": "pro",
    "description": "Mechanical keycaps that sink and light up as you type, with the text above the board.",
    "docs": "https://uiarc.dev/components/keycap-keyboard"
  },
  {
    "name": "lightbox-gallery",
    "title": "Lightbox gallery",
    "category": "Special",
    "tier": "pro",
    "description": "A masonry grid where photos zoom from their slot into a viewer you can swipe, pinch, and drag away.",
    "docs": "https://uiarc.dev/components/lightbox-gallery"
  },
  {
    "name": "link-unfurl",
    "title": "Link unfurl",
    "category": "Special",
    "tier": "pro",
    "description": "A composer where pasting a URL shows a loading shimmer on the link, then unfurls it into a rich preview card with title, image and favicon in one morph, which can be collapsed back to the inline link or removed.",
    "docs": "https://uiarc.dev/components/link-unfurl"
  },
  {
    "name": "liquid-tab-bar",
    "title": "Liquid tab bar",
    "category": "Special",
    "tier": "pro",
    "description": "Tabs with a lens selection that slides between them, swaps labels cleanly, and fills in icons as it passes.",
    "docs": "https://uiarc.dev/components/liquid-tab-bar"
  },
  {
    "name": "live-visitors",
    "title": "Live visitors",
    "category": "Special",
    "tier": "pro",
    "description": "A realtime visitors card where the live count rolls digit by digit, new arrivals ping in on a dotted world map, the top pages reorder with bars, and signups and upgrades tick in with country flags.",
    "docs": "https://uiarc.dev/components/live-visitors"
  },
  {
    "name": "llm-cost-calculator",
    "title": "LLM cost calculator",
    "category": "Special",
    "tier": "pro",
    "description": "A pricing calculator for LLM workloads. Set tokens per request, requests per day and prompt caching, and eight current models re-rank by monthly cost. Bars glide and prices roll as you drag.",
    "docs": "https://uiarc.dev/components/llm-cost-calculator"
  },
  {
    "name": "meeting-summary",
    "title": "Meeting summary",
    "category": "Special",
    "tier": "pro",
    "description": "An AI meeting notes card: the header shows the Google Meet or Zoom mark, the attendees and the duration. Summary, Decisions and Action items stream in after a short summarizing pass. Hover any line to see the transcript quote it came from, then check off action items or send them to Linear or Notion.",
    "docs": "https://uiarc.dev/components/meeting-summary"
  },
  {
    "name": "mixture-of-experts",
    "title": "Mixture of experts",
    "category": "Special",
    "tier": "pro",
    "description": "An illustration of mixture of experts routing: each token is scored by a router, travels to its top experts, and their outputs merge into the token's result.",
    "docs": "https://uiarc.dev/components/mixture-of-experts"
  },
  {
    "name": "model-card",
    "title": "Model card",
    "category": "Special",
    "tier": "pro",
    "description": "A model details card where switching models rolls every price, limit and score in place, a token slider estimates monthly cost live, and benchmark bars show each model's rank on hover. Compare crossfades to a side-by-side table against any rival with the better values marked, and the card never changes size.",
    "docs": "https://uiarc.dev/components/model-card"
  },
  {
    "name": "model-training",
    "title": "Model training",
    "category": "Special",
    "tier": "pro",
    "description": "Training data batches feed a small neural net diagram whose connections strengthen, a loss curve descends beside it, and an evaluation check turns green at the end.",
    "docs": "https://uiarc.dev/components/model-training"
  },
  {
    "name": "morph-loader",
    "title": "Morph loader",
    "category": "Special",
    "tier": "pro",
    "description": "Tiny loaders that morph between shapes and fold into a check or a cross when done.",
    "docs": "https://uiarc.dev/components/morph-loader"
  },
  {
    "name": "morph-nav",
    "title": "Morph nav",
    "category": "Special",
    "tier": "pro",
    "description": "A navigation bar that morphs into rich menus, search, and a compact state as one surface.",
    "docs": "https://uiarc.dev/components/morph-nav"
  },
  {
    "name": "multi-region-failover",
    "title": "Multi-region failover",
    "category": "Special",
    "tier": "pro",
    "description": "Animated multi-region failover on a 2.5D stage: users stream requests through a global load balancer to two regions; the primary degrades, fails three health checks, traffic shifts smoothly to the healthy region, then it recovers, passes three checks and traffic ramps back to an even split.",
    "docs": "https://uiarc.dev/components/multi-region-failover"
  },
  {
    "name": "now-playing",
    "title": "Now playing",
    "category": "Special",
    "tier": "pro",
    "description": "Grow a mini player into the full player in one continuous morph.",
    "docs": "https://uiarc.dev/components/now-playing"
  },
  {
    "name": "orbit-logos",
    "title": "Orbit logos",
    "category": "Special",
    "tier": "pro",
    "description": "An integrations showcase with brand logos orbiting your product mark on tilted rings. Hover or focus one to rest the orbit, draw a connection, and see what it does.",
    "docs": "https://uiarc.dev/components/orbit-logos"
  },
  {
    "name": "orbit-menu",
    "title": "Orbit menu",
    "category": "Special",
    "tier": "pro",
    "description": "Hold a button and its actions orbit out, ready to pick with a drag.",
    "docs": "https://uiarc.dev/components/orbit-menu"
  },
  {
    "name": "padlock-toggle",
    "title": "Padlock toggle",
    "category": "Special",
    "tier": "pro",
    "description": "A privacy switch drawn as a polished steel padlock. Push the shackle down or tap it: the shackle snaps into the body, the body bounces, the keyhole lights up in the accent and the label rolls from Public to Private. Unlocking pops the shackle against its collar and swivels it open.",
    "docs": "https://uiarc.dev/components/padlock-toggle"
  },
  {
    "name": "page-curl",
    "title": "Page curl",
    "category": "Special",
    "tier": "pro",
    "description": "A small magazine you read by dragging page corners, with a real fold, lit curl, and flick to turn.",
    "docs": "https://uiarc.dev/components/page-curl"
  },
  {
    "name": "payment-flow",
    "title": "Payment flow",
    "category": "Special",
    "tier": "pro",
    "description": "A card tap goes to a processor, then the network, then the bank and back with authorization, then settlement; each hop lights up with a status label and the amount travels as a chip.",
    "docs": "https://uiarc.dev/components/payment-flow"
  },
  {
    "name": "photo-grid",
    "title": "Photo grid",
    "category": "Special",
    "tier": "pro",
    "description": "Pinch through zoom levels and open any photo straight from its cell.",
    "docs": "https://uiarc.dev/components/photo-grid"
  },
  {
    "name": "pii-redaction",
    "title": "PII redaction",
    "category": "Special",
    "tier": "pro",
    "description": "A guardrail card where personal data is redacted before the prompt reaches the model. Scan marks each name, email, phone number and card with its type and swaps it for a placeholder like [EMAIL_1]. The safe prompt travels to Claude, and the reply comes back with the original values put back for the person.",
    "docs": "https://uiarc.dev/components/pii-redaction"
  },
  {
    "name": "pixel-mascot",
    "title": "Pixel mascot",
    "category": "Special",
    "tier": "pro",
    "description": "A pixel-art robot that shows what an AI assistant is doing. It idles, thinks, types, celebrates and errors in frame-stepped sprite animations, and stays crisp at every integer size from 24px to 192px.",
    "docs": "https://uiarc.dev/components/pixel-mascot"
  },
  {
    "name": "prize-wheel",
    "title": "Prize wheel",
    "category": "Special",
    "tier": "pro",
    "description": "A referral or promo prize wheel you flick to spin, with real angular momentum, a flexible pointer that ticks against each peg, weighted segments set by the host, a slow suspenseful settle, and the won segment lifting into a reward card with a copyable code.",
    "docs": "https://uiarc.dev/components/prize-wheel"
  },
  {
    "name": "product-gallery",
    "title": "Product gallery",
    "category": "Special",
    "tier": "pro",
    "description": "A product gallery with a hover magnifier, gliding thumbnails, and color and size variants that crossfade photos.",
    "docs": "https://uiarc.dev/components/product-gallery"
  },
  {
    "name": "prompt-cache",
    "title": "Prompt cache",
    "category": "Special",
    "tier": "pro",
    "description": "An animated explainer for prompt caching: the shared prefix of each request is cached once, later requests read it back, and the cost and time saved add up.",
    "docs": "https://uiarc.dev/components/prompt-cache"
  },
  {
    "name": "provider-keys",
    "title": "Provider keys",
    "category": "Special",
    "tier": "pro",
    "description": "A settings card for bring-your-own-key AI products. Each provider row shows its real mark, the masked key, a status and when the key was last used. You can reveal a key for five seconds, copy, rotate or remove it with undo. Adding or rotating a key opens an inline form that checks the format as you type, then tests the connection before saving.",
    "docs": "https://uiarc.dev/components/provider-keys"
  },
  {
    "name": "provider-status",
    "title": "Provider status",
    "category": "Special",
    "tier": "pro",
    "description": "A status card for the AI providers your product depends on. Each row shows the provider's real mark, its health as an icon and label, p50 latency and a 30-day uptime bar with a tooltip for each day. An incident row expands into its timeline of updates, and the card checks again on a visible countdown.",
    "docs": "https://uiarc.dev/components/provider-status"
  },
  {
    "name": "reasoning-block",
    "title": "Reasoning block",
    "category": "Special",
    "tier": "pro",
    "description": "The collapsible thinking block of an AI reply. While the model thinks, a shimmering label counts the seconds and the latest reasoning streams underneath. When it finishes, it folds to \"Thought for 7s\" and opens to show the full reasoning as calm steps with headings.",
    "docs": "https://uiarc.dev/components/reasoning-block"
  },
  {
    "name": "reasoning-tree",
    "title": "Reasoning tree",
    "category": "Special",
    "tier": "pro",
    "description": "An illustration of tree search over thoughts: candidates are scored, weak branches fade, the best expand, and the winning path from question to answer draws in.",
    "docs": "https://uiarc.dev/components/reasoning-tree"
  },
  {
    "name": "referral-card",
    "title": "Referral card",
    "category": "Special",
    "tier": "pro",
    "description": "A give-and-get referral card where people copy or share their invite link, invite friends by email as chips, and watch invites move from invited to signed up to earned, with the credit total counting up and a milestone reward unlocking.",
    "docs": "https://uiarc.dev/components/referral-card"
  },
  {
    "name": "reply-draft",
    "title": "Reply draft",
    "category": "Special",
    "tier": "pro",
    "description": "An AI email reply drafter where Claude streams a reply under a received Gmail message. Quick replies steer a fresh draft, tone and length rewrite it with a single crossfade, and you can edit the finished draft before you insert it.",
    "docs": "https://uiarc.dev/components/reply-draft"
  },
  {
    "name": "response-feedback",
    "title": "Response feedback",
    "category": "Special",
    "tier": "pro",
    "description": "A feedback control for AI replies where thumbs down opens an inline panel with reason chips and an optional note, thumbs up fills and asks what was good, and a submit shows a short thank-you before folding back into the row.",
    "docs": "https://uiarc.dev/components/response-feedback"
  },
  {
    "name": "sand-text",
    "title": "Sand text",
    "category": "Special",
    "tier": "pro",
    "description": "A headline made of sand that pours into the letters, crumbles where the cursor digs, and heals itself.",
    "docs": "https://uiarc.dev/components/sand-text"
  },
  {
    "name": "share-sheet",
    "title": "Share sheet",
    "category": "Special",
    "tier": "pro",
    "description": "A Share button that opens into a panel with copy link, access level, channels, and people to send to.",
    "docs": "https://uiarc.dev/components/share-sheet"
  },
  {
    "name": "sheet-stack",
    "title": "Sheet stack",
    "category": "Special",
    "tier": "pro",
    "description": "Nested sheets that stack with depth, drag to dismiss, and become stacked dialogs on wide screens.",
    "docs": "https://uiarc.dev/components/sheet-stack"
  },
  {
    "name": "skeleton-morph",
    "title": "Skeleton morph",
    "category": "Special",
    "tier": "pro",
    "description": "Loading skeletons that grow into the real content, block by block, instead of swapping.",
    "docs": "https://uiarc.dev/components/skeleton-morph"
  },
  {
    "name": "slide-to-confirm",
    "title": "Slide to confirm",
    "category": "Special",
    "tier": "pro",
    "description": "A slide-to-confirm control. The thumb pulls a liquid fill behind it and makes the track swell. It snaps back on a spring if released early. Past the threshold, the track draws into the thumb and the chevron morphs into a success check, with pending and error states.",
    "docs": "https://uiarc.dev/components/slide-to-confirm"
  },
  {
    "name": "slot-text",
    "title": "Slot text",
    "category": "Special",
    "tier": "free",
    "description": "Text and numbers that spin into their new value on staggered slot machine reels.",
    "docs": "https://uiarc.dev/components/slot-text"
  },
  {
    "name": "smart-form-fill",
    "title": "Smart form fill",
    "category": "Special",
    "tier": "pro",
    "description": "A paste-to-fill form card where AI reads an email signature or messy notes and fills a contact field by field. Each value flashes in with a confidence dot, its source lights up in the pasted text, low-confidence guesses ask for review, and Undo puts the old values back.",
    "docs": "https://uiarc.dev/components/smart-form-fill"
  },
  {
    "name": "social-proof-toast",
    "title": "Social proof toast",
    "category": "Special",
    "tier": "pro",
    "description": "A stack of social proof notifications for landing and pricing pages, where recent trials, upgrades and verified purchases from people and companies arrive every few seconds. The stack pauses and fans out on hover, and visitors can dismiss any toast.",
    "docs": "https://uiarc.dev/components/social-proof-toast"
  },
  {
    "name": "source-cards",
    "title": "Source cards",
    "category": "Special",
    "tier": "pro",
    "description": "A row of cited sources under an AI answer where cards stream in with real site marks while the model searches, the overflow collapses into a stack of favicons, hovering lifts a preview with the passage, and an inline [n] citation highlights its card.",
    "docs": "https://uiarc.dev/components/source-cards"
  },
  {
    "name": "speculative-decoding",
    "title": "Speculative decoding",
    "category": "Special",
    "tier": "pro",
    "description": "An illustration of speculative decoding: a fast draft model guesses a few tokens, the target model checks them in one pass, and accepted guesses join the answer.",
    "docs": "https://uiarc.dev/components/speculative-decoding"
  },
  {
    "name": "speech-player",
    "title": "Speech player",
    "category": "Special",
    "tier": "pro",
    "description": "A read-aloud player for AI replies. The Read aloud button in the message's action row turns into a compact player with play, a scrubbable progress bar, speed and a voice picker, and a highlight follows the spoken word through the reply, karaoke style.",
    "docs": "https://uiarc.dev/components/speech-player"
  },
  {
    "name": "starter-prompts",
    "title": "Starter prompts",
    "category": "Special",
    "tier": "pro",
    "description": "A greeting and a grid of starter cards for the empty state of an AI app. The cards are grouped into Write, Code, Analyze and Plan tabs, and a shuffle swaps them with a short staggered crossfade. Picking a card fills the composer, and cards that use a connected app show its mark (Gmail, GitHub, Notion, Linear, Google Calendar).",
    "docs": "https://uiarc.dev/components/starter-prompts"
  },
  {
    "name": "sticker-peel",
    "title": "Sticker peel",
    "category": "Special",
    "tier": "pro",
    "description": "Peel stickers off a surface with a real curl, move them around, and stick them back down.",
    "docs": "https://uiarc.dev/components/sticker-peel"
  },
  {
    "name": "stretch-refresh",
    "title": "Stretch refresh",
    "category": "Special",
    "tier": "pro",
    "description": "Pull a feed down and a line stretches to tell you when to let go.",
    "docs": "https://uiarc.dev/components/stretch-refresh"
  },
  {
    "name": "team-switcher",
    "title": "Team switcher",
    "category": "Special",
    "tier": "pro",
    "description": "A workspace switcher like Linear, Vercel or Slack. The trigger shows the current workspace's logo and plan. The menu has search, your role in each workspace and a Cmd+1 to 9 shortcut for each, and lets you create or join a workspace inline. A highlight glides between rows, and switching crossfades the trigger through a short loading state.",
    "docs": "https://uiarc.dev/components/team-switcher"
  },
  {
    "name": "ticket-router",
    "title": "Ticket router",
    "category": "Special",
    "tier": "pro",
    "description": "A support ticket router where messages from Gmail, Intercom, Slack and Zendesk come in one at a time. An AI classifier labels each one with intent, sentiment and confidence, and the ticket moves into a team lane with an assignee. Low confidence tickets wait in a review lane, and one click there routes them to the suggested team.",
    "docs": "https://uiarc.dev/components/ticket-router"
  },
  {
    "name": "ticket-tear",
    "title": "Ticket tear",
    "category": "Special",
    "tier": "pro",
    "description": "Pull a ticket stub and it tears along the perforation hole by hole, then drops away.",
    "docs": "https://uiarc.dev/components/ticket-tear"
  },
  {
    "name": "time-dial",
    "title": "Time dial",
    "category": "Special",
    "tier": "pro",
    "description": "Spin a dial to pick an hour and see which team cities are at work.",
    "docs": "https://uiarc.dev/components/time-dial"
  },
  {
    "name": "tldr-toggle",
    "title": "TL;DR toggle",
    "category": "Special",
    "tier": "pro",
    "description": "An article card with a Full, Summary and Key points switch and a length slider. Switching streams an AI summary in place of the article as the card's height springs to fit, and each key point links back to the paragraph it came from, which gets scrolled to and highlighted.",
    "docs": "https://uiarc.dev/components/tldr-toggle"
  },
  {
    "name": "tone-tuner",
    "title": "Tone tuner",
    "category": "Special",
    "tier": "pro",
    "description": "A brand voice card where two sliders (formality and detail) and Friendly, Confident and Empathetic chips rewrite a customer reply. Each changed sentence crossfades in place, new words can be highlighted against the original, and Copy takes the current version.",
    "docs": "https://uiarc.dev/components/tone-tuner"
  },
  {
    "name": "tool-call",
    "title": "Tool call",
    "category": "Special",
    "tier": "pro",
    "description": "A tool call row for agent transcripts: the tool's mark and the call in plain words, a live state while it runs, and the input and output a click away, with approval and retry when needed.",
    "docs": "https://uiarc.dev/components/tool-call"
  },
  {
    "name": "training-run",
    "title": "Training run",
    "category": "Special",
    "tier": "pro",
    "description": "A fine-tuning job card where a live train and validation loss curve draws across a fixed step axis that doubles as the epoch progress bar. It shows the learning rate, elapsed time, ETA and the latest evals and checkpoints, has Pause and Cancel while it runs, and ends in results with a Deploy button.",
    "docs": "https://uiarc.dev/components/training-run"
  },
  {
    "name": "trial-banner",
    "title": "Trial banner",
    "category": "Special",
    "tier": "pro",
    "description": "A trial status banner where a ring counts down the days left, the copy names what the workspace loses, and the upgrade path is one click away. It comes as a slim banner, a sidebar card or a header pill. It shifts to a warning tone in the last days, has expired and upgraded states, and folds into the pill when dismissed or snoozed.",
    "docs": "https://uiarc.dev/components/trial-banner"
  },
  {
    "name": "typewriter-terminal",
    "title": "Typewriter terminal",
    "category": "Special",
    "tier": "pro",
    "description": "A terminal that types a scripted CLI session with a seeded human cadence, colors the shell syntax, and streams output lines, progress bars and spinners, with a scrubber, play/pause and replay controls.",
    "docs": "https://uiarc.dev/components/typewriter-terminal"
  },
  {
    "name": "upgrade-prompt",
    "title": "Upgrade prompt",
    "category": "Special",
    "tier": "pro",
    "description": "An upgrade nudge for the moment someone hits a limit. It shows a usage meter at 50 of 50 AI credits, a rolling price with a monthly and yearly toggle, three concrete unlocks with real model marks, and Upgrade or Maybe later. Upgrading leads into a success state with the new limits, and the card never changes size between states.",
    "docs": "https://uiarc.dev/components/upgrade-prompt"
  },
  {
    "name": "vector-search",
    "title": "Vector search",
    "category": "Special",
    "tier": "pro",
    "description": "Documents drop onto a tilted embedding plane and fold into points that cluster by topic; the index links neighbours, a query is typed, embedded and lowered onto the plane, a signal hops along the graph toward it, and a widening ring lights the nearest documents with connecting lines, similarity scores and a ranked list.",
    "docs": "https://uiarc.dev/components/vector-search"
  },
  {
    "name": "voice-orb",
    "title": "Voice orb",
    "category": "Special",
    "tier": "pro",
    "description": "A voice mode orb that listens, thinks, and speaks, with a live transcript and call controls.",
    "docs": "https://uiarc.dev/components/voice-orb"
  },
  {
    "name": "voice-recorder",
    "title": "Voice recorder",
    "category": "Special",
    "tier": "pro",
    "description": "Record with a live waveform, review and scrub, then send the take into the thread.",
    "docs": "https://uiarc.dev/components/voice-recorder"
  },
  {
    "name": "wallet-stack",
    "title": "Wallet stack",
    "category": "Special",
    "tier": "pro",
    "description": "Fan a stack of cards and lift one out to see its activity.",
    "docs": "https://uiarc.dev/components/wallet-stack"
  },
  {
    "name": "in-view-title",
    "title": "In-view title",
    "category": "Text",
    "tier": "free",
    "description": "Bring a section title in as it scrolls into view.",
    "docs": "https://uiarc.dev/components/in-view-title"
  },
  {
    "name": "text-morph",
    "title": "Text morph",
    "category": "Text",
    "tier": "free",
    "description": "Morph a label into its next state, letter by letter.",
    "docs": "https://uiarc.dev/components/text-morph"
  },
  {
    "name": "text-reveal",
    "title": "Text reveal",
    "category": "Text",
    "tier": "free",
    "description": "Reveal a short piece of content with restrained motion.",
    "docs": "https://uiarc.dev/components/text-reveal"
  },
  {
    "name": "text-shimmer",
    "title": "Text shimmer",
    "category": "Text",
    "tier": "free",
    "description": "Show ongoing work with a calm light across the words.",
    "docs": "https://uiarc.dev/components/text-shimmer"
  }
];

export const UIARC_COMPONENTS_BY_NAME: Record<string, CatalogComponent> = Object.fromEntries(
  UIARC_COMPONENTS.map((item) => [item.name, item])
);
