import { OarcStatusBadge } from "@/components/oarc-v2/foundation";

export function OperatorStatusLine() {
  return <footer className="oarc-status-line" aria-live="polite"><OarcStatusBadge tone="ok">Local UI ready</OarcStatusBadge><span>Keyboard navigation enabled</span><span className="hidden sm:inline">V2.1 visual foundations</span></footer>;
}
