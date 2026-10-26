import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeBootstrap } from "@/components/shell/ThemeBootstrap";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Ray Sandbox OARC — Agent Memory Orchestration",
    template: "%s · Ray Sandbox OARC",
  },
  description:
    "Ray Sandbox OARC is an open-source Next.js App Router workspace for mounting, wiring and orchestrating agent-memory apps: Memory, Prompt Engineering, Context Tuning and Continuous Learning — with dashboards, node graphs and benchmarks.",
  keywords: ["agent memory", "hindsight", "orchestration", "sandbox", "nextjs", "open source", "retain recall reflect"],
  openGraph: {
    title: "Ray Sandbox OARC",
    description: "Mount, wire and orchestrate agent-memory apps in Ray Sandbox OARC.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#07070c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrains.variable}`}>
      <head>
        <ThemeBootstrap />
      </head>
      <body className="min-h-screen bg-bg text-ink antialiased">{children}</body>
    </html>
  );
}
