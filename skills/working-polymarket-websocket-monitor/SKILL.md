# SKILL: polymarket-websocket-monitor
Real-time WebSocket subscriptions to Polymarket market/user/sports channels -- streaming price changes, orderbook updates, trade executions, and market resolution events.

## Purpose
This skill establishes and manages WebSocket connections to Polymarket's streaming endpoints for real-time data. It monitors price changes, orderbook updates, trade executions (via user channel), tick size changes, and market resolution events. It provides the real-time data feed that strategy skills (flash-crash-detector, 5min-strategy) depend on for timely signal detection.

## Trigger Conditions
1. **Slash Command:** `/skill polymarket-websocket-monitor [flags]`
   - `--subscribe=<token_ids>`: Subscribe to market channel for specific tokens
   - `--user`: Subscribe to user channel (requires auth) for trade/order updates
   - `--sports`: Subscribe to sports channel for live scores
   - `--events=<types>`: Filter event types (book, price_change, last_trade_price, best_bid_ask, market_resolved)
   - `--duration=<seconds>`: Monitor duration (default: 300)
   - `--callback=<skill>`: Forward events to another skill for processing

2. **Keywords:** "monitor polymarket prices", "real-time prediction market", "stream polymarket orderbook", "watch polymarket trades"

## Prerequisites
1. **Working Directory:** `~/.remote/@autoresearch/skills/working-polymarket-websocket-monitor/`
2. **Network:** Access to `wss://ws-subscriptions-clob.polymarket.com/ws/market` (market channel, no auth) and `wss://ws-subscriptions-clob.polymarket.com/ws/user` (user channel, requires API credentials)
3. **For User Channel:** `POLY_API_KEY`, `POLY_API_SECRET`, `POLY_API_PASSPHRASE`

## WebSocket Channels

| Channel | Endpoint | Auth | Subscribe By |
|---------|----------|------|-------------|
| Market | `wss://ws-subscriptions-clob.polymarket.com/ws/market` | No | asset_ids (token IDs) |
| User | `wss://ws-subscriptions-clob.polymarket.com/ws/user` | Yes | condition_ids (market IDs) |
| Sports | `wss://sports-api.polymarket.com/ws` | No | Auto (all active) |

## Event Types

| Event | Channel | Trigger | Key Fields |
|-------|---------|---------|------------|
| `book` | Market | Subscribe + book change | bids[], asks[], hash, timestamp |
| `price_change` | Market | Order placed/cancelled | price, size, side, best_bid, best_ask |
| `last_trade_price` | Market | Trade executed | price, side, size, fee_rate_bps |
| `tick_size_change` | Market | Price hits >0.96 or <0.04 | old_tick_size, new_tick_size |
| `best_bid_ask` | Market | Top-of-book changes | best_bid, best_ask, spread |
| `new_market` | Market | Market created | question, assets_ids, outcomes |
| `market_resolved` | Market | Resolution | winning_asset_id, winning_outcome |
| `trade` | User | Trade lifecycle | status: MATCHED/MINED/CONFIRMED/FAILED |
| `order` | User | Order lifecycle | type: PLACEMENT/UPDATE/CANCELLATION |

## Execution Steps

1. **Connect:** Open WebSocket to appropriate endpoint
2. **Subscribe:** Send subscription message with token/condition IDs; maintain a local subscription registry (set of active asset_ids/condition_ids) to enable full re-subscription on reconnect
3. **Heartbeat:** Send PING every 10 seconds (market/user channels); for the sports channel, respond to each server-initiated ping with a pong within 10 seconds. For all channels, if no PONG is received within 15 seconds of sending a PING, treat the connection as dropped and proceed to step 3a.
   - **3a. Reconnect on Drop:** On any connection error, close event, or heartbeat timeout: wait 1 second, re-open the WebSocket, re-authenticate (user channel), then re-send all subscription messages from the local subscription registry to restore the previous subscription state before resuming event processing.
4. **Process Events:** Parse JSON messages, filter by requested event types
5. **Dynamic Subscribe/Unsubscribe:** Send a new subscription/unsubscribe message on the existing open connection without reconnecting. Update the local subscription registry immediately. Wait up to 5 seconds for the next relevant event to confirm the subscription set changed (e.g., events arrive for a newly added token, or stop for a removed token). If confirmation does not arrive within 5 seconds, treat the connection as dropped, execute step 3a to reconnect, then re-apply the subscription change from the updated registry.
6. **Log Events:** Save to `events.jsonl` in working directory
7. **Forward:** If --callback specified, forward matching events to the target skill

## Quality Gates
1. WebSocket connection established and maintained with heartbeat; reconnects automatically on drop or heartbeat timeout using the subscription registry
2. Events correctly parsed and filtered by type
3. Dynamic subscribe/unsubscribe works without reconnection (or reconnects and retries on timeout within 5 seconds)
4. User channel authentication succeeds using POLY_API_KEY, POLY_API_SECRET, and POLY_API_PASSPHRASE
5. Events logged in structured JSONL format to `events.jsonl`
6. `tick_size_change` events (triggered when price crosses >0.96 or <0.04) are processed immediately to update tick size state, preventing subsequent order rejection due to stale tick size

## Integration Points
- **Downstream — flash-crash-detector:** Consumes `price_change` and `best_bid_ask` events to detect rapid price drops; requires low-latency delivery (within one heartbeat cycle) to generate timely crash signals
- **Downstream — 5min-strategy:** Consumes `price_change`, `last_trade_price`, and `best_bid_ask` events for real-time signal generation; uses the `--callback=polymarket-5min-strategy` flag to receive forwarded events
- **Downstream — position-manager:** Consumes `trade` events (MATCHED/MINED/CONFIRMED/FAILED) and `order` events from the user channel to track position lifecycle; requires user channel auth to be active