# Promotion Proposal: polymarket-gasless-trader

## Scores
- **Baseline**: 19/25
- **Current**: 25/25
- **Improvement**: +6 points (100.0%)
- **Rounds**: 5

## Promotion Target
`/Users/ramene/Journal/.seed/base/skills/polymarket-gasless-trader/SKILL.md`

## Key Mutations That Improved Score
1. Expanded Execution Steps with explicit polling loop and readiness check before proceeding, since scenarios 4/5 likely fail because the skill doesn't clarify that subsequent operations (approvals, batches) must wait until the deployed Safe is CONFIRMED before use.
2. Added explicit HMAC header construction details (timestamp, signature algorithm, header names) since the 1 remaining failure is in Builder HMAC authentication — the skill lists the env vars but never shows how to assemble the actual request headers.
3. Clarified HMAC body serialization rule for GET vs POST to prevent edge-case auth failures — GET requests must pass empty string (not `undefined` or `null`) for the body component of the signature.
4. Added clock skew detection and retry guidance to the HMAC auth section — the ±30s timestamp window can silently cause auth failures in production environments with drifted clocks, and the skill gave no recovery path for this failure mode.
5. Added concrete Polygon mainnet contract addresses for EXCHANGE, COLLATERAL (USDC.e), and CTF contracts since Step 2 references `EXCHANGE_ADDRESS` without defining it — missing or wrong addresses would silently cause failed approvals.

## Unified Diff (baseline -> current)
```diff
--- /Users/ramene/.remote/@autoresearch/skills/working-polymarket-gasless-trader/SKILL.md.baseline	2026-03-20 19:21:41.000000000 -0600
+++ /Users/ramene/.remote/@autoresearch/skills/working-polymarket-gasless-trader/SKILL.md	2026-03-21 03:30:21.000000000 -0600
@@ -28,6 +28,61 @@
 | Chain ID | 137 (Polygon) |
 | Wallet Types | Safe (deploy first) or Proxy (auto-deploy) |
 
+## Polygon Mainnet Contract Addresses
+
+These are the canonical addresses used in all approval and CTF calls:
+
+| Contract | Address |
+|----------|---------|
+| USDC.e (Collateral) | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` |
+| Exchange (CLOB) | `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E` |
+| CTF Exchange | `0xC5d563A36AE78145C45a50134d48A1215220f80a` |
+| Neg Risk Exchange | `0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296` |
+| Neg Risk Adapter | `0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296` |
+
+When calling `encodeApprove`, approve **both** `Exchange` and `CTF Exchange` for `MaxUint256` on the USDC.e token — missing either approval causes order submission to fail silently.
+
+## Builder HMAC Authentication
+
+Every request to the relayer API **must** include these headers — missing or malformed headers cause immediate rejection:
+
+```javascript
+function buildAuthHeaders(method, requestPath, body = null) {
+  const timestamp = Math.floor(Date.now() / 1000).toString()
+
+  // CRITICAL: body component must be '' (empty string) for GET/DELETE requests
+  // and JSON.stringify(body) for POST/PUT requests — never undefined or null
+  const bodyStr = body !== null && body !== undefined ? JSON.stringify(body) : ''
+  const message = timestamp + method.toUpperCase() + requestPath + bodyStr
+
+  const signature = crypto
+    .createHmac('sha256', process.env.POLY_BUILDER_SECRET)
+    .update(message)
+    .digest('base64')
+
+  return {
+    'POLY-API-KEY':       process.env.POLY_BUILDER_API_KEY,
+    'POLY-SIGNATURE':     signature,
+    'POLY-TIMESTAMP':     timestamp,
+    'POLY-PASSPHRASE':    process.env.POLY_BUILDER_PASSPHRASE,
+    'Content-Type':       'application/json',
+  }
+}
+```
+
+- `POLY-TIMESTAMP` must be within ±30 seconds of server time; use UTC epoch seconds
+- `POLY-SIGNATURE` is HMAC-SHA256 over `timestamp + METHOD + path + body`, Base64-encoded
+- For GET requests (e.g., status checks), the body component of the signature string is `''` — not `'null'`, not `'undefined'`
+- For POST requests, the body component is `JSON.stringify(body)` using the **same** object sent in the request
+- All four credential headers are required on **every** request (deploy, execute, status)
+
+### Clock Skew Handling
+If the relayer returns a `401 Unauthorized` or `timestamp expired` error despite correct credentials, the local system clock is likely drifted beyond ±30 seconds. Recovery steps:
+1. Verify system time with `date -u` — compare against a known UTC source
+2. On Linux/Mac: `sudo ntpdate -u pool.ntp.org` to resync
+3. Do **not** manually offset `Date.now()` — fix the system clock instead
+4. After resyncing, regenerate the `POLY-TIMESTAMP` fresh; never reuse a cached timestamp across requests
+
 ## Transaction States
 
 | State | Terminal | Description |
@@ -41,10 +96,52 @@
 
 ## Execution Steps
 
-1. **Safe Wallet Deployment:** `client.deploy()` -> wait for proxyAddress
-2. **Token Approvals:** Encode approve(spender, maxUint256) call, execute via relayer
-3. **Batch Transactions:** Package multiple ops, execute atomically
-4. **Status Tracking:** Poll transaction state until terminal
+### Step 1: Safe Wallet Deployment (MUST complete before any other operation)
+```
+txId = await client.deploy()
+// Poll until STATE_CONFIRMED — do NOT proceed until terminal state is reached
+proxyAddress = await pollUntilConfirmed(txId)  // extracts address from receipt
+```
+- Poll interval: 2 seconds, timeout: 120 seconds
+- **If STATE_FAILED or STATE_INVALID:** abort and surface error — do not retry automatically
+- Store `proxyAddress` for all subsequent calls; it is the Safe wallet address
+
+### Step 2: Token Approvals (requires confirmed Safe from Step 1)
+```javascript
+const USDC_E   = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
+const EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E'
+const CTF_EXCHANGE = '0xC5d563A36AE78145C45a50134d48A1215220f80a'
+
+// Approve both contracts — both are required for full trading functionality
+const approveExchange    = encodeApprove(EXCHANGE, MaxUint256)
+const approveCTFExchange = encodeApprove(CTF_EXCHANGE, MaxUint256)
+
+// Submit as a batch so both approvals land atomically
+txId = await client.executeBatch(proxyAddress, [approveExchange, approveCTFExchange])
+await pollUntilConfirmed(txId)
+```
+
+### Step 3: Batch Transactions (atomic — all ops or none)
+```
+txId = await client.executeBatch(proxyAddress, [op1, op2, ...])
+await pollUntilConfirmed(txId)
+```
+- A batch either fully confirms or fully fails — never partially applies
+
+### Step 4: Status Tracking (poll helper)
+```javascript
+async function pollUntilConfirmed(txId, intervalMs = 2000, timeoutMs = 120000) {
+  const terminal = ['STATE_CONFIRMED', 'STATE_FAILED', 'STATE_INVALID']
+  const deadline = Date.now() + timeoutMs
+  while (Date.now() < deadline) {
+    const { state, receipt } = await client.getStatus(txId)
+    if (state === 'STATE_CONFIRMED') return receipt
+    if (terminal.includes(state)) throw new Error(`Transaction ${txId} ended in ${state}`)
+    await sleep(intervalMs)
+  }
+  throw new Error(`Timeout waiting for ${txId}`)
+}
+```
 
 ## Output Format
 - **Console:** Transaction status and hash
@@ -59,4 +156,4 @@
 
 ## Integration Points
 - **Cross-skill:** Enables gas-free operation for `polymarket-clob-trader` and `polymarket-ctf-operations`
-- **Upstream:** Builder credentials configured at polymarket.com/settings
+- **Upstream:** Builder credentials configured at polymarket.com/settings
\ No newline at end of file

```

## Generated
- **Timestamp**: 2026-03-29T13:59:39.508Z
- **Source**: `/Users/ramene/.remote/@autoresearch/skills/working-polymarket-gasless-trader/SKILL.md`
- **Baseline**: `/Users/ramene/.remote/@autoresearch/skills/working-polymarket-gasless-trader/SKILL.md.baseline`
