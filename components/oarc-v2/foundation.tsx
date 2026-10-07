import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type OarcTone = "ok" | "warn" | "danger" | "info" | "offline";

const toneClass: Record<OarcTone, string> = {
  ok: "oarc-status-ok",
  warn: "oarc-status-warn",
  danger: "oarc-status-danger",
  info: "oarc-status-info",
  offline: "oarc-status-offline",
};

export function OarcIconButton({ label, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type="button" aria-label={label} title={label} className={cn("oarc-icon-button", className)} {...props}>{children}</button>;
}

export function OarcStatusBadge({ tone, children, className }: { tone: OarcTone; children: ReactNode; className?: string }) {
  return <span className={cn("oarc-status-badge", toneClass[tone], className)}><span aria-hidden="true" className="oarc-status-dot" />{children}</span>;
}

export function OarcCard({ title, description, actions, children, className, ...props }: HTMLAttributes<HTMLElement> & { title?: string; description?: string; actions?: ReactNode }) {
  return <section className={cn("oarc-card", className)} {...props}>
    {(title || description || actions) && <header className="oarc-card-header">
      <div>{title && <h2 className="oarc-card-title">{title}</h2>}{description && <p className="oarc-card-description">{description}</p>}</div>
      {actions && <div className="oarc-card-actions">{actions}</div>}
    </header>}
    {children}
  </section>;
}

export function OarcMetric({ label, value, unit, detail, tone = "info" }: { label: string; value: ReactNode; unit?: string; detail?: string; tone?: OarcTone }) {
  return <div className="oarc-metric" aria-label={`${label}: ${value}${unit ? ` ${unit}` : ""}`}>
    <span className="oarc-metric-label">{label}</span>
    <span className="oarc-metric-value">{value}{unit && <small>{unit}</small>}</span>
    {detail && <span className={cn("oarc-metric-detail", toneClass[tone])}>{detail}</span>}
  </div>;
}

export function OarcResponsiveGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("oarc-responsive-grid", className)}>{children}</div>;
}

export function OarcVisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="oarc-visually-hidden">{children}</span>;
}
