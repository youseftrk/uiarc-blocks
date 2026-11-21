import { TOOL_MARKS } from "../tool-call/marks";

const svg = { width: 14, height: 14, viewBox: "0 0 24 24", "aria-hidden": true, focusable: false } as const;

export function OktaMark() {
  return <svg {...svg}><path fill="currentColor" d="M12 0C5.389 0 0 5.35 0 12s5.35 12 12 12 12-5.35 12-12S18.611 0 12 0zm0 18c-3.325 0-6-2.675-6-6s2.675-6 6-6 6 2.675 6 6-2.675 6-6 6z" /></svg>;
}

export function SlackMark() {
  return <svg {...svg}>{TOOL_MARKS.slack.body}</svg>;
}

export function LinearMark() {
  return <svg {...svg} fill={TOOL_MARKS.linear.fill}>{TOOL_MARKS.linear.body}</svg>;
}
