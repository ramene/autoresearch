# SKILL: polymarket-clob-trader
Authenticated CLOB trading on Polymarket — L2 HMAC auth, place/cancel/batch orders, heartbeat management, and order lifecycle tracking on Polygon.

## Purpose
This skill enables autonomous order execution on Polymarket's Central Limit Order Book. It handles the full authentication chain (L1 EIP-712 credential derivation → L2 HMAC-SHA256 request signing), order creation across all types (GTC/GTD/FOK/FAK), batch operations (up to 15 orders), cancellation, and heartbeat keepalive. It is the foundational trading primitive that all other Polymarket strategy skills depend on.

## Trigger Conditions
1. **Slash Command:** `/skill polymarket-clob-trader [flags]`
   - `--place`: Place a single order
   - `--batch`: Place multiple orders (up to 15)
   - `--cancel`: Cancel order(s)
   - `--cancel-all`: Cancel all open orders
   - `--heartbeat`: Start/manage heartbeat
   - `--orders`: List open orders
   - `--token-id=<id>`: Target token ID
   - `--price=<float>`: Order price (0-1)
   - `--size=<float>`: Number of shares
   - `--side=<BUY|SELL>`: Order side
   - `--type=<GTC|GTD|FOK|FAK>`: Order type (default: GTC)
   - `--expiration=<seconds>`: For GTD orders, lifetime in seconds
   - `--post-only`: Guarantee maker status (GTC/GTD only)
   - `--neg-risk`: Mark as negative risk market order

2. **Keywords:** "place order on polymarket", "buy/sell prediction market", "cancel polymarket orders", "trade on polymarket"

## Prerequisites
1. **Working Directory:** `~/.remote/@autoresearch/skills/working-polymarket-clob-trader/`
2. **Environment Variables:**
   - `POLY_PRIVATE_KEY` — Ethereum private key (hex, with 0x prefix)
   - `POLY_SAFE_ADDRESS` — Polymarket Safe/Proxy wallet address (from polymarket.com/settings)
3. **Optional Environment Variables:**
   - `POLY_BUILDER_API_KEY`, `POLY_BUILDER_SECRET`, `POLY_BUILDER_PASSPHRASE` — For gasless/builder mode
4. **Network:** Access to `https://clob.polymarket.com` (Polygon chain ID 137)
5. **Dependencies:** Python with `py-clob-client` or Node.js with `@polymarket/clob-client`

## API Configuration

| API | Base URL | Auth | Purpose |
|-----|----------|------|---------|
| CLOB | `https://clob.polymarket.com` | L2 HMAC for trade endpoints | Order submission, cancellation, heartbeat |

## Contract Addresses (Polygon)

| Contract | Address |
|----------|---------|
| USDC.e | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` |
| CTF Exchange | `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E` |
| Neg Risk CTF Exchange | `0xC5d563A36AE78145C45a50134d48A1215220f80a` |

## Execution Steps

1. **Authentication:**
   - Load `POLY_PRIVATE_KEY` and `POLY_SAFE_ADDRESS` from environment
   - Create L1 client: `ClobClient(host, chain_id=137, signer)`
   - Derive API credentials: `client.createOrDeriveApiKey()` → `{apiKey, secret, passphrase}`
   - Initialize L2 trading client with credentials, signatureType=2 (Gnosis Safe), and funder address
   - If builder credentials present, initialize with BuilderConfig for gasless mode

2. **Get Market Parameters:**
   - Fetch tick size: `client.getTickSize(tokenID)` — price must conform or order is rejected
   - Fetch neg risk flag: `client.getNegRisk(tokenID)` — determines which exchange contract
   - Validate price conforms to tick size precision

3. **Place Order (single):**
   - Validate inputs: price (0-1), size > 0, side (BUY/SELL)
   - For GTC: `client.createAndPostOrder({tokenID, price, size, side}, {tickSize, negRisk}, OrderType.GTC)`
   - For GTD: Calculate expiration = `now + 60 + lifetime_seconds`, pass expiration in OrderArgs
   - For FOK/FAK: Use `createAndPostMarketOrder` — BUY amount = dollars to spend, SELL amount = shares to sell
   - For post-only: Pass `postOnly=true` (GTC/GTD only, rejected for FOK/FAK)
   - Log order result: `{orderID, status}` where status is `matched|live|delayed|unmatched`

4. **Batch Orders:**
   - Create up to 15 signed orders via `client.createOrder()` for each
   - Submit all at once: `client.postOrders(orders)`
   - Log individual results

5. **Cancel Orders:**
   - Single: `client.cancelOrder(orderID)`
   - Multiple: `client.cancelOrders([id1, id2, ...])`
   - All: `client.cancelAll()`
   - By market: `client.cancelMarketOrders({market: conditionID, asset_id: tokenID})`

6. **Heartbeat Management:**
   - If heartbeat mode, send heartbeat every 5 seconds
   - First request: empty string for heartbeat_id
   - Subsequent: use returned heartbeat_id
   - WARNING: If valid heartbeat not received within 10s (5s buffer), ALL open orders are cancelled
   - On 400 Bad Request: use the corrected heartbeat_id from response

7. **Track Order Lifecycle:**
   - Monitor trade status: MATCHED → MINED → CONFIRMED (success) or MATCHED → RETRYING → FAILED
   - Save order results to `orders.json` in working directory

## Safety Limits
- MAX_ORDER_SIZE_USD = $1,000
- MAX_TOTAL_EXPOSURE_USD = $5,000
- REQUIRE_CONFIRMATION_ABOVE = $500
- Validate all orders against safety limits before submission

## Order Types Reference

| Type | Behavior | Amount Semantics |
|------|----------|-----------------|
| GTC | Rests on book until filled/cancelled | size = shares |
| GTD | Active until expiration (UTC seconds) | size = shares |
| FOK | Fill entirely immediately or cancel | BUY: dollars, SELL: shares |
| FAK | Fill available, cancel rest | BUY: dollars, SELL: shares |

## Signature Types

| Type | Value | When to Use |
|------|-------|-------------|
| EOA | 0 | Standard wallet, needs POL for gas |
| POLY_PROXY | 1 | Magic Link email/Google exported PK |
| GNOSIS_SAFE | 2 | Most common, default for new users |

## Error Codes

| Error | Action |
|-------|--------|
| `INVALID_ORDER_MIN_TICK_SIZE` | Adjust price to market tick size |
| `INVALID_ORDER_NOT_ENOUGH_BALANCE` | Check funder balance and allowances |
| `INVALID_POST_ONLY_ORDER` | Order would cross spread — adjust price |
| `FOK_ORDER_NOT_FILLED_ERROR` | Insufficient liquidity for FOK |
| `MARKET_NOT_READY` | Market not accepting orders yet |

## Output Format
- **Console:** Order placement confirmation with orderID, status, and trade details
- **`orders.json`:** Structured log of all orders placed, cancelled, and their final status

## Quality Gates
1. L2 authentication succeeds and API credentials are valid
2. Order price conforms to market tick size
3. Safety limits validated before submission
4. Order status tracked through full lifecycle (MATCHED → CONFIRMED/FAILED)
5. Heartbeat maintains connection without order cancellation
6. Batch orders (up to 15) submitted and tracked individually
7. Cancel operations confirmed via API response

## Integration Points
- **Upstream:** `polymarket-market-discovery` identifies markets, `polymarket-market-analyzer` recommends trades
- **Downstream:** `polymarket-portfolio-tracker` tracks positions, `polymarket-position-manager` manages TP/SL
- **Dependency:** All strategy skills (flash-crash, 5min-strategy) depend on this for execution
