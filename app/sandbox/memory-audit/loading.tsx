import { Card } from "@/components/ui";

export default function Loading() {
  return <div className="max-w-[1400px] mx-auto"><Card><div role="status" aria-live="polite" className="p-5 text-sm text-muted">Loading live project memory audit…</div></Card></div>;
}
