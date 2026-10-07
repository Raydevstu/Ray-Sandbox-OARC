"use client";

import { Command, Database, Search } from "lucide-react";
import { OarcStatusBadge } from "@/components/oarc-v2/foundation";

export function ContextBar({ bankId, banks, onBankChange, onSearch }: { bankId: string; banks: readonly { id: string; name: string }[]; onBankChange: (id: string) => void; onSearch: () => void }) {
  return <header className="oarc-context-bar" data-testid="oarc-context-bar">
    <div className="flex items-center gap-2 min-w-0"><OarcStatusBadge tone="info">Operator workspace</OarcStatusBadge><span className="hidden sm:inline text-xs text-faint truncate">Ray Sandbox OARC / live memory scope</span></div>
    <div className="ml-auto flex items-center gap-2.5">
      <div className="oarc-scope-select"><Database size={13} aria-hidden="true" /><label className="oarc-visually-hidden" htmlFor="oarc-bank">Memory scope</label><select id="oarc-bank" value={bankId} onChange={(event) => onBankChange(event.target.value)}>{banks.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}</select></div>
      <button type="button" onClick={onSearch} className="oarc-command-trigger"><Search size={13} aria-hidden="true" /><span className="hidden md:inline">Search or jump to…</span><span className="hidden md:flex items-center gap-0.5 ml-2"><Command size={10} aria-hidden="true" />K</span></button>
    </div>
  </header>;
}
