import { Keypair, Transaction } from '@solana/web3.js';
import { GET as getActionsJson, OPTIONS as optionsActionsJson } from '../src/app/actions.json/route';
import {
  GET as getAegisAction,
  POST as postAegisAction,
  OPTIONS as optionsAegisAction,
} from '../src/app/api/actions/aegis/route';
import { POST as postAgentRoute } from '../src/app/api/agent/route';
import { getDevnetVaultConfig } from '../src/lib/solana/vault';

async function main() {
  console.log('\n==================================================================');
  console.log('  AegisFlow — Gate G4: Solana Actions / Blinks API Verification   ');
  console.log('==================================================================\n');

  // 1. Verify /actions.json GET & OPTIONS
  const optJsonRes = await optionsActionsJson();
  if (optJsonRes.status !== 200 || optJsonRes.headers.get('Access-Control-Allow-Origin') !== '*') {
    throw new Error('OPTIONS /actions.json failed CORS check');
  }
  const actionsJsonRes = await getActionsJson();
  const actionsJson = await actionsJsonRes.json();
  console.log(`[1/5] GET /actions.json -> ${actionsJson.rules.length} routing rules verified`);

  // 2. Execute /api/agent to generate an approved Swap Action URL
  const userKp = Keypair.generate();
  const agentReq = new Request('http://localhost:3000/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'Swap 0.1 SOL to USDC',
      walletPubkey: userKp.publicKey.toBase58(),
    }),
  });
  const agentRes = await postAgentRoute(agentReq);
  const agentData = await agentRes.json();
  if (!agentData.actionUrl || !agentData.blinkUrl) {
    throw new Error(`Expected approved actionUrl from /api/agent, got ${JSON.stringify(agentData)}`);
  }
  console.log(`[2/5] POST /api/agent -> Minted Action URL: ${agentData.actionUrl.slice(0, 72)}...`);
  console.log(`      Dial.to Blink:    ${agentData.blinkUrl.slice(0, 76)}...`);

  // 3. Verify OPTIONS & GET /api/actions/aegis
  const optAction = await optionsAegisAction();
  if (
    optAction.status !== 200 ||
    !optAction.headers.get('X-Blockchain-Ids')?.includes('solana:')
  ) {
    throw new Error('OPTIONS /api/actions/aegis missing Solana Devnet chain headers');
  }

  const getActionRes = await getAegisAction(new Request(agentData.actionUrl));
  if (getActionRes.status !== 200) {
    throw new Error(`GET /api/actions/aegis failed with ${getActionRes.status}`);
  }
  const actionMeta = await getActionRes.json();
  console.log(`[3/5] GET /api/actions/aegis -> "${actionMeta.title}"`);
  console.log(`      Label: "${actionMeta.label}"`);

  // 4. Verify POST /api/actions/aegis builds fresh blockhash & vault partial signature
  const postActionRes = await postAegisAction(
    new Request(agentData.actionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: userKp.publicKey.toBase58() }),
    })
  );
  if (postActionRes.status !== 200) {
    throw new Error(`POST /api/actions/aegis failed with ${postActionRes.status}`);
  }
  const postData = await postActionRes.json();
  const tx = Transaction.from(Buffer.from(postData.transaction, 'base64'));
  const vaultConfig = getDevnetVaultConfig();
  const vaultSig = tx.signatures.find((s) => s.publicKey.equals(vaultConfig.vaultPubkey));
  if (!vaultSig?.signature) {
    throw new Error('Action POST transaction missing Vault partial signature!');
  }
  tx.partialSign(userKp);
  if (!tx.verifySignatures()) {
    throw new Error('Co-signed Action transaction failed ed25519 verification!');
  }
  console.log(`[4/5] POST /api/actions/aegis -> Fresh blockhash ${tx.recentBlockhash?.slice(0, 12)}... & Vault signature verified`);

  // 5. Verify Error Boundaries (400 missing plan, 404 unknown plan, 400 invalid account)
  const bad400 = await getAegisAction(new Request('http://localhost:3000/api/actions/aegis'));
  const bad404 = await getAegisAction(
    new Request('http://localhost:3000/api/actions/aegis?plan=nonexistent_plan')
  );
  const badPost400 = await postAegisAction(
    new Request(agentData.actionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: 'not-a-valid-pubkey' }),
    })
  );
  if (bad400.status !== 400 || bad404.status !== 404 || badPost400.status !== 400) {
    throw new Error(
      `Unexpected boundary statuses: ${bad400.status}, ${bad404.status}, ${badPost400.status}`
    );
  }
  console.log('[5/5] Boundary status checks passed (HTTP 400 / 404 / invalid pubkey 400)');

  console.log('\n==================================================================');
  console.log('  ✅ GATE G4 VERIFIED: SOLANA ACTIONS & BLINKS API PASSED         ');
  console.log('==================================================================\n');
}

main().catch((err) => {
  console.error('\n❌ Gate G4 Verification Failed:', err);
  process.exit(1);
});
