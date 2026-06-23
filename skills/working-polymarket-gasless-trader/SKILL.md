# SKILL: polymarket-gasless-trader
Gasless transactions on Polymarket via the Builder Program relayer -- deploy Safe wallets, approve tokens, execute CTF operations, and submit orders without requiring POL for gas fees.

## Purpose
This skill enables gas-free trading on Polymarket through the Builder Program's relayer infrastructure. Users only need USDC.e -- Polymarket's relayer pays all gas fees. It handles Safe wallet deployment, token approvals, CTF operations (split/merge/redeem), and batch transaction execution through the relayer API. Requires Builder Program membership and builder API credentials.

## Trigger Conditions
1. **Slash Command:** `/skill polymarket-gasless-trader [flags]`
   - `--deploy`: Deploy Safe wallet for new user
   - `--approve`: Approve token spending for exchange contracts
   - `--execute`: Execute transaction(s) via relayer
   - `--status=<tx_id>`: Check relayer transaction status
   - `--batch`: Execute multiple operations atomically

2. **Keywords:** "gasless polymarket", "no gas fee trading", "deploy safe wallet polymarket", "builder program"

## Prerequisites
1. **Working Directory:** `~/.remote/@autoresearch/skills/working-polymarket-gasless-trader/`
2. **Environment:** `POLY_PRIVATE_KEY`, `POLY_BUILDER_API_KEY`, `POLY_BUILDER_SECRET`, `POLY_BUILDER_PASSPHRASE`
3. **Builder Program:** Must be enrolled at polymarket.com/settings?tab=builder
4. **Dependencies:** `@polymarket/builder-relayer-client`, `@polymarket/builder-signing-sdk`

## Relayer Configuration

| Setting | Value |
|---------|-------|
| Relayer URL | `https://relayer-v2.polymarket.com/` |
| Chain ID | 137 (Polygon) |
| Wallet Types | Safe (deploy first) or Proxy (auto-deploy) |

## Polygon Mainnet Contract Addresses

These are the canonical addresses used in all approval and CTF calls:

| Contract | Address |
|----------|---------|
| USDC.e (Collateral) | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` |
| Exchange (CLOB) | `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E` |
| CTF Exchange | `0xC5d563A36AE78145C45a50134d48A1215220f80a` |
| Neg Risk Exchange | `0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296` |
| Neg Risk Adapter | `0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296` |

When calling `encodeApprove`, approve **both** `Exchange` and `CTF Exchange` for `MaxUint256` on the USDC.e token — missing either approval causes order submission to fail silently.

## Builder HMAC Authentication

Every request to the relayer API **must** include these headers — missing or malformed headers cause immediate rejection:

```javascript
function buildAuthHeaders(method, requestPath, body = null) {
  const timestamp = Math.floor(Date.now() / 1000).toString()

  // CRITICAL: body component must be '' (empty string) for GET/DELETE requests
  // and JSON.stringify(body) for POST/PUT requests — never undefined or null
  const bodyStr = body !== null && body !== undefined ? JSON.stringify(body) : ''
  const message = timestamp + method.toUpperCase() + requestPath + bodyStr

  const signature = crypto
    .createHmac('sha256', process.env.POLY_BUILDER_SECRET)
    .update(message)
    .digest('base64')

  return {
    'POLY-API-KEY':       process.env.POLY_BUILDER_API_KEY,
    'POLY-SIGNATURE':     signature,
    'POLY-TIMESTAMP':     timestamp,
    'POLY-PASSPHRASE':    process.env.POLY_BUILDER_PASSPHRASE,
    'Content-Type':       'application/json',
  }
}
```

- `POLY-TIMESTAMP` must be within ±30 seconds of server time; use UTC epoch seconds
- `POLY-SIGNATURE` is HMAC-SHA256 over `timestamp + METHOD + path + body`, Base64-encoded
- For GET requests (e.g., status checks), the body component of the signature string is `''` — not `'null'`, not `'undefined'`
- For POST requests, the body component is `JSON.stringify(body)` using the **same** object sent in the request
- All four credential headers are required on **every** request (deploy, execute, status)

### Clock Skew Handling
If the relayer returns a `401 Unauthorized` or `timestamp expired` error despite correct credentials, the local system clock is likely drifted beyond ±30 seconds. Recovery steps:
1. Verify system time with `date -u` — compare against a known UTC source
2. On Linux/Mac: `sudo ntpdate -u pool.ntp.org` to resync
3. Do **not** manually offset `Date.now()` — fix the system clock instead
4. After resyncing, regenerate the `POLY-TIMESTAMP` fresh; never reuse a cached timestamp across requests

## Transaction States

| State | Terminal | Description |
|-------|----------|-------------|
| STATE_NEW | No | Received by relayer |
| STATE_EXECUTED | No | Submitted onchain |
| STATE_MINED | No | Included in block |
| STATE_CONFIRMED | Yes | Finalized |
| STATE_FAILED | Yes | Failed permanently |
| STATE_INVALID | Yes | Rejected |

## Execution Steps

### Step 1: Safe Wallet Deployment (MUST complete before any other operation)
```
txId = await client.deploy()
// Poll until STATE_CONFIRMED — do NOT proceed until terminal state is reached
proxyAddress = await pollUntilConfirmed(txId)  // extracts address from receipt
```
- Poll interval: 2 seconds, timeout: 120 seconds
- **If STATE_FAILED or STATE_INVALID:** abort and surface error — do not retry automatically
- Store `proxyAddress` for all subsequent calls; it is the Safe wallet address

### Step 2: Token Approvals (requires confirmed Safe from Step 1)
```javascript
const USDC_E   = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
const EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E'
const CTF_EXCHANGE = '0xC5d563A36AE78145C45a50134d48A1215220f80a'

// Approve both contracts — both are required for full trading functionality
const approveExchange    = encodeApprove(EXCHANGE, MaxUint256)
const approveCTFExchange = encodeApprove(CTF_EXCHANGE, MaxUint256)

// Submit as a batch so both approvals land atomically
txId = await client.executeBatch(proxyAddress, [approveExchange, approveCTFExchange])
await pollUntilConfirmed(txId)
```

### Step 3: Batch Transactions (atomic — all ops or none)
```
txId = await client.executeBatch(proxyAddress, [op1, op2, ...])
await pollUntilConfirmed(txId)
```
- A batch either fully confirms or fully fails — never partially applies

### Step 4: Status Tracking (poll helper)
```javascript
async function pollUntilConfirmed(txId, intervalMs = 2000, timeoutMs = 120000) {
  const terminal = ['STATE_CONFIRMED', 'STATE_FAILED', 'STATE_INVALID']
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const { state, receipt } = await client.getStatus(txId)
    if (state === 'STATE_CONFIRMED') return receipt
    if (terminal.includes(state)) throw new Error(`Transaction ${txId} ended in ${state}`)
    await sleep(intervalMs)
  }
  throw new Error(`Timeout waiting for ${txId}`)
}
```

## Output Format
- **Console:** Transaction status and hash
- **`gasless_log.json`:** Transaction history

## Quality Gates
1. Builder authentication with HMAC headers succeeds
2. Safe wallet deployed successfully with returned address
3. Relayer transactions reach CONFIRMED state
4. Batch operations execute atomically
5. Error states handled gracefully (FAILED, INVALID)

## Integration Points
- **Cross-skill:** Enables gas-free operation for `polymarket-clob-trader` and `polymarket-ctf-operations`
- **Upstream:** Builder credentials configured at polymarket.com/settings