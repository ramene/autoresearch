# SKILL: defi-arbitrage-executor
Scans cross-DEX price discrepancies on BASE chain, calculates profitability, and optionally executes budget-gated swaps. Supports both direct (single-hop) and multi-hop arbitrage routes.

## Purpose
This skill addresses `want-018`, which highlights a major capability gap: the system has access to over 100 powerful financial data tools but possesses zero skills to act on this data. This skill is the first step in transforming the agent from a passive data observer into an active, value-generating participant in the DeFi ecosystem. By identifying and executing profitable arbitrage opportunities — including complex multi-hop routes — it directly proves the hypothesis that activating the `defi-tools:defi_trading` domain can unlock significant new capabilities.

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
    *   "find multi-hop arbitrage routes on BASE"

## Prerequisites
Before execution, the agent must verify the following conditions are met:

1.  **Working Directory:** The skill's working directory exists at `~/.remote/@autoresearch/skills/working-defi-arbitrage-executor/`.
2.  **Configuration File:** A valid configuration file named `config.json` must exist in the working directory. Use `Read` to check its contents. It must contain:
    ```json
    {
      "rpc_url_base_mainnet": "https://mainnet.base.org",
      "rpc_url_base_sepolia": "https://sepolia.base.org",
      "private_key": "0x...",
      "monitored_routes": [
        {
          "name": "WETH/USDC",
          "path": ["0x4200000000000000000000000000000000000006", 500, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"]
        },
        {
          "name": "WETH/WBTC/USDC",
          "path": ["0x4200000000000000000000000000000000000006", 500, "0x1ceA84203673764244E05693e42E6Ace62bE9BA5", 3000, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"]
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

    > **Route path format:** Each entry in `monitored_routes` uses a `path` array with alternating token addresses and fee tiers:
    > - **Direct (single-hop):** 3 elements — `[tokenIn_address, fee_tier, tokenOut_address]`
    > - **Multi-hop:** 5+ elements — `[tokenIn_address, fee_tier, tokenMid_address, fee_tier, tokenOut_address]`
    >
    > The `path` array must have an odd number of elements ≥ 3, alternating between token addresses (strings) and fee tiers (integers). Token addresses are at even indices (0, 2, 4…); fee tiers are at odd indices (1, 3, 5…). If any `path` array has an even length, contains a zero or missing fee tier at an odd index, or contains fewer than 3 elements, the agent must terminate before writing any scripts with: `"Error: Invalid route path format for route '<name>'. Path must alternate [tokenAddr, feeTier, tokenAddr, ...] with an odd length ≥ 3."`.

    > **Note on DEX contract addresses:** V3-style DEXes (including UniswapV3 and Aerodrome) use **two separate contracts**: a `router_address` for executing swaps, and a `quoter_address` for simulating price quotes off-chain without gas. The scanner script **must use the quoter contract** to fetch prices. The executor script uses the `router_address` for actual swap transactions. Both addresses are required in `config.json`.

3.  **Environment:** The `Bash` tool must have access to `node` and `npm`.
4.  **Dependencies:** The `ethers` npm package must be installed in the working directory. Check for a `node_modules/ethers` directory. If it doesn't exist, run `npm install ethers`.

## Execution Steps

1.  **Initialization:**
    *   Parse the trigger command to determine the target `chain`, `budget`, `execute` mode, and `slippage` (default `50` bps).
    *   Validate `slippage`: if the value is not a positive integer or exceeds `500`, terminate immediately with: `"Error: --slippage must be between 1 and 500 basis points."`.
    *   Use `Read` to load `config.json` from the working directory.
    *   Validate the config:
        *   If `monitored_routes` is absent or empty, terminate with: `"Error: monitored_routes is required in config.json."`.
        *   For each route in `monitored_routes`, validate that `path` is an array with an odd length ≥ 3, that all even-indexed elements are non-empty strings (token addresses), and that all odd-indexed elements are positive integers (fee tiers). If any route fails validation, terminate with: `"Error: Invalid route path format for route '<name>'. Path must alternate [tokenAddr, feeTier, tokenAddr, ...] with an odd length ≥ 3."`.
        *   If any DEX entry is missing `quoter_address` or `router_address`, terminate with an error specifying which field is missing (e.g., `"Error: quoter_address not found for UniswapV3 in config.json"`).
    *   Select the appropriate RPC URL from the config based on the `--chain` flag.

2.  **Create Scanner Script:**
    *   Use the `Write` tool to create a Javascript file named `scanner.js` in the working directory.
    *   This script will use the `ethers` library to perform all on-chain read operations.
    *   The script should accept the RPC URL, routes, and DEX configurations as command-line arguments (replacing the old `--pairs` argument with `--routes`).
    *   The script's logic will:
        *   a. Connect to the specified RPC provider.
        *   b. **Fetch Token Decimals:** Before querying any DEX prices, collect all unique token addresses across all route paths (the even-indexed elements of every `path` array). Call `decimals()` on each unique token contract address using the standard ERC-20 ABI (`["function decimals() view returns (uint8)"]`). Cache the result (e.g., `{ "0x4200...0006": 18, "0x8335...913": 6 }`). If a `decimals()` call fails for any token, emit an error and skip all routes that include that token.
        *   c. **For each route in `monitored_routes`, query each DEX's quoter contract** to get the output amount for a standard input of 1 unit of the input token (the first address in `path`). The input amount must be constructed using the input token's fetched decimals: `ethers.parseUnits("1", inputToken_decimals)`. The quoting method depends on the route type:
            *   **Direct route (path length = 3):** Call `quoteExactInputSingle` on the DEX's `quoter_address`. Parameters: `{ tokenIn: path[0], tokenOut: path[2], fee: path[1], amountIn: parsedAmount, sqrtPriceLimitX96: 0 }`. The `fee` parameter (from `path[1]`) is required to identify the correct V3 pool.
            *   **Multi-hop route (path length ≥ 5):** Call `quoteExactInput` on the DEX's `quoter_address`. This function requires the path to be ABI-encoded as a `bytes` value. Construct the encoded path by concatenating the path elements: for each token address use `ethers.getBytes(ethers.zeroPadValue(addr, 20))` (20 bytes), and for each fee tier encode it as a 3-byte big-endian integer. The resulting `bytes` string encodes `tokenIn (20 bytes) | fee (3 bytes) | tokenMid (20 bytes) | fee (3 bytes) | tokenOut (20 bytes)`. Call `quoteExactInput(encodedPath, amountIn)` on the quoter. The ABI for `quoteExactInput` is: `["function quoteExactInput(bytes path, uint256 amountIn) returns (uint256 amountOut)"]`.
            *   Each individual DEX price query **must be wrapped in a try/catch**. If the query fails, emit an error field for that entry rather than throwing.
        *   d. **Normalize Prices:** Convert the raw `amountOut` BigInt returned by the quoter to a human-readable decimal price using `ethers.formatUnits(amountOut, outputToken_decimals)`, where `outputToken_decimals` are the decimals of the last token in the route's `path`. This normalized value is what must be stored in the output JSON and used for all subsequent price comparisons. **Never compare raw BigInt amounts across DEXes without first normalizing by output token decimals.**
        *   e. Output a JSON array to `stdout`, with each object representing a DEX and its current normalized price for a given route. Successful entries use: `{"route": "WETH/USDC", "route_type": "direct", "dex": "UniswapV3", "price": 3000.50, "path": [...]}`. Multi-hop entries include `"route_type": "multi-hop"`. Failed entries use: `{"route": "WETH/WBTC/USDC", "dex": "UniswapV3", "price": null, "path": [...], "error": "<reason>"}`.
        *   f. The script must always exit with code `0` and always emit valid JSON to `stdout`, even if every DEX query failed. All diagnostic messages go to `stderr`, never `stdout`.

3.  **Fetch On-Chain Prices:**
    *   Use the `Bash` tool to execute the script: `node scanner.js --rpc_url <URL> --routes <JSON_STRING> --dexes <JSON_STRING>`.
    *   Capture the JSON output from `stdout`.
    *   **Parse and triage the results:**
        *   Separate entries with `"price": null` (failed) from entries with a valid numeric price (succeeded).
        *   For every failed entry, print a warning to the console: `"⚠️ Could not fetch price from <DEX> for <ROUTE>: <reason>. Excluding from analysis."`
        *   **Do not use any entry with `"price": null` in subsequent profitability calculations.** A route where fewer than 2 DEXes returned valid prices cannot form an arbitrage opportunity and must be skipped entirely.
        *   If all DEXes for every route failed, terminate with: `"Scan aborted: no DEX prices could be fetched. Check RPC connectivity."` and exit non-zero.

4.  **Identify Opportunities & Calculate Profitability:**
    *   Parse the valid (non-null) price entries from the previous step. All prices at this stage are already decimal-normalized, so they can be compared directly as floating-point numbers.
    *   For each route, compare the prices across all DEXes with valid prices.
    *   An opportunity exists if `Price_DEX_A` is different from `Price_DEX_B`.
    *   **Fetch ETH Price for Gas USD Conversion:** Before computing gas costs, determine the current ETH price in USD. Use `node -e` with `ethers` to query the WETH/USDC direct price from any available DEX quoter (reusing the scanner's already-fetched prices if the route exists in scan results). If a WETH/USDC (or USDC/WETH) route was scanned and returned a valid price, use that normalized price directly as `eth_price_usd`. If no such route is available, fall back to a conservative default of `2000` USD/ETH and log a warning: `"⚠️ Could not determine live ETH price. Using fallback of $2000 for gas cost estimation. Results may be inaccurate."`. Store `eth_price_usd` for all subsequent gas calculations in this scan.
    *   For each opportunity (e.g., Buy on UniswapV3, Sell on Aerodrome for the same route):
        *   a. Calculate the potential gross profit for a trade size up to the `--budget`.
        *   b. **Account for Slippage:** The quoted output for each swap leg must be reduced by the slippage factor: `effective_output = quoted_output * (10000 - slippage_bps) / 10000`. Use these slippage-adjusted amounts when computing gross profit.
        *   c. **Estimate Gas Costs:** Use `ethers` via a small `Bash` command (`node -e "..."`) to call `provider.getFeeData()` to get current gas price information (`maxFeePerGas`). Estimate gas units based on route type:
            *   For **direct routes**: estimate 2 × 50,000 (approvals) + 2 × 200,000 (swaps) = 500,000 total gas units.
            *   For **multi-hop routes**: estimate 2 × 50,000 (approvals) + 2 × 300,000 (multi-hop swaps, higher due to additional pool hops) = 700,000 total gas units.
            *   `total_gas_cost_eth = maxFeePerGas * estimated_gas_units` (in wei, then converted to ETH by dividing by 1e18).
            *   `total_gas_cost_usd = total_gas_cost_eth * eth_price_usd` (using the ETH price fetched above).
        *   d. **Calculate Net Profit:** `net_profit_usd = gross_profit_usd - total_gas_cost_usd`.
        *   e. Discard any opportunity where `net_profit_usd <= 0`.

5.  **Summarize and Report:**
    *   Generate a clear, human-readable summary of all profitable opportunities.
    *   Format the summary as a markdown table and print it to the console. Include a `Route Type` column (Direct / Multi-hop).
    *   Use the `Write` tool to save the detailed opportunities data (including net profit calculations, slippage bps used, route type, full path, and the `eth_price_usd` used for gas estimation) to `opportunities.json`.
    *   **If `--execute=false`, the skill's work is complete. Terminate successfully.**

6.  **Pre-Execution Checks (if `--execute=true`):**
    *   If no profitable opportunities were found, print a message and terminate.
    *   Select the single *most profitable* opportunity from `opportunities.json`.
    *   Verify that the required input amount for the trade is less than or equal to the `--budget`. If not, log that the best opportunity exceeds the budget and terminate.
    *   Use `ethers` to check the wallet's native token balance (ETH on BASE). If the balance is insufficient to cover the estimated gas cost, abort with a clear error message.

7.  **Create Executor Script:**
    *   Use the `Write` tool to create `executor.js`.
    *   This script will take the private key, the full details of the chosen trade (buy DEX, sell DEX, route path array, amounts), and the `--slippage` value as arguments.
    *   The script uses the `router_address` for each DEX (not `quoter_address`) to send actual swap transactions.
    *   The script's execution logic adapts to the route type (direct vs. multi-hop):
        *   **Direct routes:** Use `exactInputSingle` on the router with the token addresses and fee tier from `path[0]`, `path[1]`, `path[2]`.
        *   **Multi-hop routes:** Construct the ABI-encoded bytes path (same encoding as in the scanner) and call `exactInput` on the router with `{ path: encodedPath, recipient, deadline, amountIn, amountOutMinimum }`.
    *   The script's logic will:
        *   a. Initialize an `ethers.Wallet` instance with the private key and connect it to the provider.
        *   b. **Compute `amountOutMinimum`:** For each swap leg, derive the minimum acceptable output from the quoted amount and slippage: `amountOutMinimum = BigInt(quotedAmount) * BigInt(10000 - slippage_bps) / 10000n`. All amount values passed to the router must remain in raw token units (BigInt).
        *   c. **Check Allowance (Token A):** Before issuing an `approve` transaction for the first swap, call `allowance(walletAddress, dex1RouterAddress)` on-chain.
            - If `current_allowance >= amount_to_swap`, log `"Sufficient allowance already exists for Token A on DEX 1. Skipping approval."` and proceed directly to the swap.
            - If `current_allowance < amount_to_swap`, proceed to the next step.
        *   d. **Approve Token A (Conditional):** Only if the allowance check determined the current allowance is insufficient, send an `approve` transaction. Wait for the transaction to be mined.
        *   e. **Execute Swap 1 (Buy):** Construct and send the swap transaction on the lower-priced DEX using `exactInputSingle` (direct) or `exactInput` (multi-hop) with the encoded path and `amountOutMinimum`. Wait for the receipt. If this transaction fails (reverts), exit with a non-zero code and log the error. **Do not attempt Swap 2 if Swap 1 fails.**
        *   f. **Parse Actual Output from Swap 1 Receipt:** After Swap 1 confirms, parse the transaction receipt logs to extract the actual amount of the output token received. Decode the ERC-20 `Transfer(address indexed from, address indexed to, uint256 value)` event emitted by the output token contract (the last token in the route's `path`) in Swap 1's receipt, filtering for transfers where `to == walletAddress`. Use this receipt-derived amount as the input for all Swap 2 calculations. Log both quoted and actual: `"Swap 1 complete. Quoted: <X>, Actual received: <Y> (raw units)."`. If no matching Transfer event is found, exit with: `"Error: Could not parse output token transfer from Swap 1 receipt. Aborting to prevent fund loss."` and do not attempt Swap 2.
        *   g. **Check Allowance (Output Token):** Before issuing an `approve` for Swap 2, call `allowance(walletAddress, dex2RouterAddress)` using the receipt-derived amount as the threshold.
            - If sufficient, log and skip the approval.
            - If insufficient, proceed to the next step.
        *   h. **Approve Output Token (Conditional):** Only if allowance is insufficient, send an `approve` transaction for the actual amount received. Wait for mining.
        *   i. **Execute Swap 2 (Sell):** Use the receipt-derived amount as `amountIn`. Compute a fresh `amountOutMinimum` from this actual input and `--slippage`. For multi-hop routes, construct the reverse-direction encoded path. Wait for the receipt.
        *   j. Log all transaction hashes, quoted vs. actual amounts for both legs, and whether any approvals were skipped.

8.  **Execute Trade:**
    *   Use the `Bash` tool to run the executor script: `node executor.js --trade_details <JSON_STRING> --private_key <KEY> --slippage <BPS>`.
    *   Monitor the script's exit code.

9.  **Final Logging:**
    *   Based on the output and exit code of `executor.js`, create a final report in `execution_log.md`.
    *   The log must include:
        *   The opportunity that was executed (route name and type: direct or multi-hop).
        *   The full route path (token addresses and fee tiers).
        *   The slippage tolerance used (in bps).
        *   The ETH price used for gas cost estimation (in USD).
        *   The status (SUCCESS or FAILED).
        *   Transaction hashes for all on-chain actions (approvals that were sent, swaps). Approvals skipped due to sufficient existing allowance noted as "skipped (sufficient allowance)".
        *   If failed, the reason for the failure.
        *   A final calculation of profit/loss based on the **actual amounts from the transaction receipts**.

## Output Format
*   **Console:** A markdown table summarizing profitable opportunities or a status message indicating the result of an execution attempt. The table includes a `Route Type` column (Direct / Multi-hop).
*   **`opportunities.json`:** A structured JSON file detailing all identified profitable arbitrage opportunities, including net profit calculations.
    ```json
    [
      {
        "route": "WETH/USDC",
        "route_type": "direct",
        "path": ["0x4200000000000000000000000000000000000006", 500, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"],
        "buy_dex": "UniswapV3",
        "sell_dex": "Aerodrome",
        "buy_price": 3000.50,
        "sell_price": 3001.75,
        "slippage_bps": 50,
        "eth_price_usd": 3000.50,
        "potential_input_usd": 100,
        "gross_profit_usd": 0.41,
        "estimated_gas_usd": 0.35,
        "net_profit_usd": 0.06
      },
      {
        "route": "WETH/WBTC/USDC",
        "route_type": "multi-hop",
        "path": ["0x4200000000000000000000000000000000000006", 500, "0x1ceA84203673764244E05693e42E6Ace62bE9BA5", 3000, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"],
        "buy_dex": "UniswapV3",
        "sell_dex": "Aerodrome",
        "buy_price": 3002.10,
        "sell_price": 3005.80,
        "slippage_bps": 50,
        "eth_price_usd": 3000.50,
        "potential_input_usd": 100,
        "gross_profit_usd": 1.23,
        "estimated_gas_usd": 0.70,
        "net_profit_usd": 0.53
      }
    ]
    ```
*   **`execution_log.md`:** A detailed log of any trade execution attempt.

## Quality Gates
Before marking the skill as complete, verify the following:
1.  **Discrepancy Identification:** The generated `opportunities.json` correctly identifies price differences between two configured DEXes for both direct and multi-hop routes.
2.  **Net Profit Calculation:** Every opportunity listed includes a `net_profit_usd` field that is demonstrably `gross_profit_usd - estimated_gas_usd`, with gas estimated correctly for the route type (500k gas for direct, 700k for multi-hop) and converted to USD using a live or fallback ETH price.
3.  **ETH Price for Gas:** The `opportunities.json` includes an `eth_price_usd` field showing what ETH price was used for gas cost conversion. If the live price could not be determined, the fallback value (`2000`) is used and a warning is logged to console.
4.  **Budget Enforcement:** If `--execute=true`, the `execution_log.md` must show that the executed trade's input amount was ≤ the `--budget` flag.
5.  **Graceful Failure:** In a simulated scenario where a transaction would fail, the skill must log the error in `execution_log.md` and terminate without attempting the second leg.
6.  **Clear Summary:** The console output provides a clean, readable summary with a `Route Type` column distinguishing direct from multi-hop routes.
7.  **Chain Agnostic:** The skill successfully runs when both `--chain=mainnet` and `--chain=sepolia` are used.
8.  **Partial DEX Failure Handling:** If one DEX's price query fails during scanning, the skill emits a warning, excludes it from analysis, and continues processing the remaining DEXes.
9.  **Correct Contract Usage:** The scanner script calls the appropriate quoter function (`quoteExactInputSingle` for direct, `quoteExactInput` for multi-hop) on each DEX's `quoter_address`. The executor script sends swap transactions to `router_address`.
10. **Slippage Enforcement:** The executor script passes a valid `amountOutMinimum` into every swap transaction. A slippage value above 500 bps is rejected before any script is written or executed.
11. **Allowance Check Before Approve:** The executor script calls `allowance(owner, spender)` on each token contract before sending any `approve` transaction. If the existing allowance is already sufficient, the `approve` transaction is skipped and logged.
12. **Route Path Validation:** Every entry in `monitored_routes` must have a valid `path` array with odd length ≥ 3, alternating token addresses (even indices) and positive integer fee tiers (odd indices). Invalid paths cause immediate termination before any scripts are written.
13. **Token Decimal Normalization:** The scanner calls `decimals()` on each unique token in all route paths before computing any prices. Raw `amountOut` BigInts are normalized via `ethers.formatUnits(amountOut, outputToken_decimals)`. Price comparisons never operate on unnormalized raw values. If `decimals()` cannot be fetched, all routes containing that token are skipped with a warning.
14. **Multi-Hop Path Encoding:** For routes with `path.length ≥ 5`, the scanner constructs and passes a correctly ABI-encoded `bytes` path to `quoteExactInput`. The encoding must interleave 20-byte token addresses and 3-byte fee tier values in order. The executor must construct the equivalent encoded path for `exactInput` router calls.
15. **Receipt-Based Amount Chaining:** After Swap 1 confirms, the executor parses the actual output token amount from receipt Transfer events before proceeding to Swap 2. The receipt-derived amount is used for the Swap 2 allowance check, conditional approval, and `amountIn`. If no matching Transfer event is found, the executor aborts without attempting Swap 2.

## Integration Points
*   **Upstream:** This skill can be triggered by a future `market-volatility-monitor` skill, which could detect favorable conditions and automatically initiate a scan.
*   **Downstream:** The `execution_log.md` can be parsed by a `portfolio-tracker` skill to update the system's internal model of its wallet balances (`self-model.json`).
*   **Models:**
    *   **Reads:** `world-model.json` for potential token pairs or real-time gas price estimates.
    *   **Writes:** `self-model.json` could be updated with wallet balance changes after a successful trade.

## Error Handling
*   **RPC Errors:** If a connection to the RPC node fails, retry up to 3 times with a 5-second delay. If it still fails, terminate gracefully: `"Failed to connect to RPC provider at [URL]"`.
*   **Configuration Errors:** If `config.json` is missing, `monitored_routes` is absent, or any route path is invalid, exit immediately with a descriptive error message. Do not attempt to default to legacy `monitored_pairs` key names — only `monitored_routes` is supported.
*   **Invalid Route Path:** If any route's `path` array has an even length, length < 3, a zero or missing fee tier at an odd index, or a non-string token address at an even index, terminate with: `"Error: Invalid route path format for route '<name>'. Path must alternate [tokenAddr, feeTier, tokenAddr, ...] with an odd length ≥ 3."`.
*   **Token Decimal Fetch Failure:** If the scanner cannot call `decimals()` on a token, it marks all routes containing that token as failed with a warning. It must never assume a default decimal value as a fallback.
*   **ETH Price Fetch Failure:** If no WETH/USDC route is available in scan results and no live ETH price can be derived, fall back to `$2000 USD/ETH` and emit: `"⚠️ Could not determine live ETH price. Using fallback of $2000 for gas cost estimation. Results may be inaccurate."`. Never silently use an incorrect ETH price.
*   **Multi-Hop Path Encoding Failure:** If the scanner or executor cannot construct a valid ABI-encoded `bytes` path for a multi-hop route (e.g., invalid address format), it must mark that route's DEX entries as failed with an error field and continue processing other routes.
*   **Transaction Reverts:** If Swap 1 fails on-chain (including slippage reverts), `executor.js` must NOT attempt Swap 2. Log the revert reason and terminate.
*   **Swap 1 Receipt Parse Failure:** If the executor cannot locate a valid ERC-20 Transfer event for the output token in Swap 1's receipt, exit with: `"Error: Could not parse output token transfer from Swap 1 receipt. Aborting to prevent fund loss."`.
*   **Slippage Revert:** Log: `"Swap reverted: price moved beyond slippage tolerance (<N> bps). No funds lost. Consider increasing --slippage or retrying."`.
*   **Invalid Slippage Flag:** If `--slippage` is not a positive integer or exceeds `500` bps, exit immediately before writing any scripts.
*   **Insufficient Funds for Gas:** Before attempting any transaction, check the native token balance. If below a safety threshold (e.g., 0.005 ETH for direct routes, 0.007 ETH for multi-hop routes), abort with `"Insufficient ETH for gas fees."`.
*   **Partial DEX Scan Failures:** Individual DEX price query failures are non-fatal. Only if no valid prices are returned at all should the scan abort.

## Examples

**Example 1: Scan-only on Mainnet (direct + multi-hop)**
*   **Command:** `/skill defi-arbitrage-executor --scan --chain=mainnet --budget=1000`
*   **Expected Output:**
    ```
    | Route           | Route Type | Buy On    | Sell On   | Net Profit (for $1000 trade) |
    |-----------------|------------|-----------|-----------|------------------------------|
    | WETH/USDC       | Direct     | UniswapV3 | Aerodrome | $1.23                        |
    | WETH/WBTC/USDC  | Multi-hop  | Aerodrome | UniswapV3 | $3.41                        |
    ```
    *   `opportunities.json` is created with detailed data including `route_type`, `path`, and `eth_price_usd`.
    *   No transactions are sent.

**Example 2: Execute a small trade on Testnet**
*   **Command:** `/skill defi-arbitrage-executor --scan --chain=sepolia --budget=10 --execute=true`
*   **Expected Outcome:**
    *   The skill scans BASE Sepolia for both direct and multi-hop opportunities.
    *   The most profitable opportunity (regardless of route type) is selected.
    *   `execution_log.md` includes route type, full path, slippage tolerance, ETH price used for gas estimation, and transaction hashes.

**Example 3: No opportunities found**
*   **Command:** `/skill defi-arbitrage-executor --scan --chain=mainnet`
*   **Expected Output:**
    *   Console prints: `"Scan complete. No profitable arbitrage opportunities found after accounting for gas costs."`
    *   `opportunities.json` is an empty array `[]`.

**Example 4: One DEX query fails during scan**
*   **Command:** `/skill defi-arbitrage-executor --scan --chain=mainnet --budget=500`
*   **Expected Output:**
    *   Console prints: `"⚠️ Could not fetch price from Aerodrome for WETH/WBTC/USDC: quoteExactInput call reverted. Excluding from analysis."`
    *   If UniswapV3 returned a valid price but Aerodrome did not, no arbitrage opportunity can be formed for that route.

**Example 5: Invalid route path in config**
*   **Config:** `monitored_routes` has an entry `{"name": "WETH/USDC", "path": ["0xWETH", "0xUSDC"]}` (even length, missing fee tier).
*   **Expected Output:**
    *   Skill terminates before writing any scripts.
    *   Console prints: `"Error: Invalid route path format for route 'WETH/USDC'. Path must alternate [tokenAddr, feeTier, tokenAddr, ...] with an odd length ≥ 3."`

**Example 6: Multi-hop quote uses quoteExactInput**
*   **Route:** `{"name": "WETH/WBTC/USDC", "path": ["0xWETH", 500, "0xWBTC", 3000, "0xUSDC"]}`
*   **Expected Behavior:**
    *   Scanner detects `path.length = 5` (multi-hop).
    *   Constructs ABI-encoded bytes path: `WETH_addr(20 bytes) | 500(3 bytes) | WBTC_addr(20 bytes) | 3000(3 bytes) | USDC_addr(20 bytes)`.
    *   Calls `quoteExactInput(encodedPath, amountIn)` on the quoter, not `quoteExactInputSingle`.
    *   Output JSON entry includes `"route_type": "multi-hop"`.

**Example 7: Slippage revert protection**
*   **Command:** `/skill defi-arbitrage-executor --scan --chain=mainnet --budget=500 --execute=true --slippage=10`
*   **Expected Output:**
    *   Executor sets `amountOutMinimum` to 99.9% of quoted output.
    *   If market moves >0.1%, swap reverts.
    *   `execution_log.md` logs: `"Swap reverted: price moved beyond slippage tolerance (10 bps). No funds lost."`.

**Example 8: Allowance reuse on repeated trades**
*   **Expected Outcome:**
    *   First execution: 2 approvals + 2 swaps = 4 transactions.
    *   Second execution: 0 approvals (skipped) + 2 swaps = 2 transactions.
    *   Across both executions combined: exactly 2 `approve` transactions sent.

**Example 9: Token decimal normalization**
*   **Route:** Direct WETH(18)/USDC(6). Quoter returns raw `amountOut = 3000500000`.
*   **Expected Behavior:**
    *   Scanner normalizes: `ethers.formatUnits(3000500000n, 6)` → `"3000.5"`.
    *   Price stored in output JSON: `3000.5`, not `3000500000`.

**Example 10: Receipt-based amount chaining**
*   **Scenario:** Swap 1 quote was 3000.50 USDC, actual fill was 3000.12 USDC (raw: `3000120000`).
*   **Expected Behavior:**
    *   After Swap 1 confirms, executor parses Transfer event and finds `value = 3000120000`.
    *   Swap 2's `amountIn = 3000120000`, `amountOutMinimum` computed from this actual value.
    *   `execution_log.md` reflects actual amounts for accurate profit/loss.

**Example 11: ETH price derivation from scan results**
*   **Scenario:** Scan includes a WETH/USDC direct route that returns valid prices from at least one DEX (e.g., UniswapV3 price = 3000.50).
*   **Expected Behavior:**
    *   `eth_price_usd = 3000.50` is derived from the scan result and used for all gas cost USD conversions.
    *   `opportunities.json` includes `"eth_price_usd": 3000.50` on every entry.
    *   No fallback warning is emitted.

**Example 12: ETH price fallback**
*   **Scenario:** No WETH/USDC route is configured in `monitored_routes`, so no live ETH price can be derived from scan results.
*   **Expected Behavior:**
    *   Console prints: `"⚠️ Could not determine live ETH price. Using fallback of $2000 for gas cost estimation. Results may be inaccurate."`
    *   All gas cost calculations use `eth_price_usd = 2000`.
    *   `opportunities.json` includes `"eth_price_usd": 2000` on every entry.

## Round 9 — Mutation Applied
- **Mutation**: Evolved skill from single-pair to multi-hop arbitrage by replacing `monitored_pairs` with `monitored_routes` (path arrays alternating token addresses and fee tiers). Scanner now selects `quoteExactInputSingle` for direct 3-element paths and `quoteExactInput` with ABI-encoded bytes path for multi-hop 5+ element paths. Executor uses `exactInputSingle` vs `exactInput` router calls accordingly. Gas estimates account for higher cost of multi-hop swaps (~300k vs ~200k gas per swap leg). This transforms the scanner from a simple price comparison into a graph traversal problem capable of discovering cross-token arbitrage opportunities invisible to the previous implementation.

## Round 10 — Mutation Applied
- **Mutation**: Added explicit ETH/USD price derivation step in Step 4 — the skill now reads the ETH price from live WETH/USDC scan results (if available) or falls back to a conservative $2000 default with a console warning. This ensures `estimated_gas_usd` and `net_profit_usd` in `opportunities.json` are accurately denominated in USD rather than silently using an incorrect or stale ETH price, which would cause profitable opportunities to appear unprofitable (or vice versa) during periods of high ETH price volatility.