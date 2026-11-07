/**
 * AegisFlow Dual-Track E2E Progressive Test Runner
 *
 * Usage:
 *   npx tsx scripts/run-e2e-suite.ts [options]
 *
 * Options:
 *   --milestone <G1|M1|M2|M3|M4|M5|M6|all>   Filter by milestone (default: all)
 *   --tier <1|2|3|4|all>                     Filter by tier (default: all)
 *   --track <mock|live|both>                 Execution track (default: mock)
 *   --verbose, -v                            Print detailed test execution logs
 *   --help, -h                               Show usage information
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { TestCase, TestContext, TestResult, TestSuiteSummary, MilestoneId, TierId } from "../tests/e2e/harness/types";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
import { m1SolanaFeatureTests } from "../tests/e2e/tier1-features/m1-solana-features.test";
import { m2AgentFeatureTests } from "../tests/e2e/tier1-features/m2-agent-features.test";
import { m3ActionsFeatureTests } from "../tests/e2e/tier1-features/m3-actions-features.test";
import { m4UiStretchesFeatureTests } from "../tests/e2e/tier1-features/m4-ui-stretches.test";
import { m5m6TestPackageFeatureTests } from "../tests/e2e/tier1-features/m5-m6-test-package.test";

import { m1BoundaryTests } from "../tests/e2e/tier2-boundaries/m1-boundaries.test";
import { m2BoundaryTests } from "../tests/e2e/tier2-boundaries/m2-boundaries.test";
import { m3BoundaryTests } from "../tests/e2e/tier2-boundaries/m3-boundaries.test";
import { m4m6BoundaryTests } from "../tests/e2e/tier2-boundaries/m4-m6-boundaries.test";

import { tier3PairwiseTests } from "../tests/e2e/tier3-integration/pairwise-matrix.test";
import { tier4ScenarioTests } from "../tests/e2e/tier4-scenarios/application-scenarios.test";

// Aggregate all test cases
const ALL_TESTS: TestCase[] = [
  // Tier 1: Feature Coverage (115 tests)
  ...m1SolanaFeatureTests,
  ...m2AgentFeatureTests,
  ...m3ActionsFeatureTests,
  ...m4UiStretchesFeatureTests,
  ...m5m6TestPackageFeatureTests,

  // Tier 2: Boundaries & Corner Cases (115 tests)
  ...m1BoundaryTests,
  ...m2BoundaryTests,
  ...m3BoundaryTests,
  ...m4m6BoundaryTests,

  // Tier 3: Pairwise Integration (18 tests)
  ...tier3PairwiseTests,

  // Tier 4: Real-World Scenarios (6 tests)
  ...tier4ScenarioTests,
];

const VALID_MILESTONES = new Set<string>(["G1", "M1", "M2", "M3", "M4", "M5", "M6", "ALL"]);
const VALID_TIERS = new Set<string>(["1", "2", "3", "4", "ALL"]);
const VALID_TRACKS = new Set<string>(["mock", "live", "both"]);

export function parseArgs(rawArgs: string[] = process.argv.slice(2)): {
  milestone: MilestoneId | "all";
  tier: TierId | "all";
  track: "mock" | "live" | "both";
  verbose: boolean;
  help: boolean;
} {
  let milestone: MilestoneId | "all" = "all";
  let tier: TierId | "all" = "all";
  let track: "mock" | "live" | "both" = "mock";
  let verbose = false;
  let help = false;

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === "--milestone") {
      const val = rawArgs[++i];
      if (!val || !VALID_MILESTONES.has(val.toUpperCase())) {
        throw new Error(
          `Invalid --milestone value "${val ?? ""}". Expected one of: G1, M1, M2, M3, M4, M5, M6, all.`
        );
      }
      const upper = val.toUpperCase();
      milestone = upper === "ALL" ? "all" : (upper as MilestoneId);
    } else if (arg === "--tier") {
      const val = rawArgs[++i];
      if (!val || !VALID_TIERS.has(val.toUpperCase())) {
        throw new Error(
          `Invalid --tier value "${val ?? ""}". Expected one of: 1, 2, 3, 4, all.`
        );
      }
      tier = val.toLowerCase() === "all" ? "all" : (parseInt(val, 10) as TierId);
    } else if (arg === "--track") {
      const val = rawArgs[++i]?.toLowerCase();
      if (!val || !VALID_TRACKS.has(val)) {
        throw new Error(
          `Invalid --track value "${val ?? ""}". Expected one of: mock, live, both.`
        );
      }
      track = val as "mock" | "live" | "both";
    } else if (arg === "--verbose" || arg === "-v") {
      verbose = true;
    } else if (arg === "--help" || arg === "-h") {
      help = true;
    } else {
      throw new Error(`Unknown CLI argument "${arg}". Run with --help for usage.`);
    }
  }

  return { milestone, tier, track, verbose, help };
}

function printHelp() {
  console.log(`
AegisFlow Dual-Track E2E Test Runner

Usage:
  npx tsx scripts/run-e2e-suite.ts [options]

Options:
  --milestone <G1|M1|M2|M3|M4|M5|M6|all>   Target milestone (default: all)
  --tier <1|2|3|4|all>                     Target tier (default: all)
  --track <mock|live|both>                 Execution track (default: mock)
  --verbose, -v                            Print detailed logs
  --help, -h                               Show this help message
`);
}

async function runTestSuite(): Promise<TestSuiteSummary> {
  let parsedArgs: ReturnType<typeof parseArgs>;
  try {
    parsedArgs = parseArgs();
  } catch (cliErr: unknown) {
    console.error(
      `❌ CLI Argument Error: ${
        cliErr instanceof Error ? cliErr.message : String(cliErr)
      }`
    );
    printHelp();
    process.exit(1);
  }
  const { milestone, tier, track, verbose, help } = parsedArgs;

  if (help) {
    printHelp();
    process.exit(0);
  }

  console.log("================================================================================");
  console.log("              AEGISFLOW DUAL-TRACK E2E TEST SUITE RUNNER                        ");
  console.log("================================================================================");
  console.log(`Filter: Milestone=${milestone} | Tier=${tier} | Track=${track} | Verbose=${verbose}`);
  console.log(`Discovered Total Scaffolding: ${ALL_TESTS.length} test cases across 4 tiers`);
  console.log("--------------------------------------------------------------------------------\n");

  const startTime = Date.now();
  const results: TestResult[] = [];

  // Filter test cases
  const filteredTests = ALL_TESTS.filter((t) => {
    if (milestone !== "all" && t.milestone !== milestone) return false;
    if (tier !== "all" && t.tier !== tier) return false;
    if (track === "mock" && t.track === "live") return false;
    if (track === "live" && t.track === "mock") return false;
    return true;
  });

  console.log(`Executing ${filteredTests.length} tests matching active filters...\n`);

  const context: TestContext = {
    track: track === "both" ? "mock" : track,
    milestoneFilter: milestone,
    tierFilter: tier,
    verbose,
    rpcUrl: process.env.HELIUS_RPC_URL || "https://api.devnet.solana.com",
  };

  for (const test of filteredTests) {
    const testStart = Date.now();
    let status: TestResult["status"] = "PASSED";
    let error: Error | string | undefined;

    try {
      await test.run({ ...context, track: test.track });
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      if (e.name === "PendingTestError" || e.message?.startsWith("PENDING:")) {
        status = "PENDING";
        error = e.message.replace(/^PENDING:\s*/, "");
      } else {
        status = "FAILED";
        error = e;
      }
    }

    const durationMs = Date.now() - testStart;
    results.push({
      testId: test.id,
      name: test.name,
      featureId: test.featureId,
      milestone: test.milestone,
      tier: test.tier,
      track: test.track,
      status,
      durationMs,
      error,
    });

    if (verbose || status === "FAILED") {
      const icon = status === "PASSED" ? "✅" : status === "PENDING" ? "⏳" : "❌";
      console.log(`  ${icon} [${test.id}] (${test.milestone}/T${test.tier}) ${test.name} - ${status} (${durationMs}ms)`);
      if (error && status === "FAILED") {
        console.error(`      Error: ${error instanceof Error ? error.message : error}`);
      } else if (error && status === "PENDING" && verbose) {
        console.log(`      Reason: ${error}`);
      }
    }
  }

  const durationMs = Date.now() - startTime;
  const passed = results.filter((r) => r.status === "PASSED").length;
  const failed = results.filter((r) => r.status === "FAILED").length;
  const pending = results.filter((r) => r.status === "PENDING").length;
  const skipped = ALL_TESTS.length - filteredTests.length;

  console.log("\n--------------------------------------------------------------------------------");
  console.log("                           EXECUTION SUMMARY                                    ");
  console.log("--------------------------------------------------------------------------------");
  console.log(`  Total Active:     ${results.length}`);
  console.log(`  Passed:           ${passed} (${((passed / (results.length || 1)) * 100).toFixed(1)}%)`);
  console.log(`  Pending:          ${pending} (${((pending / (results.length || 1)) * 100).toFixed(1)}%)`);
  console.log(`  Failed:           ${failed}`);
  console.log(`  Filtered/Skipped: ${skipped}`);
  console.log(`  Total Suite Size: ${ALL_TESTS.length}`);
  console.log(`  Duration:         ${durationMs}ms`);
  console.log("--------------------------------------------------------------------------------");

  // Tier-by-Tier Breakdown
  console.log("\nBreakdown by Tier:");
  for (const t of [1, 2, 3, 4] as const) {
    const tierResults = results.filter((r) => r.tier === t);
    const tPassed = tierResults.filter((r) => r.status === "PASSED").length;
    const tPending = tierResults.filter((r) => r.status === "PENDING").length;
    const tFailed = tierResults.filter((r) => r.status === "FAILED").length;
    console.log(`  • Tier ${t}: Total=${tierResults.length} | Passed=${tPassed} | Pending=${tPending} | Failed=${tFailed}`);
  }

  // Milestone Breakdown
  console.log("\nBreakdown by Milestone:");
  const milestones: MilestoneId[] = ["M1", "M2", "M3", "M4", "M5", "M6"];
  for (const m of milestones) {
    const mResults = results.filter((r) => r.milestone === m);
    if (mResults.length > 0) {
      const mPassed = mResults.filter((r) => r.status === "PASSED").length;
      const mPending = mResults.filter((r) => r.status === "PENDING").length;
      const mFailed = mResults.filter((r) => r.status === "FAILED").length;
      console.log(`  • Milestone ${m}: Total=${mResults.length} | Passed=${mPassed} | Pending=${mPending} | Failed=${mFailed}`);
    }
  }

  if (failed > 0) {
    console.log("\n❌ FAILURES DETECTED:");
    for (const f of results.filter((r) => r.status === "FAILED")) {
      console.log(`  - [${f.testId}] ${f.name}: ${f.error instanceof Error ? f.error.message : f.error}`);
    }
  } else {
    console.log("\n✅ ALL ACTIVE SUITE TESTS COMPLETED WITH ZERO FAILURES.");
    if (pending > 0) {
      console.log(`ℹ️ Note: ${pending} tests marked PENDING for upcoming milestone implementations.`);
    }
  }
  console.log("================================================================================\n");

  return {
    total: results.length,
    passed,
    failed,
    pending,
    skipped,
    durationMs,
    results,
  };
}

const isMainModule =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  runTestSuite()
    .then((summary) => {
      process.exit(summary.failed > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error("Fatal test runner error:", err);
      process.exit(1);
    });
}
