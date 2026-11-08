import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import {
  ExtensionType,
  getExtensionTypes,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  unpackMint,
} from '@solana/spl-token';
import { getSolanaConnection } from './config';
import { getDevnetVaultConfig } from './vault';

export class InvalidMintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMintError';
  }
}

export type MintSafetyVerdict = 'SAFE' | 'CAUTION' | 'DANGER';

export interface MintSafetyFinding {
  id: string;
  label: string;
  passed: boolean;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  penalty: number;
  detail: string;
}

export interface EvaluateMintSafetyInput {
  mint?: string;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  supplyRaw: bigint;
  decimals: number;
  isToken2022: boolean;
  extensions: string[];
  topHolderPct?: number | null;
}

export interface TokenScanReport {
  mint: string;
  cluster: 'mainnet-beta' | 'devnet';
  found: boolean;
  isMintAccount: boolean;
  ownerProgram: string | null;
  tokenStandard: 'SPL Token' | 'Token-2022' | 'Non-Mint Account' | 'Not Found';
  decimals: number | null;
  supplyUi: number | null;
  supplyRaw: string | null;
  mintAuthority: string | null;
  mintAuthorityRevoked: boolean;
  freezeAuthority: string | null;
  freezeAuthorityRevoked: boolean;
  extensions: string[];
  topHolderPct: number | null;
  riskScore: number;
  verdict: MintSafetyVerdict;
  findings: MintSafetyFinding[];
  bullets: string[];
  isLocalDevnetPreview?: boolean;
  scannedAt: string;
}

const SYSTEM_NULL_PUBKEY = '11111111111111111111111111111111';

const EXTENSION_NAME_MAP: Record<number, string> = {
  [ExtensionType.TransferFeeConfig]: 'transferFeeConfig',
  [ExtensionType.TransferFeeAmount]: 'transferFeeAmount',
  [ExtensionType.MintCloseAuthority]: 'mintCloseAuthority',
  [ExtensionType.ConfidentialTransferMint]: 'confidentialTransferMint',
  [ExtensionType.DefaultAccountState]: 'defaultAccountState',
  [ExtensionType.ImmutableOwner]: 'immutableOwner',
  [ExtensionType.MemoTransfer]: 'memoTransfer',
  [ExtensionType.NonTransferable]: 'nonTransferable',
  [ExtensionType.InterestBearingConfig]: 'interestBearingConfig',
  [ExtensionType.CpiGuard]: 'cpiGuard',
  [ExtensionType.PermanentDelegate]: 'permanentDelegate',
  [ExtensionType.TransferHook]: 'transferHook',
  16: 'confidentialTransferFeeConfig',
  17: 'confidentialTransferFeeAmount',
  [ExtensionType.MetadataPointer]: 'metadataPointer',
  [ExtensionType.TokenMetadata]: 'tokenMetadata',
  [ExtensionType.GroupPointer]: 'groupPointer',
  [ExtensionType.TokenGroup]: 'tokenGroup',
  [ExtensionType.GroupMemberPointer]: 'groupMemberPointer',
  [ExtensionType.TokenGroupMember]: 'tokenGroupMember',
  [ExtensionType.ScaledUiAmountConfig]: 'scaledUiAmountConfig',
  [ExtensionType.PausableConfig]: 'pausableConfig',
  [ExtensionType.PermissionedBurn]: 'permissionedBurn',
};

export function isAuthorityRevoked(authority: string | null | undefined): boolean {
  return !authority || authority === SYSTEM_NULL_PUBKEY;
}

/**
 * Pure deterministic safety evaluator for unpacked SPL Token & Token-2022 mints.
 */
export function evaluateMintSafety(input: EvaluateMintSafetyInput): {
  riskScore: number;
  verdict: MintSafetyVerdict;
  mintAuthorityRevoked: boolean;
  freezeAuthorityRevoked: boolean;
  findings: MintSafetyFinding[];
  bullets: string[];
} {
  const findings: MintSafetyFinding[] = [];
  let penalty = 0;

  const mintRevoked = isAuthorityRevoked(input.mintAuthority);
  if (mintRevoked) {
    findings.push({
      id: 'MINT_AUTHORITY',
      label: 'Mint Authority',
      passed: true,
      severity: 'info',
      penalty: 0,
      detail: 'Mint authority is revoked (fixed supply — issuer cannot print arbitrary tokens).',
    });
  } else {
    penalty += 30;
    findings.push({
      id: 'MINT_AUTHORITY',
      label: 'Mint Authority',
      passed: false,
      severity: 'high',
      penalty: 30,
      detail: `Mint authority is active (${input.mintAuthority?.slice(0, 6)}...${input.mintAuthority?.slice(-4)}) — authority can mint additional supply.`,
    });
  }

  const freezeRevoked = isAuthorityRevoked(input.freezeAuthority);
  if (freezeRevoked) {
    findings.push({
      id: 'FREEZE_AUTHORITY',
      label: 'Freeze Authority',
      passed: true,
      severity: 'info',
      penalty: 0,
      detail: 'Freeze authority is revoked — user token accounts cannot be frozen by issuer.',
    });
  } else {
    penalty += 50;
    findings.push({
      id: 'FREEZE_AUTHORITY',
      label: 'Freeze Authority',
      passed: false,
      severity: 'critical',
      penalty: 50,
      detail: `Freeze authority is active (${input.freezeAuthority?.slice(0, 6)}...${input.freezeAuthority?.slice(-4)}) — issuer can freeze holder accounts.`,
    });
  }

  // Token-2022 Extensions Check
  const extSet = new Set(input.extensions);
  if (extSet.has('permanentDelegate')) {
    penalty += 50;
    findings.push({
      id: 'EXT_PERMANENT_DELEGATE',
      label: 'Token-2022 Permanent Delegate',
      passed: false,
      severity: 'critical',
      penalty: 50,
      detail:
        'Permanent Delegate extension enabled — designated authority can transfer or burn tokens from any holder wallet.',
    });
  }

  if (extSet.has('transferHook')) {
    penalty += 25;
    findings.push({
      id: 'EXT_TRANSFER_HOOK',
      label: 'Token-2022 Transfer Hook',
      passed: false,
      severity: 'medium',
      penalty: 25,
      detail:
        'Transfer Hook extension enabled — custom third-party program executes on every token transfer.',
    });
  }

  if (extSet.has('transferFeeConfig')) {
    penalty += 20;
    findings.push({
      id: 'EXT_TRANSFER_FEE',
      label: 'Token-2022 Transfer Fee',
      passed: false,
      severity: 'medium',
      penalty: 20,
      detail: 'Transfer Fee extension enabled — protocol deducts a fee on every token transfer.',
    });
  }

  if (extSet.has('pausableConfig') || extSet.has('nonTransferable') || extSet.has('defaultAccountState')) {
    penalty += 20;
    findings.push({
      id: 'EXT_RESTRICTIVE_STATE',
      label: 'Token-2022 Transfer Restrictions',
      passed: false,
      severity: 'medium',
      penalty: 20,
      detail:
        'Restrictive Token-2022 state extension detected (pausable, non-transferable, or default-frozen accounts).',
    });
  }

  if (
    input.isToken2022 &&
    !extSet.has('permanentDelegate') &&
    !extSet.has('transferHook') &&
    !extSet.has('transferFeeConfig') &&
    !extSet.has('pausableConfig') &&
    !extSet.has('nonTransferable')
  ) {
    findings.push({
      id: 'TOKEN_2022_EXTENSIONS',
      label: 'Token-2022 Extensions',
      passed: true,
      severity: 'info',
      penalty: 0,
      detail:
        input.extensions.length > 0
          ? `Benign Token-2022 metadata/pointer extensions only (${input.extensions.join(', ')}).`
          : 'Token-2022 mint has no high-risk transfer or delegate hooks.',
    });
  }

  // Supply check (exempt canonical Wrapped SOL native mint So11111111111111111111111111111111111111112)
  const isWrappedSol = input.mint === 'So11111111111111111111111111111111111111112';
  if (input.supplyRaw === 0n && !isWrappedSol) {
    penalty += 20;
    findings.push({
      id: 'TOKEN_SUPPLY',
      label: 'Circulating Supply',
      passed: false,
      severity: 'medium',
      penalty: 20,
      detail: 'Zero circulating supply (0 tokens minted) — inactive or unlaunched mint.',
    });
  } else {
    findings.push({
      id: 'TOKEN_SUPPLY',
      label: 'Circulating Supply',
      passed: true,
      severity: 'info',
      penalty: 0,
      detail: isWrappedSol
        ? 'Native Wrapped SOL mint (supply dynamically backed 1:1 by locked SOL lamports).'
        : 'Active non-zero token supply verified on-chain.',
    });
  }

  // Holder concentration check
  if (input.topHolderPct != null) {
    if (input.topHolderPct >= 50) {
      penalty += 20;
      findings.push({
        id: 'HOLDER_CONCENTRATION',
        label: 'Top Holder Concentration',
        passed: false,
        severity: 'medium',
        penalty: 20,
        detail: `Single largest token account holds ${input.topHolderPct.toFixed(2)}% of total supply.`,
      });
    } else {
      findings.push({
        id: 'HOLDER_CONCENTRATION',
        label: 'Top Holder Concentration',
        passed: true,
        severity: 'info',
        penalty: 0,
        detail: `Largest token account holds ${input.topHolderPct.toFixed(2)}% of total supply (< 50% threshold).`,
      });
    }
  }

  const riskScore = Math.max(0, Math.min(100, penalty));
  const verdict: MintSafetyVerdict =
    riskScore < 20 ? 'SAFE' : riskScore < 50 ? 'CAUTION' : 'DANGER';

  const failed = findings.filter((f) => !f.passed);
  const bullets: string[] = [];

  if (failed.length === 0) {
    bullets.push(
      `• Verdict: SAFE (${riskScore}/100) — Both mint and freeze authorities are revoked with no dangerous Token-2022 hooks.`
    );
  } else {
    bullets.push(
      `• Verdict: ${verdict} (${riskScore}/100) — ${failed.length} authority or extension risk signal(s) detected on-chain.`
    );
    for (const f of failed.slice(0, 3)) {
      bullets.push(`• ${f.label}: ${f.detail}`);
    }
  }

  if (mintRevoked && freezeRevoked) {
    bullets.push('• Authority check: Neither mint inflation nor account freezing is possible.');
  }

  return {
    riskScore,
    verdict,
    mintAuthorityRevoked: mintRevoked,
    freezeAuthorityRevoked: freezeRevoked,
    findings,
    bullets,
  };
}

function getMainnetConnection(): Connection {
  const endpoint =
    process.env.SOLANA_MAINNET_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC_URL ||
    clusterApiUrl('mainnet-beta');
  return new Connection(endpoint, 'confirmed');
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`RPC timeout after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Inspects any SPL Token or Token-2022 mint on Solana Mainnet or Devnet,
 * unpacking binary Mint layout, authorities, Token-2022 TLV extensions, and holder concentration.
 */
export async function scanTokenMint(
  mintAddress: string,
  preferredCluster?: 'mainnet-beta' | 'devnet',
  customConnection?: Connection
): Promise<TokenScanReport> {
  const trimmed = (mintAddress || '').trim();
  if (!trimmed) {
    throw new InvalidMintError('Missing token mint address.');
  }

  let mintPubkey: PublicKey;
  try {
    mintPubkey = new PublicKey(trimmed);
  } catch {
    throw new InvalidMintError(`Invalid Solana base58 public key: "${trimmed}".`);
  }

  // Check if this is the local AegisFlow Devnet dUSDC mint when unfunded/mocked
  try {
    const vaultCfg = getDevnetVaultConfig();
    if (mintPubkey.equals(vaultCfg.dUsdcMint) && vaultCfg.isMock) {
      const supplyRaw = 1_000_000_000_000n;
      const decimals = 6;
      const safety = evaluateMintSafety({
        mint: mintPubkey.toBase58(),
        mintAuthority: vaultCfg.vaultPubkey.toBase58(),
        freezeAuthority: null,
        supplyRaw,
        decimals,
        isToken2022: false,
        extensions: [],
        topHolderPct: 100,
      });

      return {
        mint: mintPubkey.toBase58(),
        cluster: 'devnet',
        found: true,
        isMintAccount: true,
        ownerProgram: TOKEN_PROGRAM_ID.toBase58(),
        tokenStandard: 'SPL Token',
        decimals,
        supplyUi: 1_000_000,
        supplyRaw: supplyRaw.toString(),
        mintAuthority: vaultCfg.vaultPubkey.toBase58(),
        mintAuthorityRevoked: safety.mintAuthorityRevoked,
        freezeAuthority: null,
        freezeAuthorityRevoked: safety.freezeAuthorityRevoked,
        extensions: [],
        topHolderPct: 100,
        riskScore: safety.riskScore,
        verdict: safety.verdict,
        findings: safety.findings,
        bullets: [
          ...safety.bullets,
          '• Note: AegisFlow Devnet dUSDC test mint controlled by the local Devnet liquidity vault.',
        ],
        isLocalDevnetPreview: true,
        scannedAt: new Date().toISOString(),
      };
    }
  } catch {
    // Ignore if local vault file is absent
  }

  const clustersToTry: Array<'mainnet-beta' | 'devnet'> = preferredCluster
    ? [preferredCluster]
    : ['mainnet-beta', 'devnet'];

  let accountInfo: Awaited<ReturnType<Connection['getAccountInfo']>> = null;
  let activeCluster: 'mainnet-beta' | 'devnet' = clustersToTry[0];
  let activeConn: Connection | null = null;

  for (const cluster of clustersToTry) {
    try {
      const conn =
        customConnection ??
        (cluster === 'mainnet-beta'
          ? getMainnetConnection()
          : await getSolanaConnection(8_000));
      const info = await withTimeout(conn.getAccountInfo(mintPubkey, 'confirmed'), 6_500);
      if (info) {
        accountInfo = info;
        activeCluster = cluster;
        activeConn = conn;
        break;
      }
    } catch {
      // Try next cluster candidate
    }
  }

  if (!accountInfo) {
    return {
      mint: mintPubkey.toBase58(),
      cluster: activeCluster,
      found: false,
      isMintAccount: false,
      ownerProgram: null,
      tokenStandard: 'Not Found',
      decimals: null,
      supplyUi: null,
      supplyRaw: null,
      mintAuthority: null,
      mintAuthorityRevoked: false,
      freezeAuthority: null,
      freezeAuthorityRevoked: false,
      extensions: [],
      topHolderPct: null,
      riskScore: 100,
      verdict: 'DANGER',
      findings: [
        {
          id: 'ACCOUNT_NOT_FOUND',
          label: 'On-Chain Mint Account',
          passed: false,
          severity: 'critical',
          penalty: 100,
          detail: `No account data found for ${mintPubkey.toBase58()} on ${activeCluster}.`,
        },
      ],
      bullets: [
        `• Verdict: DANGER (100/100) — Account ${mintPubkey.toBase58()} does not exist on ${activeCluster}.`,
        '• Verify that you selected the right cluster (Mainnet vs Devnet) and copied a valid SPL mint address.',
      ],
      scannedAt: new Date().toISOString(),
    };
  }

  const ownerBase58 = accountInfo.owner.toBase58();
  const isSplToken = accountInfo.owner.equals(TOKEN_PROGRAM_ID);
  const isToken2022 = accountInfo.owner.equals(TOKEN_2022_PROGRAM_ID);

  if (!isSplToken && !isToken2022) {
    return {
      mint: mintPubkey.toBase58(),
      cluster: activeCluster,
      found: true,
      isMintAccount: false,
      ownerProgram: ownerBase58,
      tokenStandard: 'Non-Mint Account',
      decimals: null,
      supplyUi: null,
      supplyRaw: null,
      mintAuthority: null,
      mintAuthorityRevoked: false,
      freezeAuthority: null,
      freezeAuthorityRevoked: false,
      extensions: [],
      topHolderPct: null,
      riskScore: 100,
      verdict: 'DANGER',
      findings: [
        {
          id: 'NOT_TOKEN_MINT',
          label: 'SPL Program Ownership',
          passed: false,
          severity: 'critical',
          penalty: 100,
          detail: `Account is owned by ${ownerBase58}, not SPL Token or Token-2022. Not a token mint account.`,
        },
      ],
      bullets: [
        `• Not a token mint account — owned by program ${ownerBase58.slice(0, 8)}...`,
        '• Paste an SPL Token or Token-2022 mint address rather than a wallet or program address.',
      ],
      scannedAt: new Date().toISOString(),
    };
  }

  const programId = isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  let unpacked;
  try {
    unpacked = unpackMint(mintPubkey, accountInfo, programId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      mint: mintPubkey.toBase58(),
      cluster: activeCluster,
      found: true,
      isMintAccount: false,
      ownerProgram: ownerBase58,
      tokenStandard: 'Non-Mint Account',
      decimals: null,
      supplyUi: null,
      supplyRaw: null,
      mintAuthority: null,
      mintAuthorityRevoked: false,
      freezeAuthority: null,
      freezeAuthorityRevoked: false,
      extensions: [],
      topHolderPct: null,
      riskScore: 100,
      verdict: 'DANGER',
      findings: [
        {
          id: 'INVALID_MINT_DATA',
          label: 'Mint Binary Layout',
          passed: false,
          severity: 'critical',
          penalty: 100,
          detail: `Account is owned by token program ( likely a token holding account, not a Mint ): ${msg}`,
        },
      ],
      bullets: [
        '• Account is owned by the Token program, but failed Mint layout unpacking (likely an Associated Token Account rather than a Mint).',
      ],
      scannedAt: new Date().toISOString(),
    };
  }

  const extensions: string[] = [];
  if (isToken2022 && unpacked.tlvData && unpacked.tlvData.length > 0) {
    try {
      const extTypes = getExtensionTypes(unpacked.tlvData);
      for (const ext of extTypes) {
        extensions.push(EXTENSION_NAME_MAP[ext] ?? `extension_${ext}`);
      }
    } catch {
      // Ignore malformed TLV tail
    }
  }

  let topHolderPct: number | null = null;
  if (activeConn && unpacked.supply > 0n) {
    try {
      const largest = await withTimeout(
        activeConn.getTokenLargestAccounts(mintPubkey, 'confirmed'),
        3_500
      );
      const topRaw = largest.value[0]?.amount ? BigInt(largest.value[0].amount) : 0n;
      if (topRaw > 0n) {
        topHolderPct = Number((topRaw * 10_000n) / unpacked.supply) / 100;
      }
    } catch {
      topHolderPct = null;
    }
  }

  const mintAuthStr = unpacked.mintAuthority ? unpacked.mintAuthority.toBase58() : null;
  const freezeAuthStr = unpacked.freezeAuthority ? unpacked.freezeAuthority.toBase58() : null;

  const safety = evaluateMintSafety({
    mint: mintPubkey.toBase58(),
    mintAuthority: mintAuthStr,
    freezeAuthority: freezeAuthStr,
    supplyRaw: unpacked.supply,
    decimals: unpacked.decimals,
    isToken2022,
    extensions,
    topHolderPct,
  });

  const supplyUi = Number(unpacked.supply) / Math.pow(10, unpacked.decimals);

  return {
    mint: mintPubkey.toBase58(),
    cluster: activeCluster,
    found: true,
    isMintAccount: true,
    ownerProgram: ownerBase58,
    tokenStandard: isToken2022 ? 'Token-2022' : 'SPL Token',
    decimals: unpacked.decimals,
    supplyUi: Number.isFinite(supplyUi) ? supplyUi : null,
    supplyRaw: unpacked.supply.toString(),
    mintAuthority: mintAuthStr,
    mintAuthorityRevoked: safety.mintAuthorityRevoked,
    freezeAuthority: freezeAuthStr,
    freezeAuthorityRevoked: safety.freezeAuthorityRevoked,
    extensions,
    topHolderPct,
    riskScore: safety.riskScore,
    verdict: safety.verdict,
    findings: safety.findings,
    bullets: safety.bullets,
    scannedAt: new Date().toISOString(),
  };
}
