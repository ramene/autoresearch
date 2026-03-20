# SKILL: defi-arbitrage-executor
Scans cross-DEX price discrepancies on BASE chain, calculates profitability, and optionally executes budget-gated swaps.

## Purpose
This skill addresses `want-018`, which highlights a major capability gap: the system has access to over 100 powerful financial data tools but possesses zero skills to act on this data. This skill is the first step in transforming the agent from a passive data observer into an active, value-generating participant in the DeFi ecosystem. By identifying and executing profitable arbitrage opportunities, it directly proves the hypothesis that activating the `defi-tools:defi_trading` domain can unlock significant new capabilities.

## Trigger Conditions
This skill should be activated under the following conditions:

1.  **Slash Command:** The primary trigger is a direct command from the user.
    *   ` /skill defi-arbitrage-executor [flags]`
    *   **Flags:**
        *   `--scan`: (Required) Initiates the scanning process.
        *   `--chain=<mainnet|sepolia>`: (Optional, default: `mainnet`) Specifies which BASE chain to operate on. `mainnet` uses the production BASE network, `sepolia` uses the test network.
        *   `--budget=<amount>`: (Optional, default: `0`) The maximum amount of the source asset (in USD value equivalent) to use for a single arbitrage trade.
        *   `--execute=<true|false>`: (Optional, default: `false`) If `true`, the skill will attempt to execute the most profitable trade that fits within the specified budget.
        *   `--slippage=<bps>`: (Optional, default: `50`) Maximum acceptable slippage in basis points (1 bps = 0.01%). The executor script uses this to compute `amountOutMinimum` for each swap: `amountOutMinimum = quotedAmount * (10000 - slippage) / 10000`. If the swap cannot fill at or above this minimum, the transaction reverts on-chain rather than executing at a loss. Recommended range: 10–200 bps. Values above 500 bps are rejected with an error.

2.  **Keywords:** The agent should recognize natural language requests and translate them into the slash command.
    *   "scan for arbitrage on BASE"
    *   "find profitable trades between uniswap and aerodrome"
    *   "execute a small arbitrage trade on base testnet"
    *   "are there any dex arbitrage opportunities right now?"

## Prerequisites
Before execution, the agent must verify the following conditions are met:

1.  **Working Directory:** The skill's working directory exists at `~/.remote/@autoresearch/skills/working-defi-arbitrage-executor/`.
2.  **Configuration File:** A valid configuration file named `config.json` must exist in the working directory. Use `Read` to check its contents. It must contain:
    ```json
    {
      "rpc_url_base_mainnet": "https://mainnet.base.org",
      "rpc_url_base_sepolia": "https://sepolia.base.org",
      "private_key": "0x...",
      "monitored_pairs": [
        {
          "name": "WETH/USDC",
          "token0_address": "0x4200000000000000000000000000000000000006",
          "token1_address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
        }
      ],
      "dexes": [
        {
          "name": "UniswapV3",
          "router_address": "0x2626664c2603336E57B271c5C0b26F421741e481",
          "quoter_address": "0x3d4e44Eb1374240CE5F1B136041212501e4a036"
        },
        {
          "name": "Aerodrome",
          "router_address": "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
          "quoter_address": "0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0"
        }
      ]
    }
    ```
    > **Note on DEX contract addresses:** V3-style DEXes (including UniswapV3 and Aerodrome) use **two separate contracts**: a `router_address` for executing swaps, and a `quoter_address` for simulating price quotes off-chain without gas. The scanner script **must use the quoter contract** (`quoteExactInputSingle`) to fetch prices — calling `getAmountsOut` on a V3 router will revert because that method does not exist on V3 routers. The executor script uses the `router_address` for actual swap transactions. Both addresses are required in `config.json`.

3.  **Environment:** The `Bash` tool must have access to `node` and `npm`.
4.  **Dependencies:** The `ethers` npm package must be installed in the working directory. Check for a `node_modules/ethers` directory. If it doesn't exist, run `npm install ethers`.

## Execution Steps

1.  **Initialization:**
    *   Parse the trigger command to determine the target `chain`, `budget`, `execute` mode, and `slippage` (default `50` bps).
    *   Validate `slippage`: if the value is not a positive integer or exceeds `500`, terminate immediately with: `"Error: --slippage must be between 1 and 500 basis points."`.
    *   Use `Read` to load `config.json` from the working directory.
    *   Validate the config. If any required keys are missing (including `quoter_address` for each DEX), terminate with an error.
    *   Select the appropriate RPC URL from the config based on the `--chain` flag.

2.  **Create Scanner Script:**
    *   Use the `Write` tool to create a Javascript file named `scanner.js` in the working directory.
    *   This script will use the `ethers` library to perform all on-chain read operations.
    *   The script should accept the RPC URL, token pairs, and DEX configurations as command-line arguments.
    *   The script's logic will:
        *   a. Connect to the specified RPC provider.
        *   b. For each token pair in `monitored_pairs`, query each DEX's **quoter contract** (using `quoter_address` from config, not `router_address`) to get the price for a standard amount (e.g., simulating a swap of 1 Token0 for Token1 using `quoteExactInputSingle`). Each individual DEX price query **must be wrapped in a try/catch**. If the query fails, emit an error field for that entry rather than throwing.
        *   c. Output a JSON array to `stdout`, with each object representing a DEX and its current price for a given pair. Successful entries use: `{"pair": "WETH/USDC", "dex": "UniswapV3", "price": 3000.50}`. Failed entries use: `{"pair": "WETH/USDC", "dex": "UniswapV3", "price": null, "error": "<reason>"}`.
        *   d. The script must always exit with code `0` and always emit valid JSON to `stdout`, even if every DEX query failed. All diagnostic messages go to `stderr`, never `stdout`.

3.  **Fetch On-Chain Prices:**
    *   Use the `Bash` tool to execute the script: `node scanner.js --rpc_url <URL> --pairs <JSON_STRING> --dexes <JSON_STRING>`.
    *   Capture the JSON output from `stdout`.
    *   **Parse and triage the results:**
        *   Separate entries with `"price": null` (failed) from entries with a valid numeric price (succeeded).
        *   For every failed entry, print a warning to the console: `"⚠️ Could not fetch price from <DEX> for <PAIR>: <reason>. Excluding from analysis."`
        *   **Do not use any entry with `"price": null` in subsequent profitability calculations.** A pair where fewer than 2 DEXes returned valid prices cannot form an arbitrage opportunity and must be skipped entirely.
        *   If all DEXes for every pair failed, terminate with: `"Scan aborted: no DEX prices could be fetched. Check RPC connectivity."` and exit non-zero.

4.  **Identify Opportunities & Calculate Profitability:**
    *   Parse the valid (non-null) price entries from the previous step.
    *   For each token pair, compare the prices across all DEXes with valid prices.
    *   An opportunity exists if `Price_DEX_A` is different from `Price_DEX_B`.
    *   For each opportunity (e.g., Buy WETH on Uniswap, Sell on Aerodrome):
        *   a. Calculate the potential gross profit for a trade size up to the `--budget`.
        *   b. **Account for Slippage:** The quoted output for each swap leg must be reduced by the slippage factor: `effective_output = quoted_output * (10000 - slippage_bps) / 10000`. Use these slippage-adjusted amounts when computing gross profit to reflect the worst-case fill the executor will accept.
        *   c. **Estimate Gas Costs:** Use `ethers` via a small `Bash` command (`node -e "..."`) to call `provider.getFeeData()` to get current gas price information (`maxFeePerGas`, `maxPriorityFeePerGas`). Estimate the total gas cost for all four on-chain transactions that execution requires: two ERC-20 `approve` calls (~50,000 gas units each) and two `swap` calls (~200,000 gas units each). `total_gas_cost = maxFeePerGas * 500000` (i.e., 2 × 50k approvals + 2 × 200k swaps). This full accounting prevents the skill from recommending trades whose gross profit cannot cover the complete transaction overhead.
        *   d. **Calculate Net Profit:** `net_profit = gross_profit - total_gas_cost`.
        *   e. Discard any opportunity where `net_profit <= 0`.

5.  **Summarize and Report:**
    *   Generate a clear, human-readable summary of all profitable opportunities.
    *   Format the summary as a markdown table and print it to the console.
    *   Use the `Write` tool to save the detailed opportunities data (including net profit calculations and the slippage bps used) to `opportunities.json`.
    *   **If `--execute=false`, the skill's work is complete. Terminate successfully.**

6.  **Pre-Execution Checks (if `--execute=true`):**
    *   If no profitable opportunities were found, print a message and terminate.
    *   Select the single *most profitable* opportunity from `opportunities.json`.
    *   Verify that the required input amount for the trade is less than or equal to the `--budget`. If not, log that the best opportunity exceeds the budget and terminate.
    *   Use `ethers` to check the wallet's native token balance (ETH on BASE). If the balance is insufficient to cover the estimated gas cost, abort with a clear error message.

7.  **Create Executor Script:**
    *   Use the `Write` tool to create `executor.js`.
    *   This script will take the private key, the full details of the chosen trade (buy DEX, sell DEX, tokens, amounts), and the `--slippage` value as arguments.
    *   The script uses the `router_address` for each DEX (not `quoter_address`) to send actual swap transactions.
    *   The script's logic will:
        *   a. Initialize an `ethers.Wallet` instance with the private key and connect it to the provider.
        *   b. **Compute `amountOutMinimum`:** For each swap leg, derive the minimum acceptable output from the quoted amount and slippage: `amountOutMinimum = BigInt(quotedAmount) * BigInt(10000 - slippage_bps) / 10000n`. Pass this value in the swap calldata so the router reverts on-chain if the price has moved beyond the tolerance.
        *   c. **Check Allowance (Token A):** Before issuing an `approve` transaction for the first swap, call the input token's `allowance(walletAddress, dex1RouterAddress)` function on-chain to retrieve the current approved amount.
            - If `current_allowance >= amount_to_swap`, log `"Sufficient allowance already exists for Token A on DEX 1. Skipping approval."` and proceed directly to the swap without sending an `approve` transaction.
            - If `current_allowance < amount_to_swap`, proceed to the next step.
        *   d. **Approve Token A (Conditional):** Only if the allowance check in step (c) determined the current allowance is insufficient, generate and send an `approve` transaction to the DEX 1 router for the input token. Wait for the transaction to be mined before continuing.
        *   e. **Execute Swap 1 (Buy):** Construct and send the swap transaction on the lower-priced DEX, including the computed `amountOutMinimum`. Wait for the receipt. If this transaction fails (reverts), the script must exit with a non-zero code and log the error. **Do not attempt Swap 2 if Swap 1 fails.**
        *   f. **Check Allowance (Token B):** Before issuing an `approve` transaction for the second swap, call the token received from Swap 1's `allowance(walletAddress, dex2RouterAddress)` function on-chain to retrieve the current approved amount.
            - If `current_allowance >= amount_received_from_swap1`, log `"Sufficient allowance already exists for Token B on DEX 2. Skipping approval."` and proceed directly to the swap without sending an `approve` transaction.
            - If `current_allowance < amount_received_from_swap1`, proceed to the next step.
        *   g. **Approve Token B (Conditional):** Only if the allowance check in step (f) determined the current allowance is insufficient, generate and send an `approve` transaction to the DEX 2 router for the token received in Swap 1. Wait for the transaction to be mined before continuing.
        *   h. **Execute Swap 2 (Sell):** Construct and send the swap transaction on the higher-priced DEX, including the computed `amountOutMinimum` for the second leg. Wait for the receipt.
        *   i. Log the transaction hashes of all successful transactions to `stdout`. For any `approve` transactions that were skipped due to sufficient existing allowance, note them as skipped in the log.

8.  **Execute Trade:**
    *   Use the `Bash` tool to run the executor script: `node executor.js --trade_details <JSON_STRING> --private_key <KEY> --slippage <BPS>`.
    *   Monitor the script's exit code.

9.  **Final Logging:**
    *   Based on the output and exit code of `executor.js`, create a final report in `execution_log.md`.
    *   The log must include:
        *   The opportunity that was executed.
        *   The slippage tolerance used (in bps).
        *   The status (SUCCESS or FAILED).
        *   Transaction hashes for all on-chain actions (approvals that were sent, swaps). Approvals that were skipped due to sufficient existing allowance should be noted as "skipped (sufficient allowance)" rather than omitted entirely.
        *   If failed, the reason for the failure (including whether it was a slippage revert).
        *   A final calculation of profit/loss based on the actual amounts from the transaction receipts.

## Output Format
*   **Console:** A markdown table summarizing profitable opportunities or a status message indicating the result of an execution attempt.
*   **`opportunities.json`:** A structured JSON file detailing all identified profitable arbitrage opportunities, including net profit calculations.
    ```json
    [
      {
        "pair": "WETH/USDC",
        "buy_dex": "UniswapV3",
        "sell_dex": "Aerodrome",
        "buy_price": 3000.50,
        "sell_price": 3001.75,
        "slippage_bps": 50,
        "potential_input_usd": 100,
        "gross_profit_usd": 0.41,
        "estimated_gas_usd": 0.35,
        "net_profit_usd": 0.06
      }
    ]
    ```
*   **`execution_log.md`:** A detailed log of any trade execution attempt.

## Quality Gates
Before marking the skill as complete, verify the following:
1.  **Discrepancy Identification:** The generated `opportunities.json` correctly identifies a known price difference between two configured DEXes.
2.  **Net Profit Calculation:** Every opportunity listed in the output includes a `net_profit` field that is demonstrably `gross_profit - estimated_gas` (with gross profit computed using slippage-adjusted amounts, and gas estimated across all four transactions: 2 approvals + 2 swaps).
3.  **Budget Enforcement:** If `--execute=true`, the `execution_log.md` must show that the executed trade's input amount was less than or equal to the `--budget` flag.
4.  **Graceful Failure:** In a simulated scenario where a transaction would fail (e.g., insufficient balance), the skill must log the error in `execution_log.md` and terminate without attempting the second leg of the trade.
5.  **Clear Summary:** The console output provides a clean, readable summary of findings that is easy for a user to understand.
6.  **Chain Agnostic:** The skill successfully runs and fetches data when both `--chain=mainnet` and `--chain=sepolia` are used, connecting to the correct RPC endpoint each time.
7.  **Partial DEX Failure Handling:** If one DEX's price query fails during scanning, the skill emits a warning for that DEX, excludes it from analysis, and continues processing the remaining DEXes — it does not abort or silently use a null/stale price in profit calculations.
8.  **Correct Contract Usage:** The scanner script calls `quoteExactInputSingle` on each DEX's `quoter_address`. The executor script sends swap transactions to each DEX's `router_address`. These two addresses must never be swapped; using the router address for quoting will cause all price queries to revert.
9.  **Slippage Enforcement:** The executor script passes a valid `amountOutMinimum` (derived from the quoted amount and `--slippage` bps) into every swap transaction. A slippage value above 500 bps must be rejected before any script is written or executed.
10. **Allowance Check Before Approve:** The executor script calls `allowance(owner, spender)` on each token contract before sending any `approve` transaction. If the existing allowance is already sufficient for the trade amount, the `approve` transaction is skipped entirely and this is logged. On two consecutive identical trades, at most two `approve` transactions should be sent in total (one per token on the first trade), not four.

## Integration Points
*   **Upstream:** This skill can be triggered by a future `market-volatility-monitor` skill, which could detect favorable conditions and automatically initiate a scan.
*   **Downstream:** The `execution_log.md` can be parsed by a `portfolio-tracker` skill to update the system's internal model of its wallet balances (`self-model.json`).
*   **Models:**
    *   **Reads:** `world-model.json` for potential token pairs or real-time gas price estimates.
    *   **Writes:** `self-model.json` could be updated with wallet balance changes after a successful trade.

## Error Handling
*   **RPC Errors:** If a connection to the RPC node fails, retry up to 3 times with a 5-second delay. If it still fails, terminate gracefully with an error message: "Failed to connect to RPC provider at [URL]".
*   **Configuration Errors:** If `config.json` is missing or invalid (including missing `quoter_address` for any DEX), exit immediately with a message specifying what is wrong (e.g., "Error: `quoter_address` not found for UniswapV3 in config.json").
*   **Transaction Reverts:** If the first swap transaction fails on-chain (including reverts caused by slippage exceeding `amountOutMinimum`), the `executor.js` script MUST NOT attempt the second swap. The skill must log the revert reason from the transaction receipt and terminate the execution flow. This is critical to prevent fund loss.
*   **Slippage Revert:** If a transaction reverts due to slippage, log: `"Swap reverted: price moved beyond slippage tolerance (<N> bps). No funds lost. Consider increasing --slippage or retrying."`.
*   **Invalid Slippage Flag:** If `--slippage` is not a positive integer or exceeds `500` bps, exit immediately before writing any scripts: `"Error: --slippage must be between 1 and 500 basis points."`.
*   **Insufficient Funds for Gas:** Before attempting any transaction, the skill must check the native token balance. If it's below a safety threshold (e.g., 0.005 ETH), abort execution with the message "Insufficient ETH for gas fees."
*   **Partial DEX Scan Failures:** Individual DEX price query failures are non-fatal. The scanner script must catch them per-entry, emit `"price": null` with an `"error"` field, and the agent must exclude those entries and warn the user. Only if no valid prices are returned at all should the scan abort.

## Examples

**Example 1: Scan-only on Mainnet**
*   **Command:** `/skill defi-arbitrage-executor --scan --chain=mainnet --budget=1000`
*   **Expected Output:**
    *   Console prints a markdown table of opportunities.
    ```
    | Pair      | Buy On      | Sell On   | Net Profit (for $1000 trade) |
    |-----------|-------------|-----------|------------------------------|
    | WETH/USDC | UniswapV3   | Aerodrome | $1.23                        |
    ```
    *   `opportunities.json` is created with detailed data.
    *   No transactions are sent.

**Example 2: Execute a small trade on Testnet**
*   **Command:** `/skill defi-arbitrage-executor --scan --chain=sepolia --budget=10 --execute=true`
*   **Expected Outcome:**
    *   The skill scans BASE Sepolia for opportunities.
    *   If a profitable trade requiring <= $10 input is found, it proceeds.
    *   Console prints: "Found profitable opportunity. Executing trade for WETH/USDC on Aerodrome -> UniswapV3..."
    *   `execution_log.md` is created containing the status (SUCCESS/FAIL), slippage tolerance used, and transaction hashes.
    *   Console prints final status: "Execution successful. Final profit: $0.02. See execution_log.md for details."

**Example 3: No opportunities found**
*   **Command:** `/skill defi-arbitrage-executor --scan --chain=mainnet`
*   **Expected Output:**
    *   Console prints: "Scan complete. No profitable arbitrage opportunities found after accounting for gas costs."
    *   `opportunities.json` is an empty array `[]`.
    *   The skill terminates successfully.

**Example 4: One DEX query fails during scan**
*   **Command:** `/skill defi-arbitrage-executor --scan --chain=mainnet --budget=500`
*   **Expected Output:**
    *   Console prints: `"⚠️ Could not fetch price from Aerodrome for WETH/USDC: call reverted. Excluding from analysis."`
    *   If UniswapV3 returned a valid price but Aerodrome did not, no arbitrage opportunity can be formed for that pair — `opportunities.json` is `[]`.
    *   The skill terminates successfully without crashing.

**Example 5: Slippage revert protection**
*   **Command:** `/skill defi-arbitrage-executor --scan --chain=mainnet --budget=500 --execute=true --slippage=10`
*   **Expected Output:**
    *   The executor script sets `amountOutMinimum` to 99.9% of the quoted output for each swap leg.
    *   If the market moves more than 0.1% between quote and execution, the swap reverts on-chain.
    *   `execution_log.md` logs: `"Swap reverted: price moved beyond slippage tolerance (10 bps). No funds lost."` and the skill terminates without attempting the second swap.

**Example 6: Allowance reuse on repeated trades**
*   **Command:** Two consecutive executions of `/skill defi-arbitrage-executor --scan --chain=mainnet --budget=100 --execute=true` for the same WETH/USDC pair.
*   **Expected Outcome:**
    *   First execution: both token allowances are checked, found insufficient, and two `approve` transactions are sent (one for Token A to DEX 1, one for Token B to DEX 2). Total: 2 approvals + 2 swaps = 4 transactions.
    *   Second execution: both token allowances are checked, found sufficient from the first run, and both `approve` transactions are skipped. `execution_log.md` notes "Sufficient allowance already exists. Skipping approval." for each token. Total: 0 approvals + 2 swaps = 2 transactions.
    *   Across both executions combined, exactly 2 `approve` transactions are sent, not 4.