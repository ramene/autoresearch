#!/usr/bin/env python3
"""
Autoresearch Runner — Python CLI wrapper

Delegates to the Node.js autoresearch-runner.mjs with all flags.
Use this if you prefer Python CLI or want to integrate with Python tooling.

Usage:
    python3 skills/autoresearch-runner.py --skill deep-plan-v2 --continuous --dashboard-sync
    python3 skills/autoresearch-runner.py --skill my-skill --evaluator gemini-2.5-flash --mutator claude-3-haiku-20240307 --rounds 5 --tui
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
RUNNER_PATH = SCRIPT_DIR / "autoresearch-runner.mjs"


def main():
    parser = argparse.ArgumentParser(
        description="Autoresearch: Autonomous skill improvement via cross-model evaluation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --skill deep-plan-v2 --continuous --dashboard-sync
  %(prog)s --skill my-skill --rounds 5 --tui
  %(prog)s --skill scaffold --evaluator gemini-2.5-flash --mutator claude-3-haiku-20240307
        """,
    )
    parser.add_argument("--skill", default="system-self-correction-v2", help="Skill name to optimize")
    parser.add_argument("--rounds", type=int, default=1, help="Number of rounds to run")
    parser.add_argument("--continuous", action="store_true", help="Run until target or stuck")
    parser.add_argument("--dashboard-sync", action="store_true", help="Sync results to dashboard JSON")
    parser.add_argument("--tui", action="store_true", help="Show terminal dashboard")
    parser.add_argument("--evaluator", default="gemini-2.5-pro", help="Gemini model for evaluation")
    parser.add_argument("--mutator", default="claude-3-haiku-20240307", help="Claude model for mutations")
    parser.add_argument("--target", type=int, default=60, help="Target score to reach (out of 60)")

    args = parser.parse_args()

    cmd = ["node", str(RUNNER_PATH)]
    cmd.extend(["--skill", args.skill])
    cmd.extend(["--rounds", str(args.rounds)])
    cmd.extend(["--evaluator", args.evaluator])
    cmd.extend(["--mutator", args.mutator])
    cmd.extend(["--target", str(args.target)])
    if args.continuous:
        cmd.append("--continuous")
    if args.dashboard_sync:
        cmd.append("--dashboard-sync")
    if args.tui:
        cmd.append("--tui")

    # Pass through API keys from environment
    env = os.environ.copy()

    try:
        result = subprocess.run(cmd, env=env, cwd=str(SCRIPT_DIR.parent))
        sys.exit(result.returncode)
    except KeyboardInterrupt:
        print("\nInterrupted by user")
        sys.exit(0)
    except FileNotFoundError:
        print("Error: Node.js not found. Install Node.js 20+ to run the autoresearch engine.")
        sys.exit(1)


if __name__ == "__main__":
    main()
