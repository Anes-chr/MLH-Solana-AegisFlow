import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { RiskBand } from './policy';

export const PLAN_TTL_MS = 600_000; // 10 minutes TTL

export interface CanonicalPlanPayload {
  version: 'aegis:v1';
  kind: 'swap' | 'transfer';
  walletPubkey: string;
  amountSol: number;
  expectedDUsdc?: number;
  destination?: string | null;
  pythPriceUsd: number;
  maxSlippageBps: number;
  createdAt: number;
}

export interface StoredActionPlan {
  id: string;
  createdAt: number;
  expiresAt: number;
  intentKind: 'swap' | 'transfer';
  amountSol: number;
  expectedDUsdc?: number;
  destination?: string | null;
  pythPriceUsd: number;
  maxSlippageBps: number;
  spendingCapSol?: number;
  planJson: CanonicalPlanPayload;
  planSha256: string;
  riskScore: number;
  riskBand: RiskBand;
  explanationBullets: string[];
}

const memoryPlans = new Map<string, StoredActionPlan>();
const DISK_CACHE_FILE = path.join(os.tmpdir(), 'aegisflow-plans-v1.json');

function getHmacSecret(): string {
  return (
    process.env.AEGIS_PLAN_HMAC_SECRET ||
    process.env.VAULT_SECRET_KEY ||
    'aegisflow-devnet-ephemeral-hmac-secret-v1'
  );
}

function readDiskPlans(): Record<string, StoredActionPlan> {
  try {
    if (fs.existsSync(DISK_CACHE_FILE)) {
      const raw = fs.readFileSync(DISK_CACHE_FILE, 'utf-8');
      return JSON.parse(raw) as Record<string, StoredActionPlan>;
    }
  } catch {
    // Ignore disk cache read errors on read-only serverless fs
  }
  return {};
}

function writeDiskPlans(records: Record<string, StoredActionPlan>): void {
  try {
    fs.writeFileSync(DISK_CACHE_FILE, JSON.stringify(records), 'utf-8');
  } catch {
    // Non-fatal on read-only serverless filesystems; HMAC token handles stateless verification
  }
}

export function evictExpiredPlans(now: number = Date.now()): void {
  for (const [id, plan] of memoryPlans.entries()) {
    if (plan.expiresAt <= now) {
      memoryPlans.delete(id);
    }
  }
}

/**
 * Encodes a StoredActionPlan into an HMAC-SHA256 signed base64url token
 * so serverless Action GET/POST routes can reconstruct plans statelessly
 * without trusting client-modifiable fields.
 */
export function encodeSignedPlanToken(plan: StoredActionPlan): string {
  const payloadB64 = Buffer.from(JSON.stringify(plan), 'utf-8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getHmacSecret())
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${sig}`;
}

export function decodeSignedPlanToken(token: string): StoredActionPlan | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadB64, providedSig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', getHmacSecret())
      .update(payloadB64)
      .digest('base64url');

    const a = Buffer.from(providedSig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }

    const parsed = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf-8')
    ) as StoredActionPlan;
    if (!parsed || typeof parsed.id !== 'string' || typeof parsed.expiresAt !== 'number') {
      return null;
    }
    if (parsed.expiresAt <= Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Stores an approved plan (strictly requires riskScore < 50).
 * Never stores a blockhash (fresh blockhashes are queried inside Action POST).
 */
export function saveApprovedPlan(
  params: Omit<StoredActionPlan, 'id' | 'createdAt' | 'expiresAt'> & {
    id?: string;
    ttlMs?: number;
  }
): { plan: StoredActionPlan; signedToken: string } {
  if (params.riskScore >= 50) {
    throw new Error(
      `Refusing to store blocked plan with riskScore=${params.riskScore} (>= 50).`
    );
  }

  const now = Date.now();
  evictExpiredPlans(now);

  const id = params.id || `plan_${crypto.randomBytes(8).toString('hex')}`;
  const ttl = params.ttlMs ?? PLAN_TTL_MS;

  const stored: StoredActionPlan = {
    id,
    createdAt: now,
    expiresAt: now + ttl,
    intentKind: params.intentKind,
    amountSol: params.amountSol,
    expectedDUsdc: params.expectedDUsdc,
    destination: params.destination ?? null,
    pythPriceUsd: params.pythPriceUsd,
    maxSlippageBps: params.maxSlippageBps,
    ...(params.spendingCapSol !== undefined
      ? { spendingCapSol: params.spendingCapSol }
      : {}),
    planJson: params.planJson,
    planSha256: params.planSha256,
    riskScore: params.riskScore,
    riskBand: params.riskBand,
    explanationBullets: params.explanationBullets,
  };

  memoryPlans.set(id, stored);

  const disk = readDiskPlans();
  for (const k of Object.keys(disk)) {
    if (disk[k].expiresAt <= now) {
      delete disk[k];
    }
  }
  disk[id] = stored;
  writeDiskPlans(disk);

  const signedToken = encodeSignedPlanToken(stored);
  return { plan: stored, signedToken };
}

/**
 * Resolves a plan by ID (from memory or disk) or stateless HMAC token.
 */
export function resolveActionPlan(
  planId: string | null | undefined,
  signedToken?: string | null
): StoredActionPlan | null {
  const now = Date.now();
  evictExpiredPlans(now);

  if (planId) {
    const inMem = memoryPlans.get(planId);
    if (inMem && inMem.expiresAt > now) {
      return inMem;
    }

    const disk = readDiskPlans();
    const onDisk = disk[planId];
    if (onDisk && onDisk.expiresAt > now) {
      memoryPlans.set(planId, onDisk);
      return onDisk;
    }
  }

  if (signedToken) {
    const decoded = decodeSignedPlanToken(signedToken);
    if (decoded && (!planId || decoded.id === planId)) {
      memoryPlans.set(decoded.id, decoded);
      return decoded;
    }
  }

  // Also allow self-contained signed token passed directly in ?plan=
  if (planId && planId.includes('.')) {
    const decoded = decodeSignedPlanToken(planId);
    if (decoded) {
      memoryPlans.set(decoded.id, decoded);
      return decoded;
    }
  }

  return null;
}
