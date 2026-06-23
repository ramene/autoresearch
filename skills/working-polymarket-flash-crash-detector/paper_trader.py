#!/usr/bin/env python3
"""
Polymarket Paper Trading Pipeline — Standalone Runner

Chains the full skill pipeline for simulated paper trading:
  1. Market Discovery  →  find active 15-min crypto market
  2. Orderbook Reader  →  check spread, liquidity, viability
  3. Market Analyzer   →  score opportunity (trade or skip)
  4. WebSocket Monitor →  stream prices in real-time
  5. Flash Crash Detect →  detect 30%+ drops in 10s window
  6. Position Manager  →  manage TP/SL on simulated positions
  7. Portfolio Tracker  →  record P&L, track win rate

No wallet credentials needed. All trades are simulated.

Usage:
    # From the polymarket-trading-bot directory (has the libraries):
    cd ~/.remote/@polymarket-analysis/polymarket-trading-bot
    python ~/.remote/@autoresearch/skills/working-polymarket-flash-crash-detector/paper_trader.py

    # Or with options:
    python paper_trader.py --coin ETH --drop 0.25 --duration 60 --size 10

Requirements:
    - websockets>=12.0
    - requests>=2.28.0
    (No wallet, no py-clob-client, no eth-account needed)
"""

import os
import sys
import json
import time
import asyncio
import argparse
import logging
from datetime import datetime, timezone
from collections import deque
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional, Dict, List, Deque

# ---------------------------------------------------------------------------
# Try to import from polymarket-trading-bot if available, else use inline
# ---------------------------------------------------------------------------
TRADING_BOT_PATH = os.path.expanduser(
    "~/.remote/@polymarket-analysis/polymarket-trading-bot"
)
if os.path.isdir(TRADING_BOT_PATH):
    sys.path.insert(0, TRADING_BOT_PATH)

try:
    from src.gamma_client import GammaClient
    from lib.price_tracker import PriceTracker, FlashCrashEvent
    from lib.position_manager import PositionManager, Position
    HAS_TRADING_BOT = True
except ImportError:
    HAS_TRADING_BOT = False

# If trading-bot not available, use httpx/requests + inline implementations
try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

try:
    import websockets
    HAS_WEBSOCKETS = True
except ImportError:
    HAS_WEBSOCKETS = False

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("paper_trader")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
GAMMA_API = "https://gamma-api.polymarket.com"
CLOB_API = "https://clob.polymarket.com"
WSS_MARKET = "wss://ws-subscriptions-clob.polymarket.com/ws/market"

COIN_SLUGS = {
    "BTC": "btc-updown-15m",
    "ETH": "eth-updown-15m",
    "SOL": "sol-updown-15m",
    "XRP": "xrp-updown-15m",
}

# Safety limits (from polymarket-mcp-server)
MAX_ORDER_SIZE_USD = 1000.0
MAX_TOTAL_EXPOSURE_USD = 5000.0
MIN_LIQUIDITY_REQUIRED = 10000.0
MAX_SPREAD_TOLERANCE = 0.05

# ---------------------------------------------------------------------------
# Inline fallbacks (when polymarket-trading-bot not on sys.path)
# ---------------------------------------------------------------------------

def _http_get(url: str, timeout: int = 10) -> Optional[dict]:
    """HTTP GET with fallback between httpx, requests, and urllib."""
    if HAS_HTTPX:
        try:
            r = httpx.get(url, timeout=timeout)
            r.raise_for_status()
            return r.json()
        except Exception:
            return None
    elif HAS_REQUESTS:
        try:
            r = requests.get(url, timeout=timeout)
            r.raise_for_status()
            return r.json()
        except Exception:
            return None
    else:
        import urllib.request
        try:
            with urllib.request.urlopen(url, timeout=timeout) as resp:
                return json.loads(resp.read())
        except Exception:
            return None


if not HAS_TRADING_BOT:
    # Inline GammaClient
    class GammaClient:
        def __init__(self):
            self.host = GAMMA_API

        def get_current_15m_market(self, coin: str) -> Optional[dict]:
            coin = coin.upper()
            prefix = COIN_SLUGS.get(coin)
            if not prefix:
                return None
            now = datetime.now(timezone.utc)
            minute = (now.minute // 15) * 15
            current_window = now.replace(minute=minute, second=0, microsecond=0)
            current_ts = int(current_window.timestamp())
            for offset in [0, 900, -900]:
                slug = f"{prefix}-{current_ts + offset}"
                data = _http_get(f"{self.host}/markets/slug/{slug}")
                if data and data.get("acceptingOrders"):
                    return data
            return None

        def get_market_info(self, coin: str) -> Optional[dict]:
            market = self.get_current_15m_market(coin)
            if not market:
                return None
            token_ids = self._parse_tokens(market)
            prices = self._parse_prices(market)
            return {
                "slug": market.get("slug"),
                "question": market.get("question"),
                "end_date": market.get("endDate"),
                "token_ids": token_ids,
                "prices": prices,
                "accepting_orders": market.get("acceptingOrders", False),
            }

        def _parse_tokens(self, market):
            ids = json.loads(market.get("clobTokenIds", "[]")) if isinstance(
                market.get("clobTokenIds"), str
            ) else market.get("clobTokenIds", [])
            outcomes = json.loads(market.get("outcomes", '["Up","Down"]')) if isinstance(
                market.get("outcomes"), str
            ) else market.get("outcomes", ["Up", "Down"])
            return {str(o).lower(): ids[i] for i, o in enumerate(outcomes) if i < len(ids)}

        def _parse_prices(self, market):
            prices = json.loads(market.get("outcomePrices", '["0.5","0.5"]')) if isinstance(
                market.get("outcomePrices"), str
            ) else market.get("outcomePrices", ["0.5", "0.5"])
            outcomes = json.loads(market.get("outcomes", '["Up","Down"]')) if isinstance(
                market.get("outcomes"), str
            ) else market.get("outcomes", ["Up", "Down"])
            return {str(o).lower(): float(prices[i]) for i, o in enumerate(outcomes) if i < len(prices)}

    # Inline PriceTracker
    @dataclass
    class PricePoint:
        timestamp: float
        price: float
        side: str

    @dataclass
    class FlashCrashEvent:
        side: str
        old_price: float
        new_price: float
        drop: float
        timestamp: float
        @property
        def drop_percent(self):
            return (self.old_price - self.new_price) / self.old_price * 100 if self.old_price > 0 else 0

    @dataclass
    class PriceTracker:
        lookback_seconds: int = 10
        drop_threshold: float = 0.30
        max_history: int = 100
        _history: Dict[str, Deque] = field(default_factory=dict)
        def __post_init__(self):
            self._history = {"up": deque(maxlen=self.max_history), "down": deque(maxlen=self.max_history)}
        def record(self, side, price, timestamp=None):
            if side not in self._history or price <= 0:
                return
            self._history[side].append(PricePoint(timestamp or time.time(), price, side))
        def get_current_price(self, side):
            if side in self._history and self._history[side]:
                return self._history[side][-1].price
            return 0.0
        def detect_flash_crash(self, side=None):
            now = time.time()
            for s in ([side] if side else ["up", "down"]):
                if s not in self._history or len(self._history[s]) < 2:
                    continue
                current = self._history[s][-1].price
                old = None
                for p in self._history[s]:
                    if now - p.timestamp <= self.lookback_seconds:
                        old = p.price
                        break
                if old is None:
                    continue
                drop = old - current
                if drop >= self.drop_threshold:
                    return FlashCrashEvent(s, old, current, drop, now)
            return None
        def clear(self):
            for s in self._history:
                self._history[s].clear()

    # Inline PositionManager
    @dataclass
    class Position:
        id: str
        side: str
        token_id: str
        entry_price: float
        size: float
        entry_time: float
        take_profit_delta: float = 0.10
        stop_loss_delta: float = 0.05
        @property
        def take_profit_price(self):
            return self.entry_price + self.take_profit_delta
        @property
        def stop_loss_price(self):
            return self.entry_price - self.stop_loss_delta
        def get_pnl(self, current_price):
            return (current_price - self.entry_price) * self.size

    @dataclass
    class PositionManager:
        take_profit: float = 0.10
        stop_loss: float = 0.05
        max_positions: int = 1
        _positions: Dict[str, Position] = field(default_factory=dict)
        trades_opened: int = 0
        trades_closed: int = 0
        total_pnl: float = 0.0
        winning_trades: int = 0
        losing_trades: int = 0
        def __post_init__(self):
            self._positions = {}
        @property
        def can_open_position(self):
            return len(self._positions) < self.max_positions
        @property
        def win_rate(self):
            t = self.winning_trades + self.losing_trades
            return self.winning_trades / t * 100 if t > 0 else 0
        def open_position(self, side, token_id, entry_price, size):
            if not self.can_open_position:
                return None
            pid = f"{side}-{int(time.time())}"
            pos = Position(pid, side, token_id, entry_price, size, time.time(),
                           self.take_profit, self.stop_loss)
            self._positions[pid] = pos
            self.trades_opened += 1
            return pos
        def close_position(self, pid, realized_pnl=0.0):
            pos = self._positions.pop(pid, None)
            if not pos:
                return None
            self.trades_closed += 1
            self.total_pnl += realized_pnl
            if realized_pnl >= 0:
                self.winning_trades += 1
            else:
                self.losing_trades += 1
            return pos
        def get_all_positions(self):
            return list(self._positions.values())
        def get_stats(self):
            return {"opened": self.trades_opened, "closed": self.trades_closed,
                    "pnl": self.total_pnl, "wins": self.winning_trades,
                    "losses": self.losing_trades, "win_rate": self.win_rate}


# ---------------------------------------------------------------------------
# Orderbook Analysis (Step 2-3)
# ---------------------------------------------------------------------------

def check_market_viability(token_id: str) -> dict:
    """Check spread, liquidity, and generate recommendation."""
    book = _http_get(f"{CLOB_API}/book?token_id={token_id}")
    if not book:
        return {"viable": False, "reason": "Could not fetch orderbook"}

    bids = book.get("bids", [])
    asks = book.get("asks", [])

    if not bids or not asks:
        return {"viable": False, "reason": "Empty orderbook"}

    best_bid = float(bids[0]["price"])
    best_ask = float(asks[0]["price"])
    mid = (best_bid + best_ask) / 2
    spread = best_ask - best_bid
    spread_pct = spread / mid * 100 if mid > 0 else 100

    bid_liquidity = sum(float(b["size"]) * float(b["price"]) for b in bids[:5])
    ask_liquidity = sum(float(a["size"]) * float(a["price"]) for a in asks[:5])
    total_liquidity = bid_liquidity + ask_liquidity

    # Risk assessment
    if total_liquidity < 100:  # Very low for 15-min markets
        risk = "high"
        recommendation = "AVOID"
        confidence = 20
    elif spread_pct > 10:
        risk = "high"
        recommendation = "AVOID"
        confidence = 25
    elif spread_pct > 5:
        risk = "medium"
        recommendation = "HOLD"
        confidence = 45
    else:
        risk = "low"
        recommendation = "MONITOR"
        confidence = 70

    return {
        "viable": recommendation != "AVOID",
        "best_bid": best_bid,
        "best_ask": best_ask,
        "mid": mid,
        "spread": spread,
        "spread_pct": spread_pct,
        "bid_liquidity": bid_liquidity,
        "ask_liquidity": ask_liquidity,
        "total_liquidity": total_liquidity,
        "risk": risk,
        "recommendation": recommendation,
        "confidence": confidence,
    }


# ---------------------------------------------------------------------------
# Trade Logger (Step 7)
# ---------------------------------------------------------------------------

@dataclass
class TradeRecord:
    timestamp: str
    event: str  # "signal", "entry", "exit_tp", "exit_sl", "market_change"
    side: str
    price: float
    size: float
    pnl: float = 0.0
    details: str = ""


class TradeLogger:
    def __init__(self, log_path: str):
        self.log_path = Path(log_path)
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        self.records: List[TradeRecord] = []

    def log(self, record: TradeRecord):
        self.records.append(record)
        with open(self.log_path, "a") as f:
            f.write(json.dumps(asdict(record)) + "\n")

    def summary(self) -> dict:
        entries = [r for r in self.records if r.event == "entry"]
        exits = [r for r in self.records if r.event.startswith("exit")]
        signals = [r for r in self.records if r.event == "signal"]
        total_pnl = sum(r.pnl for r in exits)
        wins = sum(1 for r in exits if r.pnl >= 0)
        losses = sum(1 for r in exits if r.pnl < 0)
        return {
            "signals_detected": len(signals),
            "trades_entered": len(entries),
            "trades_exited": len(exits),
            "total_pnl": round(total_pnl, 4),
            "wins": wins,
            "losses": losses,
            "win_rate": round(wins / (wins + losses) * 100, 1) if (wins + losses) > 0 else 0,
        }


# ---------------------------------------------------------------------------
# Main Pipeline
# ---------------------------------------------------------------------------

async def run_pipeline(args):
    """Run the full paper trading pipeline."""

    coin = args.coin.upper()
    log_dir = os.path.expanduser(
        f"~/.remote/@autoresearch/skills/working-polymarket-flash-crash-detector"
    )
    logger = TradeLogger(os.path.join(log_dir, "paper_trades.jsonl"))

    log.info(f"{'='*60}")
    log.info(f"  Polymarket Paper Trader — {coin} 15-Minute Markets")
    log.info(f"{'='*60}")
    log.info(f"  Mode:       SIMULATED (no real orders)")
    log.info(f"  Coin:       {coin}")
    log.info(f"  Size:       ${args.size:.2f} per trade")
    log.info(f"  Drop:       {args.drop:.0%} in {args.lookback}s")
    log.info(f"  TP/SL:      +${args.take_profit:.2f} / -${args.stop_loss:.2f}")
    log.info(f"  Duration:   {args.duration} minutes")
    log.info(f"  Log:        {logger.log_path}")
    log.info(f"{'='*60}")

    # --- Step 1: Market Discovery ---
    log.info("[1/7] Discovering active 15-minute market...")
    gamma = GammaClient()
    market_info = gamma.get_market_info(coin) if HAS_TRADING_BOT else gamma.get_market_info(coin)

    if not market_info:
        log.error(f"No active 15-minute market found for {coin}. Try again later.")
        return

    token_ids = market_info["token_ids"]
    log.info(f"  Market:  {market_info['question']}")
    log.info(f"  Slug:    {market_info['slug']}")
    log.info(f"  Ends:    {market_info.get('end_date', 'unknown')}")
    log.info(f"  Tokens:  up={token_ids.get('up', 'N/A')[:16]}...")
    log.info(f"           down={token_ids.get('down', 'N/A')[:16]}...")
    log.info(f"  Prices:  {market_info.get('prices', {})}")

    # --- Step 2: Orderbook Check ---
    log.info("[2/7] Checking orderbook viability...")
    up_token = token_ids.get("up", "")
    if up_token:
        viability = check_market_viability(up_token)
        log.info(f"  Spread:      {viability.get('spread_pct', 0):.2f}%")
        log.info(f"  Liquidity:   ${viability.get('total_liquidity', 0):.2f}")
        log.info(f"  Risk:        {viability.get('risk', 'unknown')}")
        log.info(f"  Rec:         {viability.get('recommendation', 'N/A')} "
                 f"(confidence: {viability.get('confidence', 0)})")

        if not viability.get("viable", False):
            log.warning(f"  Market not viable: {viability.get('reason', viability.get('recommendation'))}")
            log.info("  Continuing to monitor anyway (paper mode)...")

    # --- Step 3: Market Analysis ---
    log.info("[3/7] Market analysis: monitoring for flash crash signals")

    # --- Step 4-6: WebSocket Monitor + Flash Crash Detection + Position Management ---
    tracker = PriceTracker(
        lookback_seconds=args.lookback,
        drop_threshold=args.drop,
    )
    positions = PositionManager(
        take_profit=args.take_profit,
        stop_loss=args.stop_loss,
        max_positions=1,
    )

    if not HAS_WEBSOCKETS:
        log.error("websockets package not installed. Install with: pip install websockets")
        log.info("Falling back to polling mode...")
        await _run_polling_loop(args, gamma, coin, tracker, positions, logger)
        return

    log.info("[4/7] Connecting to WebSocket for real-time prices...")

    all_tokens = [v for v in token_ids.values() if v]
    if not all_tokens:
        log.error("No token IDs found for subscription")
        return

    end_time = time.time() + (args.duration * 60)
    market_refresh_interval = 30
    last_market_refresh = time.time()
    tick_count = 0

    try:
        ws_connect = websockets.connect if hasattr(websockets, 'connect') else None
        if ws_connect is None:
            from websockets.asyncio.client import connect as ws_connect

        async with ws_connect(WSS_MARKET) as ws:
            # Subscribe
            subscribe_msg = json.dumps({
                "assets_ids": all_tokens,
                "type": "market",
            })
            await ws.send(subscribe_msg)
            log.info(f"  Subscribed to {len(all_tokens)} tokens")

            # Heartbeat task
            async def heartbeat():
                while True:
                    try:
                        await ws.send("PING")
                        await asyncio.sleep(10)
                    except Exception:
                        break

            hb_task = asyncio.create_task(heartbeat())
            log.info("[5/7] Flash crash detector active")
            log.info("[6/7] Position manager ready (TP/SL monitoring)")
            log.info(f"  Monitoring until {datetime.fromtimestamp(end_time).strftime('%H:%M:%S')}...")
            log.info("")

            try:
                while time.time() < end_time:
                    try:
                        raw = await asyncio.wait_for(ws.recv(), timeout=1.0)
                    except asyncio.TimeoutError:
                        # Check TP/SL on timeout too
                        _check_exits(tracker, positions, logger, token_ids)
                        continue

                    if raw == "PONG":
                        continue

                    try:
                        msg = json.loads(raw)
                    except json.JSONDecodeError:
                        continue

                    event_type = msg.get("event_type")

                    if event_type == "book":
                        # Parse orderbook snapshot
                        asset_id = msg.get("asset_id", "")
                        bids = msg.get("bids", [])
                        asks = msg.get("asks", [])

                        if bids and asks:
                            best_bid = float(bids[0]["price"])
                            best_ask = float(asks[0]["price"])
                            mid = (best_bid + best_ask) / 2

                            # Map asset_id to side
                            side = None
                            for s, tid in token_ids.items():
                                if tid == asset_id:
                                    side = s
                                    break

                            if side and mid > 0:
                                tracker.record(side, mid)
                                tick_count += 1

                                if tick_count % 50 == 0:
                                    up_p = tracker.get_current_price("up")
                                    dn_p = tracker.get_current_price("down")
                                    pos_str = f"  Positions: {len(positions.get_all_positions())}" if positions.get_all_positions() else ""
                                    log.info(
                                        f"  tick#{tick_count} up={up_p:.4f} down={dn_p:.4f}"
                                        f"  signals={positions.trades_opened}"
                                        f"  pnl=${positions.total_pnl:.4f}{pos_str}"
                                    )

                    elif event_type == "price_change":
                        # Could also track from price_change events
                        pass

                    # --- Flash crash detection ---
                    crash = tracker.detect_flash_crash()
                    if crash and positions.can_open_position:
                        log.info(f"  *** FLASH CRASH DETECTED on {crash.side} ***")
                        log.info(f"      {crash.old_price:.4f} → {crash.new_price:.4f} "
                                 f"(drop: {crash.drop:.4f}, {crash.drop_percent:.1f}%)")

                        logger.log(TradeRecord(
                            timestamp=datetime.now().isoformat(),
                            event="signal",
                            side=crash.side,
                            price=crash.new_price,
                            size=0,
                            details=f"drop={crash.drop:.4f} ({crash.drop_percent:.1f}%)",
                        ))

                        # Simulate entry
                        entry_price = crash.new_price
                        trade_size = args.size / entry_price if entry_price > 0 else 0
                        tid = token_ids.get(crash.side, "")

                        pos = positions.open_position(crash.side, tid, entry_price, trade_size)
                        if pos:
                            log.info(f"  [PAPER] BUY {crash.side} {trade_size:.1f} shares @ "
                                     f"${entry_price:.4f} (${args.size:.2f})")
                            log.info(f"  [PAPER] TP: ${pos.take_profit_price:.4f}  "
                                     f"SL: ${pos.stop_loss_price:.4f}")

                            logger.log(TradeRecord(
                                timestamp=datetime.now().isoformat(),
                                event="entry",
                                side=crash.side,
                                price=entry_price,
                                size=trade_size,
                                details=f"tp={pos.take_profit_price:.4f} sl={pos.stop_loss_price:.4f}",
                            ))

                    # --- TP/SL check ---
                    _check_exits(tracker, positions, logger, token_ids)

                    # --- Market refresh ---
                    if time.time() - last_market_refresh > market_refresh_interval:
                        new_info = gamma.get_market_info(coin) if HAS_TRADING_BOT else gamma.get_market_info(coin)
                        if new_info and new_info["slug"] != market_info["slug"]:
                            log.info(f"  Market changed: {market_info['slug']} → {new_info['slug']}")
                            market_info = new_info
                            token_ids = new_info["token_ids"]
                            tracker.clear()

                            # Resubscribe
                            new_tokens = [v for v in token_ids.values() if v]
                            await ws.send(json.dumps({
                                "assets_ids": new_tokens,
                                "type": "market",
                            }))

                            logger.log(TradeRecord(
                                timestamp=datetime.now().isoformat(),
                                event="market_change",
                                side="",
                                price=0,
                                size=0,
                                details=f"new_slug={new_info['slug']}",
                            ))
                        last_market_refresh = time.time()

            finally:
                hb_task.cancel()
                try:
                    await hb_task
                except asyncio.CancelledError:
                    pass

    except Exception as e:
        log.error(f"WebSocket error: {e}")
        if args.duration > 0:
            log.info("Falling back to polling mode...")
            await _run_polling_loop(args, gamma, coin, tracker, positions, logger)
            return

    # --- Step 7: Final Report ---
    _print_summary(positions, logger)


def _check_exits(tracker, positions, logger, token_ids):
    """Check all positions for TP/SL exits."""
    for pos in list(positions.get_all_positions()):
        current = tracker.get_current_price(pos.side)
        if current <= 0:
            continue

        pnl = pos.get_pnl(current)

        if current >= pos.take_profit_price:
            positions.close_position(pos.id, pnl)
            log.info(f"  [PAPER] TAKE PROFIT on {pos.side}: "
                     f"${pos.entry_price:.4f} → ${current:.4f}  "
                     f"P&L: ${pnl:.4f}")
            logger.log(TradeRecord(
                timestamp=datetime.now().isoformat(),
                event="exit_tp",
                side=pos.side,
                price=current,
                size=pos.size,
                pnl=pnl,
            ))
        elif current <= pos.stop_loss_price:
            positions.close_position(pos.id, pnl)
            log.info(f"  [PAPER] STOP LOSS on {pos.side}: "
                     f"${pos.entry_price:.4f} → ${current:.4f}  "
                     f"P&L: ${pnl:.4f}")
            logger.log(TradeRecord(
                timestamp=datetime.now().isoformat(),
                event="exit_sl",
                side=pos.side,
                price=current,
                size=pos.size,
                pnl=pnl,
            ))


async def _run_polling_loop(args, gamma, coin, tracker, positions, logger):
    """Fallback: poll prices via REST instead of WebSocket."""
    log.info("Running in polling mode (1s interval)...")
    end_time = time.time() + (args.duration * 60)
    tick = 0

    while time.time() < end_time:
        info = gamma.get_market_info(coin) if HAS_TRADING_BOT else gamma.get_market_info(coin)
        if info and info.get("prices"):
            for side, price in info["prices"].items():
                tracker.record(side, price)

            tick += 1
            if tick % 10 == 0:
                up_p = tracker.get_current_price("up")
                dn_p = tracker.get_current_price("down")
                log.info(f"  poll#{tick} up={up_p:.4f} down={dn_p:.4f}")

            crash = tracker.detect_flash_crash()
            if crash and positions.can_open_position:
                log.info(f"  *** FLASH CRASH on {crash.side}: {crash.old_price:.4f} → {crash.new_price:.4f} ***")
                entry_price = crash.new_price
                trade_size = args.size / entry_price if entry_price > 0 else 0
                pos = positions.open_position(crash.side, "", entry_price, trade_size)
                if pos:
                    log.info(f"  [PAPER] BUY {crash.side} @ ${entry_price:.4f}")
                    logger.log(TradeRecord(
                        timestamp=datetime.now().isoformat(), event="entry",
                        side=crash.side, price=entry_price, size=trade_size,
                    ))

            _check_exits(tracker, positions, logger, info.get("token_ids", {}))

        await asyncio.sleep(1)

    _print_summary(positions, logger)


def _print_summary(positions, logger):
    """Print final trading summary."""
    stats = positions.get_stats()
    summary = logger.summary()

    log.info("")
    log.info(f"{'='*60}")
    log.info(f"  Paper Trading Summary")
    log.info(f"{'='*60}")
    log.info(f"  Signals detected:  {summary['signals_detected']}")
    log.info(f"  Trades entered:    {summary['trades_entered']}")
    log.info(f"  Trades exited:     {summary['trades_exited']}")
    log.info(f"  Wins:              {summary['wins']}")
    log.info(f"  Losses:            {summary['losses']}")
    log.info(f"  Win rate:          {summary['win_rate']:.1f}%")
    log.info(f"  Total P&L:         ${summary['total_pnl']:.4f}")
    log.info(f"  Open positions:    {len(positions.get_all_positions())}")
    log.info(f"{'='*60}")
    log.info(f"  Trade log: {logger.log_path}")

    # Save summary
    summary_path = logger.log_path.parent / "paper_summary.json"
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)
    log.info(f"  Summary:   {summary_path}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Polymarket Paper Trading Pipeline — Simulated Flash Crash Strategy"
    )
    parser.add_argument("--coin", default="ETH", choices=["BTC", "ETH", "SOL", "XRP"],
                        help="Coin to trade (default: ETH)")
    parser.add_argument("--size", type=float, default=10.0,
                        help="Trade size in USDC (default: 10.0)")
    parser.add_argument("--drop", type=float, default=0.30,
                        help="Drop threshold (default: 0.30)")
    parser.add_argument("--lookback", type=int, default=10,
                        help="Lookback window in seconds (default: 10)")
    parser.add_argument("--take-profit", type=float, default=0.10,
                        help="Take profit delta (default: 0.10)")
    parser.add_argument("--stop-loss", type=float, default=0.05,
                        help="Stop loss delta (default: 0.05)")
    parser.add_argument("--duration", type=int, default=60,
                        help="Duration in minutes (default: 60)")
    parser.add_argument("--debug", action="store_true",
                        help="Enable debug logging")

    args = parser.parse_args()

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    try:
        asyncio.run(run_pipeline(args))
    except KeyboardInterrupt:
        log.info("\nInterrupted by user")


if __name__ == "__main__":
    main()
