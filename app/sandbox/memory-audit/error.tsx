"use client";

import { Card } from "@/components/ui";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="max-w-[1400px] mx-auto"><Card><div role="alert" className="p-5"><p className="text-sm text-danger">The live project memory audit could not be loaded.</p><button type="button" onClick={reset} className="chip mt-3">Try again</button></div></Card></div>;
}
