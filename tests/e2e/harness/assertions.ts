/**
 * AegisFlow E2E Test Suite - Assertion Helpers
 */

export class AssertionError extends Error {
  constructor(message: string, public expected?: unknown, public actual?: unknown) {
    super(message);
    this.name = "AssertionError";
  }
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new AssertionError(`Assertion failed: ${message}`);
  }
}

export function assertEquals<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    const detail = message ? ` (${message})` : "";
    throw new AssertionError(
      `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}${detail}`,
      expected,
      actual
    );
  }
}

export function assertDeepEquals<T>(actual: T, expected: T, message?: string): void {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    const detail = message ? ` (${message})` : "";
    throw new AssertionError(
      `Expected deep equality but values differ${detail}:\nExpected: ${expectedStr}\nActual:   ${actualStr}`,
      expected,
      actual
    );
  }
}

export function assertGreaterThanOrEqual(actual: number, min: number, message?: string): void {
  if (actual < min) {
    throw new AssertionError(
      `Expected ${actual} >= ${min}${message ? ` (${message})` : ""}`,
      min,
      actual
    );
  }
}

export function assertLessThanOrEqual(actual: number, max: number, message?: string): void {
  if (actual > max) {
    throw new AssertionError(
      `Expected ${actual} <= ${max}${message ? ` (${message})` : ""}`,
      max,
      actual
    );
  }
}

export function assertInRange(actual: number, min: number, max: number, message?: string): void {
  if (actual < min || actual > max) {
    throw new AssertionError(
      `Expected ${actual} to be in range [${min}, ${max}]${message ? ` (${message})` : ""}`,
      { min, max },
      actual
    );
  }
}

export function assertMatches(actual: string, pattern: RegExp, message?: string): void {
  if (!pattern.test(actual)) {
    throw new AssertionError(
      `Expected "${actual}" to match pattern ${pattern}${message ? ` (${message})` : ""}`,
      pattern.toString(),
      actual
    );
  }
}

export function assertDefined<T>(val: T | null | undefined, message?: string): asserts val is T {
  if (val === null || val === undefined) {
    throw new AssertionError(`Expected value to be defined, got ${val}${message ? ` (${message})` : ""}`);
  }
}

export function markPending(reason: string): never {
  const err = new Error(`PENDING: ${reason}`);
  err.name = "PendingTestError";
  throw err;
}
