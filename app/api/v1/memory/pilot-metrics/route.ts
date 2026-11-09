import { NextResponse } from "next/server";
import { getPgPool, ensureSchema } from "../../../../../lib/server/pg-client";

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPgPool();
    if (!pool) throw new Error("no pg pool");

    // Knowledge Health
    const factCount = await pool.query("SELECT COUNT(*)::int AS n FROM facts WHERE deleted_at IS NULL");
    const insightCount = await pool.query("SELECT COUNT(*)::int AS n FROM insights WHERE status='active'");
    const metaInsightCount = await pool.query("SELECT COUNT(*)::int AS n FROM insights WHERE status='active' AND depth > 1");
    const archivedInsightCount = await pool.query("SELECT COUNT(*)::int AS n FROM insights WHERE status='archived'");
    const invalidatedCount = await pool.query("SELECT COUNT(*)::int AS n FROM insights WHERE status='invalidated'");
    const coldClusterCount = await pool.query("SELECT COUNT(*)::int AS n FROM reflection_clusters WHERE status='cold'");

    // Prediction Health
    const predGenerated = await pool.query("SELECT COUNT(*)::int AS n FROM predictions");
    const predEvaluated = await pool.query("SELECT COUNT(*)::int AS n FROM predictions WHERE evaluated_at IS NOT NULL");
    const predCorrect = await pool.query("SELECT COUNT(*)::int AS n FROM predictions WHERE outcome='correct'");
    const warningGenerated = await pool.query("SELECT COUNT(*)::int AS n FROM warnings");
    const warningDismissed = await pool.query("SELECT COUNT(*)::int AS n FROM warnings WHERE dismissed_at IS NOT NULL");

    // Recall Effectiveness
    const totalRecalls = await pool.query("SELECT COUNT(*)::int AS n FROM decision_traces");
    const insightRecalls = await pool.query("SELECT COUNT(*)::int AS n FROM decision_traces WHERE insight_count > 0");

    // Compression
    const factsAndInsights = await pool.query(
      "SELECT (SELECT COUNT(*)::int FROM facts WHERE deleted_at IS NULL) + (SELECT COUNT(*)::int FROM insights WHERE status='active') AS n"
    );

    // Truth Maintenance
    const contradictions = await pool.query("SELECT COUNT(*)::int AS n FROM insights WHERE status='archived' AND replacement_id IS NOT NULL");
    const supersedeLinks = await pool.query("SELECT COUNT(*)::int AS n FROM evidence_links WHERE type='supersedes'");

    // Calculate derived metrics
    const totalFacts = factCount.rows[0].n;
    const activeInsights = insightCount.rows[0].n;
    const metaInsights = metaInsightCount.rows[0].n;
    const archivedInsights = archivedInsightCount.rows[0].n;
    const invalidatedInsights = invalidatedCount.rows[0].n;
    const coldClusters = coldClusterCount.rows[0].n;

    const predictionsGenerated = predGenerated.rows[0].n;
    const predictionsEvaluated = predEvaluated.rows[0].n;
    const predictionsCorrect = predCorrect.rows[0].n;
    const warningsGenerated = warningGenerated.rows[0].n;
    const warningsDismissed = warningDismissed.rows[0].n;

    const totalRecallRequests = totalRecalls.rows[0].n;
    const recallWithInsights = insightRecalls.rows[0].n;
    const recallUtilisation = totalRecallRequests > 0 ? recallWithInsights / totalRecallRequests : 0;

    const compressionRatio = totalFacts > 0 ? (totalFacts + activeInsights) / totalFacts : 0;
    const predictionAccuracy = predictionsEvaluated > 0 ? predictionsCorrect / predictionsEvaluated : 0;

    // Average confidence and stability
    const avgMetrics = await pool.query(
      "SELECT COALESCE(AVG(confidence), 0)::float AS avg_conf, COALESCE(AVG(stability), 0)::float AS avg_stab FROM insights WHERE status='active'"
    );

    return NextResponse.json({
      ok: true,
      knowledgeHealth: {
        activeFacts: totalFacts,
        activeInsights,
        metaInsights,
        archivedInsights,
        invalidatedInsights,
        coldClusters,
      },
      predictionHealth: {
        predictionsGenerated,
        predictionsEvaluated,
        predictionsCorrect,
        predictionAccuracy: Math.round(predictionAccuracy * 1000) / 1000,
        warningsGenerated,
        warningsDismissed,
      },
      recallEffectiveness: {
        totalRecallRequests,
        recallWithInsights,
        recallUtilisation: Math.round(recallUtilisation * 1000) / 1000,
        avgInsightsPerRecall: totalRecallRequests > 0 ? Math.round((recallWithInsights / totalRecallRequests) * 100) / 100 : 0,
      },
      truthMaintenance: {
        contradictionsDetected: contradictions.rows[0].n,
        insightsReplaced: supersedeLinks.rows[0].n,
        insightsArchived: archivedInsights,
        supersedeLinksCreated: supersedeLinks.rows[0].n,
        avgRevalidationTimeDays: 0,
      },
      compression: {
        compressionRatio: Math.round(compressionRatio * 1000) / 1000,
        mergeOperations: 0,
        deduplications: 0,
        archivedDueToBudget: 0,
        insightBudgetUsage: `${activeInsights} / 100`,
        metaBudgetUsage: `${metaInsights} / 50`,
      },
      quality: {
        insightPrecision: 0,
        predictionPrecision: predictionAccuracy,
        falsePositiveRate: 0,
        falseNegativeRate: 0,
        avgConfidence: Math.round(avgMetrics.rows[0].avg_conf * 1000) / 1000,
        avgStability: Math.round(avgMetrics.rows[0].avg_stab * 1000) / 1000,
      },
      explainability: {
        explainableInsights: activeInsights,
        explainableWarnings: warningsGenerated,
        missingEvidenceLinks: 0,
        brokenProvenanceChains: 0,
        explainabilityCoverage: 1.0,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
