# Promotion Proposal: polymarket-websocket-monitor

## Scores
- **Baseline**: 23/25
- **Current**: 25/25
- **Improvement**: +2 points (100.0%)
- **Rounds**: 6

## Promotion Target
`/Users/ramene/Journal/.seed/base/skills/polymarket-websocket-monitor/SKILL.md`

## Key Mutations That Improved Score
1. Added explicit reconnection-on-drop logic and clarified heartbeat failure handling in Execution Steps, since both failing criteria (heartbeat maintenance and dynamic subscriptions) break when a connection silently drops without reconnect.
2. Added explicit timeout (5 seconds) and fallback (treat as dropped, trigger reconnect+resubscribe) for dynamic subscription verification in Step 5, making the failure path concrete and testable rather than ambiguous.
3. No failures to fix — all criteria score 5/5. Applied a minor clarity improvement to the sports channel heartbeat note to make the bidirectional ping/pong behavior unambiguous and consistent with the other channels.
4. No failures present — all criteria score 5/5. Applied a minor structural improvement to the Quality Gates section to align gate #6 with the tick_size_change event description in the Event Types table, making the relationship between tick size events and order rejection prevention more explicit and actionable.
5. No failures present — all criteria score 5/5. Applied a minor clarity improvement to the Integration Points section to make the dependency relationship between websocket-monitor and downstream skills more explicit, clarifying which specific event types each downstream skill consumes.

## Unified Diff (baseline -> current)
```diff
--- /Users/ramene/.remote/@autoresearch/skills/working-polymarket-websocket-monitor/SKILL.md.baseline	2026-03-20 19:21:41.000000000 -0600
+++ /Users/ramene/.remote/@autoresearch/skills/working-polymarket-websocket-monitor/SKILL.md	2026-03-21 04:09:38.000000000 -0600
@@ -45,21 +45,23 @@
 ## Execution Steps
 
 1. **Connect:** Open WebSocket to appropriate endpoint
-2. **Subscribe:** Send subscription message with token/condition IDs
-3. **Heartbeat:** Send PING every 10 seconds (market/user) or respond to server ping within 10s (sports)
+2. **Subscribe:** Send subscription message with token/condition IDs; maintain a local subscription registry (set of active asset_ids/condition_ids) to enable full re-subscription on reconnect
+3. **Heartbeat:** Send PING every 10 seconds (market/user channels); for the sports channel, respond to each server-initiated ping with a pong within 10 seconds. For all channels, if no PONG is received within 15 seconds of sending a PING, treat the connection as dropped and proceed to step 3a.
+   - **3a. Reconnect on Drop:** On any connection error, close event, or heartbeat timeout: wait 1 second, re-open the WebSocket, re-authenticate (user channel), then re-send all subscription messages from the local subscription registry to restore the previous subscription state before resuming event processing.
 4. **Process Events:** Parse JSON messages, filter by requested event types
-5. **Dynamic Subscribe/Unsubscribe:** Modify subscriptions without reconnecting
+5. **Dynamic Subscribe/Unsubscribe:** Send a new subscription/unsubscribe message on the existing open connection without reconnecting. Update the local subscription registry immediately. Wait up to 5 seconds for the next relevant event to confirm the subscription set changed (e.g., events arrive for a newly added token, or stop for a removed token). If confirmation does not arrive within 5 seconds, treat the connection as dropped, execute step 3a to reconnect, then re-apply the subscription change from the updated registry.
 6. **Log Events:** Save to `events.jsonl` in working directory
 7. **Forward:** If --callback specified, forward matching events to the target skill
 
 ## Quality Gates
-1. WebSocket connection established and maintained with heartbeat
+1. WebSocket connection established and maintained with heartbeat; reconnects automatically on drop or heartbeat timeout using the subscription registry
 2. Events correctly parsed and filtered by type
-3. Dynamic subscribe/unsubscribe works without reconnection
-4. User channel authentication succeeds
-5. Events logged in structured JSONL format
-6. tick_size_change events trigger immediate updates to prevent order rejection
+3. Dynamic subscribe/unsubscribe works without reconnection (or reconnects and retries on timeout within 5 seconds)
+4. User channel authentication succeeds using POLY_API_KEY, POLY_API_SECRET, and POLY_API_PASSPHRASE
+5. Events logged in structured JSONL format to `events.jsonl`
+6. `tick_size_change` events (triggered when price crosses >0.96 or <0.04) are processed immediately to update tick size state, preventing subsequent order rejection due to stale tick size
 
 ## Integration Points
-- **Downstream:** `polymarket-flash-crash-detector` monitors price_change events for crash signals, `polymarket-5min-strategy` uses real-time prices for signal generation
-- **Cross-skill:** `polymarket-position-manager` monitors trade events for position lifecycle
+- **Downstream — flash-crash-detector:** Consumes `price_change` and `best_bid_ask` events to detect rapid price drops; requires low-latency delivery (within one heartbeat cycle) to generate timely crash signals
+- **Downstream — 5min-strategy:** Consumes `price_change`, `last_trade_price`, and `best_bid_ask` events for real-time signal generation; uses the `--callback=polymarket-5min-strategy` flag to receive forwarded events
+- **Downstream — position-manager:** Consumes `trade` events (MATCHED/MINED/CONFIRMED/FAILED) and `order` events from the user channel to track position lifecycle; requires user channel auth to be active
\ No newline at end of file

```

## Generated
- **Timestamp**: 2026-03-29T13:59:39.554Z
- **Source**: `/Users/ramene/.remote/@autoresearch/skills/working-polymarket-websocket-monitor/SKILL.md`
- **Baseline**: `/Users/ramene/.remote/@autoresearch/skills/working-polymarket-websocket-monitor/SKILL.md.baseline`
