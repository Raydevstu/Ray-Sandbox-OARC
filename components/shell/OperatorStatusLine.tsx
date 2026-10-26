import { RuntimeTruthStatus } from './RuntimeTruthStatus';

export function OperatorStatusLine() {
  return <footer className="oarc-status-line" aria-live="polite"><RuntimeTruthStatus /><span>Keyboard navigation enabled</span></footer>;
}
