/**
 * AegisFlow E2E Test Suite - Type Definitions
 */

export type MilestoneId = "G1" | "M1" | "M2" | "M3" | "M4" | "M5" | "M6";
export type TierId = 1 | 2 | 3 | 4;
export type TestTrack = "mock" | "live" | "both";

export type TestStatus = "PASSED" | "FAILED" | "PENDING" | "SKIPPED";

export interface TestCase {
  id: string;
  name: string;
  featureId: string;
  milestone: MilestoneId;
  tier: TierId;
  track: TestTrack;
  description: string;
  run: (context: TestContext) => Promise<void> | void;
}

export interface TestResult {
  testId: string;
  name: string;
  featureId: string;
  milestone: MilestoneId;
  tier: TierId;
  track: TestTrack;
  status: TestStatus;
  durationMs: number;
  error?: Error | string;
  details?: Record<string, unknown>;
}

export interface TestContext {
  track: TestTrack;
  milestoneFilter?: MilestoneId | "all";
  tierFilter?: TierId | "all";
  verbose: boolean;
  rpcUrl: string;
}

export interface TestSuiteSummary {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  skipped: number;
  durationMs: number;
  results: TestResult[];
}
