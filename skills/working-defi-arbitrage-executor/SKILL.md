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
          "router_address": "0x2626664c2603336E57B271c5C0b26F421741e481"
        },
        {
          "name": "Aerodrome",
          "router_address": "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43"
        }
      ]
    }
    ```
3.  **Environment:** The `Bash` tool must have access to `node` and `npm`.
4.  **Dependencies:** The `ethers` npm package must be installed in the working directory. Check for a `node_modules/ethers` directory. If it doesn't exist, run `npm install ethers`.

## Execution Steps

1.  **Initialization:**
    *   Parse the trigger command to determine the target `chain`, `budget`, and `execute` mode.
    *   Use `Read` to load `config.json` from the working directory.
    *   Validate the config. If any required keys are missing, terminate with an error.
    *   Select the appropriate RPC URL from the config based on the `--chain` flag.

2.  **Create Scanner Script:**
    *   Use the `Write` tool to create a Javascript file named `scanner.js` in the working directory.
    *   This script will use the `ethers` library to perform all on-chain read operations.
    *   The script should accept the RPC URL, token pairs, and DEX configurations as command-line arguments.
    *   The script's logic will:
        *   a. Connect to the specified RPC provider.
        *   b. For each token pair in `monitored_pairs`, query each DEX's router contract to get the price for a standard amount (e.g., swapping 1 Token0 for Token1).
        *   c. Output a JSON array to `stdout`, with each object representing a DEX and its current price for a given pair. Example: `[{"pair": "WETH/USDC", "dex": "UniswapV3", "price": 3000.50}, {"pair": "WETH/USDC", "dex": "Aerodrome", "price": 3001.75}]`

3.  **Fetch On-Chain Prices:**
    *   Use the `Bash` tool to execute the script: `node scanner.js --rpc_url <URL> --pairs <JSON_STRING> --dexes <JSON_STRING>`.
    *   Capture the JSON output from `stdout`.

4.  **Identify Opportunities & Calculate Profitability:**
    *   Parse the JSON output from the previous step.
    *   For each token pair, compare the prices across all DEXes.
    *   An opportunity exists if `Price_DEX_A` is different from `Price_DEX_B`.
    *   For each opportunity (e.g., Buy WETH on Uniswap, Sell on Aerodrome):
        *   a. Calculate the potential gross profit for a trade size up to the `--budget`.
        *   b. **Estimate Gas Costs:** Use `ethers` via a small `Bash` command (`node -e "..."`) to call `provider.getFeeData()` to get current gas price information (`maxFeePerGas`, `maxPriorityFeePerGas`). Estimate the total gas cost for two `swap` transactions (a reasonable estimate is ~200,000 gas units per swap). `total_gas_cost = (maxFeePerGas * 400000)`.
        *   c. **Calculate Net Profit:** `net_profit = gross_profit - total_gas_cost`.
        *   d. Discard any opportunity where `net_profit <= 0`.

5.  **Summarize and Report:**
    *   Generate a clear, human-readable summary of all profitable opportunities.
    *   Format the summary as a markdown table and print it to the console.
    *   Use the `Write` tool to save the detailed opportunities data (including net profit calculations) to `opportunities.json`.
    *   **If `--execute=false`, the skill's work is complete. Terminate successfully.**

6.  **Pre-Execution Checks (if `--execute=true`):**
    *   If no profitable opportunities were found, print a message and terminate.
    *   Select the single *most profitable* opportunity from `opportunities.json`.
    *   Verify that the required input amount for the trade is less than or equal to the `--budget`. If not, log that the best opportunity exceeds the budget and terminate.
    *   Use `ethers` to check the wallet's native token balance (ETH on BASE). If the balance is insufficient to cover the estimated gas cost, abort with a clear error message.

7.  **Create Executor Script:**
    *   Use the `Write` tool to create `executor.js`.
    *   This script will take the private key and the full details of the chosen trade (buy DEX, sell DEX, tokens, amounts) as arguments.
    *   The script's logic will:
        *   a. Initialize an `ethers.Wallet` instance with the private key and connect it to the provider.
        *   b. **Approve:** For the first swap, generate and send an `approve` transaction to the DEX router for the input token. Wait for the transaction to be mined.
        *   c. **Execute Swap 1 (Buy):** Construct and send the swap transaction on the lower-priced DEX. Wait for the receipt. If this transaction fails (reverts), the script must exit with a non-zero code and log the error.
        *   d. **Approve:** For the second swap, generate and send an `approve` transaction to the other DEX router for the token received in Swap 1.
        *   e. **Execute Swap 2 (Sell):** Construct and send the swap transaction on the higher-priced DEX. Wait for the receipt.
        *   f. Log the transaction hashes of all successful transactions to `stdout`.

8.  **Execute Trade:**
    *   Use the `Bash` tool to run the executor script: `node executor.js --trade_details <JSON_STRING> --private_key <KEY>`.
    *   Monitor the script's exit code.

9.  **Final Logging:**
    *   Based on the output and exit code of `executor.js`, create a final report in `execution_log.md`.
    *   The log must include:
        *   The opportunity that was executed.
        *   The status (SUCCESS or FAILED).
        *   Transaction hashes for all on-chain actions (approvals, swaps).
        *   If failed, the reason for the failure.
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
2.  **Net Profit Calculation:** Every opportunity listed in the output includes a `net_profit` field that is demonstrably `gross_profit - estimated_gas`.
3.  **Budget Enforcement:** If `--execute=true`, the `execution_log.md` must show that the executed trade's input amount was less than or equal to the `--budget` flag.
4.  **Graceful Failure:** In a simulated scenario where a transaction would fail (e.g., insufficient balance), the skill must log the error in `execution_log.md` and terminate without attempting the second leg of the trade.
5.  **Clear Summary:** The console output provides a clean, readable summary of findings that is easy for a user to understand.
6.  **Chain Agnostic:** The skill successfully runs and fetches data when both `--chain=mainnet` and `--chain=sepolia` are used, connecting to the correct RPC endpoint each time.

## Integration Points
*   **Upstream:** This skill can be triggered by a future `market-volatility-monitor` skill, which could detect favorable conditions and automatically initiate a scan.
*   **Downstream:** The `execution_log.md` can be parsed by a `portfolio-tracker` skill to update the system's internal model of its wallet balances (`self-model.json`).
*   **Models:**
    *   **Reads:** `world-model.json` for potential token pairs or real-time gas price estimates.
    *   **Writes:** `self-model.json` could be updated with wallet balance changes after a successful trade.

## Error Handling
*   **RPC Errors:** If a connection to the RPC node fails, retry up to 3 times with a 5-second delay. If it still fails, terminate gracefully with an error message: "Failed to connect to RPC provider at [URL]".
*   **Configuration Errors:** If `config.json` is missing or invalid, exit immediately with a message specifying what is wrong (e.g., "Error: `private_key` not found in config.json").
*   **Transaction Reverts:** If the first swap transaction fails on-chain, the `executor.js` script MUST NOT attempt the second swap. The skill must log the revert reason from the transaction receipt and terminate the execution flow. This is critical to prevent fund loss.
*   **Insufficient Funds for Gas:** Before attempting any transaction, the skill must check the native token balance. If it's below a safety threshold (e.g., 0.005 ETH), abort execution with the message "Insufficient ETH for gas fees."

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
    *   `execution_log.md` is created containing the status (SUCCESS/FAIL) and transaction hashes.
    *   Console prints final status: "Execution successful. Final profit: $0.02. See execution_log.md for details."

**Example 3: No opportunities found**
*   **Command:** `/skill defi-arbitrage-executor --scan --chain=mainnet`
*   **Expected Output:**
    *   Console prints: "Scan complete. No profitable arbitrage opportunities found after accounting for gas costs."
    *   `opportunities.json` is an empty array `[]`.
    *   The skill terminates successfully.