"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, CardHeader } from "@/components/ui";
import { BrainCircuit, TrendingUp, ShieldCheck, Database, GitBranch, BarChart3, Search, RefreshCw } from "lucide-react";

type PilotMetrics = {
  ok: boolean;
  knowledgeHealth: {
    activeFacts: number;
    activeInsights: number;
    metaInsights: number;
    archivedInsights: number;
    invalidatedInsights: number;
    coldClusters: number;
  };
  predictionHealth: {
    predictionsGenerated: number;
    predictionsEvaluated: number;
    predictionsCorrect: number;
    predictionAccuracy: number;
    warningsGenerated: number;
    warningsDismissed: number;
  };
  recallEffectiveness: {
    totalRecallRequests: number;
    recallWithInsights: number;
    recallUtilisation: number;
    avgInsightsPerRecall: number;
  };
  truthMaintenance: {
    contradictionsDetected: number;
    insightsReplaced: number;
    insightsArchived: number;
    supersedeLinksCreated: number;
    avgRevalidationTimeDays: number;
  };
  compression: {
    compressionRatio: number;
    mergeOperations: number;
    deduplications: number;
    archivedDueToBudget: number;
    insightBudgetUsage: string;
    metaBudgetUsage: string;
  };
  quality: {
    insightPrecision: number;
    predictionPrecision: number;
    falsePositiveRate: number;
    falseNegativeRate: number;
    avgConfidence: number;
    avgStability: number;
  };
  explainability: {
    explainableInsights: number;
    explainableWarnings: number;
    missingEvidenceLinks: number;
    brokenProvenanceChains: number;
    explainabilityCoverage: number;
  };
};

function KPI({ label, value, target }: { label: string; value: string | number; target?: string }) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-lg bg-surface border border-border">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold text-foreground">{value}</span>
      {target && <span className="text-[10px] text-muted-foreground">Target: {target}</span>}
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-accent" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{children}</div>
    </Card>
  );
}

export default function PilotDashboardPage() {
  const [metrics, setMetrics] = useState<PilotMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/memory/pilot-metrics");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setMetrics(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  if (loading) return <div className="p-8 text-muted-foreground">Loading pilot metrics…</div>;
  if (error) return <div className="p-8 text-red-400">Error: {error}</div>;
  if (!metrics) return null;

  const m = metrics;
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Reflective Memory V1 — Pilot Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-1">30-day pilot scorecard · Knowledge quality validation</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
        </Button>
      </div>

      <Section title="Knowledge Health" icon={BrainCircuit}>
        <KPI label="Active Facts" value={m.knowledgeHealth.activeFacts} />
        <KPI label="Active Insights" value={m.knowledgeHealth.activeInsights} target="<100" />
        <KPI label="Meta Insights" value={m.knowledgeHealth.metaInsights} target="<50" />
        <KPI label="Archived Insights" value={m.knowledgeHealth.archivedInsights} />
        <KPI label="Invalidated" value={m.knowledgeHealth.invalidatedInsights} />
        <KPI label="Cold Clusters" value={m.knowledgeHealth.coldClusters} />
      </Section>

      <Section title="Prediction Health" icon={TrendingUp}>
        <KPI label="Generated" value={m.predictionHealth.predictionsGenerated} />
        <KPI label="Evaluated" value={m.predictionHealth.predictionsEvaluated} />
        <KPI label="Correct" value={m.predictionHealth.predictionsCorrect} />
        <KPI label="Accuracy" value={`${Math.round(m.predictionHealth.predictionAccuracy * 100)}%`} target=">60%" />
        <KPI label="Warnings Generated" value={m.predictionHealth.warningsGenerated} />
        <KPI label="Warnings Dismissed" value={m.predictionHealth.warningsDismissed} />
      </Section>

      <Section title="Recall Effectiveness" icon={Search}>
        <KPI label="Total Recalls" value={m.recallEffectiveness.totalRecallRequests} />
        <KPI label="With Insights" value={m.recallEffectiveness.recallWithInsights} />
        <KPI label="Utilisation" value={`${Math.round(m.recallEffectiveness.recallUtilisation * 100)}%`} target=">80%" />
        <KPI label="Avg Insights/Recall" value={m.recallEffectiveness.avgInsightsPerRecall} />
      </Section>

      <Section title="Truth Maintenance" icon={ShieldCheck}>
        <KPI label="Contradictions" value={m.truthMaintenance.contradictionsDetected} />
        <KPI label="Replaced" value={m.truthMaintenance.insightsReplaced} />
        <KPI label="Archived" value={m.truthMaintenance.insightsArchived} />
        <KPI label="Supersede Links" value={m.truthMaintenance.supersedeLinksCreated} />
        <KPI label="Avg Revalidation (days)" value={m.truthMaintenance.avgRevalidationTimeDays} />
      </Section>

      <Section title="Compression & Scale" icon={Database}>
        <KPI label="Compression Ratio" value={m.compression.compressionRatio} target="<1.5" />
        <KPI label="Insight Budget" value={m.compression.insightBudgetUsage} />
        <KPI label="Meta Budget" value={m.compression.metaBudgetUsage} />
        <KPI label="Merges" value={m.compression.mergeOperations} />
        <KPI label="Deduplications" value={m.compression.deduplications} />
        <KPI label="Archived (Budget)" value={m.compression.archivedDueToBudget} />
      </Section>

      <Section title="Knowledge Quality" icon={BarChart3}>
        <KPI label="Insight Precision" value={`${Math.round(m.quality.insightPrecision * 100)}%`} target=">80%" />
        <KPI label="Prediction Precision" value={`${Math.round(m.quality.predictionPrecision * 100)}%`} target=">60%" />
        <KPI label="False Positive Rate" value={`${Math.round(m.quality.falsePositiveRate * 100)}%`} target="<10%" />
        <KPI label="Avg Confidence" value={m.quality.avgConfidence} />
        <KPI label="Avg Stability" value={m.quality.avgStability} />
      </Section>

      <Section title="Explainability" icon={GitBranch}>
        <KPI label="Explainable Insights" value={m.explainability.explainableInsights} />
        <KPI label="Explainable Warnings" value={m.explainability.explainableWarnings} />
        <KPI label="Missing Evidence Links" value={m.explainability.missingEvidenceLinks} />
        <KPI label="Broken Chains" value={m.explainability.brokenProvenanceChains} />
        <KPI label="Coverage" value={`${Math.round(m.explainability.explainabilityCoverage * 100)}%`} target="100%" />
      </Section>
    </div>
  );
}
