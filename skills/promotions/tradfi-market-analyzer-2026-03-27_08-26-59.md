# Promotion Proposal: tradfi-market-analyzer

## Scores
- **Baseline**: 23/48
- **Current**: 48/48
- **Improvement**: +25 points (100.0%)
- **Rounds**: 5

## Promotion Target
`/Users/ramene/Journal/.seed/base/skills/tradfi-market-analyzer/SKILL.md`

## Key Mutations That Improved Score
1. Replace Bash-style tradfi-tools invocations with explicit MCP tool call instructions, since MCP tools cannot be executed as shell commands — this fixes the root cause behind 7+7+6 failures
2. Strengthen the synthesis step with an explicit checklist-style aggregation protocol, since "aggregate signals from multiple sources" was historically the second-weakest criterion (5/8) and the current instructions leave too much implicit about how to combine data from different tool responses.
3. Replace bash-based data processing (jq/awk pipes) in Step 3 with in-context [Self] computation, since shell pipelines are fragile and likely causing the 7/7 failures in technical analysis and arbitrage — Claude can compute averages and compare bid/ask values directly from JSON read into context.
4. Add a tool discovery/validation step at initialization so the skill confirms available tradfi-tools before planning, preventing silent failures from assumed-but-missing tool names (the most likely fragility point given the historical 1/8 arbitrage and technical analysis scores came from tool invocation issues).
5. Add an explicit output format decision rule (JSON if the word "json" or "structured data" appears in the request, otherwise Markdown) to remove ambiguity in format selection and prevent future regressions on the "structured format" criterion.

## Unified Diff (baseline -> current)
```diff
--- /Users/ramene/.remote/@autoresearch/skills/working-tradfi-market-analyzer/SKILL.md.baseline	2026-03-25 16:54:37.000000000 -0600
+++ /Users/ramene/.remote/@autoresearch/skills/working-tradfi-market-analyzer/SKILL.md	2026-03-25 17:14:26.000000000 -0600
@@ -22,43 +22,93 @@
 2.  **Clear Objective:** The user prompt or triggering event must provide a clear target for analysis (e.g., a specific ticker, index, country, or type of analysis).
 3.  **Working Directory:** A dedicated working directory must be created for the skill's execution: `~/.remote/@autoresearch/skills/working-tradfi-market-analyzer/`.
 
+## Critical: How to Call tradfi-tools
+
+**tradfi-tools are MCP tools, NOT bash/shell commands.** They must be invoked as tool calls through the MCP interface — the same way any other MCP tool (e.g., `mcp__polymarket__get_market_details`) is called. Do NOT attempt to run them as bash commands like `tradfi-tools.get_price_history --ticker=TSLA`. That will fail silently.
+
+**Correct invocation pattern:**
+- Invoke `tradfi-tools.<tool_name>` as a structured MCP tool call with parameters as key-value arguments.
+- After receiving the tool response, use **[Write]** to save the result as a JSON file in the working directory for later processing.
+
+**Example (correct):**
+1. Call MCP tool: `tradfi-tools.get_price_history` with params `{ticker: "TSLA", period: "50d"}`
+2. Receive JSON response from tool.
+3. **[Write]** Save to `~/.remote/@autoresearch/skills/working-tradfi-market-analyzer/price_history_TSLA.json`
+
+**Example (incorrect — do not do this):**
+```bash
+tradfi-tools.get_price_history --ticker="TSLA" --period="50d" > price_history_TSLA.json
+```
+
 ## Execution Steps
-1.  **Initialization and Planning:**
+1.  **Initialization, Tool Discovery, and Planning:**
     *   **[Bash]** Create the working directory: `mkdir -p ~/.remote/@autoresearch/skills/working-tradfi-market-analyzer/`
+    *   **[Self]** Before planning any tool calls, enumerate the tradfi-tools that are actually available in the current MCP context. Identify which of the following canonical tools are present: `get_price_history`, `get_order_book`, `get_macroeconomic_indicator`, `get_market_index_performance`, `get_top_movers`. If a required tool is missing, note it and select the closest available alternative. Do not assume a tool exists — only plan to call tools confirmed present.
     *   **[Self]** Parse the user's request to determine the required analysis type(s):
         *   Single Price Fetch (e.g., "price for AAPL")
         *   Technical Analysis (e.g., "moving average for TSLA")
         *   Arbitrage Scan (e.g., "arbitrage for BTC between Coinbase and Kraken")
         *   Macroeconomic Summary (e.g., "CPI data for the United States")
         *   Broad Market Outlook / Comparison (e.g., "S&P 500 outlook", "gold vs. dollar")
-    *   **[Write]** Create a `plan.md` file in the working directory outlining the chosen analysis types and the specific tools that will be used.
+    *   **[Self]** Determine the output format now, before writing the plan. Apply this rule exactly:
+        *   If the user's request contains the word **"json"**, **"JSON"**, or the phrase **"structured data"** → output format is **JSON** (`analysis_report.json`)
+        *   Otherwise → output format is **Markdown** (`analysis_report.md`)
+        Record the chosen format in `plan.md` and do not change it afterward.
+    *   **[Write]** Create a `plan.md` file in the working directory outlining the chosen analysis types, the confirmed-available tools that will be used, any tool substitutions made, and the selected output format.
+
+2.  **Data Gathering:** Based on `plan.md`, invoke the necessary `tradfi-tools` as **MCP tool calls** (not bash commands). After each call, save the response using **[Write]** to a separate JSON file in the working directory for later processing.
 
-2.  **Data Gathering:** Based on `plan.md`, execute the necessary `tradfi-tools` commands. Save the output of each command to a separate JSON file for later processing.
     *   **For Price/Technical Analysis:**
-        *   **[Bash]** `tradfi-tools.get_price_history --ticker="[TICKER]" --period="[e.g., 50d]" > price_history_[TICKER].json`
+        *   **[MCP Tool Call]** Invoke `tradfi-tools.get_price_history` with params `{ticker: "[TICKER]", period: "[e.g., 50d]"}`
+        *   **[Write]** Save response to `price_history_[TICKER].json`
+
     *   **For Arbitrage Scan:**
-        *   **[Bash]** `tradfi-tools.get_order_book --ticker="[TICKER]" --exchange="[EXCHANGE_1]" > order_book_[TICKER]_[EXCHANGE_1].json`
-        *   **[Bash]** `tradfi-tools.get_order_book --ticker="[TICKER]" --exchange="[EXCHANGE_2]" > order_book_[TICKER]_[EXCHANGE_2].json`
+        *   **[MCP Tool Call]** Invoke `tradfi-tools.get_order_book` with params `{ticker: "[TICKER]", exchange: "[EXCHANGE_1]"}`
+        *   **[Write]** Save response to `order_book_[TICKER]_[EXCHANGE_1].json`
+        *   **[MCP Tool Call]** Invoke `tradfi-tools.get_order_book` with params `{ticker: "[TICKER]", exchange: "[EXCHANGE_2]"}`
+        *   **[Write]** Save response to `order_book_[TICKER]_[EXCHANGE_2].json`
+
     *   **For Macroeconomic Summary:**
-        *   **[Bash]** `tradfi-tools.get_macroeconomic_indicator --country="[COUNTRY]" --indicator="[INDICATOR]" > macro_[COUNTRY]_[INDICATOR].json`
+        *   **[MCP Tool Call]** Invoke `tradfi-tools.get_macroeconomic_indicator` with params `{country: "[COUNTRY]", indicator: "[INDICATOR]"}`
+        *   **[Write]** Save response to `macro_[COUNTRY]_[INDICATOR].json`
+
     *   **For Broad Market/Index Analysis:**
-        *   **[Bash]** `tradfi-tools.get_market_index_performance --index="[INDEX]" > index_[INDEX].json`
-        *   **[Bash]** `tradfi-tools.get_top_movers --market="[MARKET]" > top_movers_[MARKET].json`
+        *   **[MCP Tool Call]** Invoke `tradfi-tools.get_market_index_performance` with params `{index: "[INDEX]"}`
+        *   **[Write]** Save response to `index_[INDEX].json`
+        *   **[MCP Tool Call]** Invoke `tradfi-tools.get_top_movers` with params `{market: "[MARKET]"}`
+        *   **[Write]** Save response to `top_movers_[MARKET].json`
 
 3.  **Data Processing and Analysis:**
-    *   **[Read, Bash]** For **Technical Analysis**, read the `price_history_*.json` file. Use a tool like `jq` combined with `awk` or a small Python script to calculate the required metric (e.g., moving average).
-        *   Example: `cat price_history_TSLA.json | jq '.[].close' | awk '{sum+=$1} END {print sum/NR}' > moving_average_TSLA.txt`
-    *   **[Read, Bash]** For **Arbitrage Scan**, read the two `order_book_*.json` files. Use `jq` to extract the highest bid from one and the lowest ask from the other. Compare them to identify any potential spread.
-        *   Example: `bid1=$(cat order_book_BTC_Coinbase.json | jq '.bids[0][0]')`, `ask2=$(cat order_book_BTC_Kraken.json | jq '.asks[0][0]')`. Then compare `$bid1` and `$ask2`.
-    *   **[Read, Grep]** For all other analysis types, read the relevant JSON files and extract the key data points needed for the final report.
+
+    > **IMPORTANT: Do NOT use bash/shell pipes (jq, awk, Python scripts) to compute derived values. Instead, use [Read] to load the JSON file into context and [Self] to compute values directly. This ensures reliable calculation even when shell tools are unavailable.**
+
+    *   **For Technical Analysis (e.g., moving average):**
+        *   **[Read]** Load `price_history_[TICKER].json` into context.
+        *   **[Self]** Extract all `close` price values from the JSON array. Sum them and divide by the count to compute the moving average. Record the exact numeric result (e.g., "50-day MA for TSLA = $255.75"). This computed value MUST appear in the final report.
+
+    *   **For Arbitrage Scan:**
+        *   **[Read]** Load `order_book_[TICKER]_[EXCHANGE_1].json` into context.
+        *   **[Read]** Load `order_book_[TICKER]_[EXCHANGE_2].json` into context.
+        *   **[Self]** Extract the highest bid price from Exchange 1 and the lowest ask price from Exchange 2 (and vice versa). Compute the spread: `spread = highest_bid - lowest_ask`. Record the exact numeric spread value. If spread > 0, an arbitrage opportunity exists. Both the spread value and the conclusion MUST appear in the final report.
+
+    *   **For Macroeconomic Summary and other analysis types:**
+        *   **[Read]** Load all relevant JSON files into context.
+        *   **[Self]** Extract the key data points needed for the final report (e.g., CPI value, unemployment rate, index level, percentage change).
 
 4.  **Synthesis and Report Generation:**
-    *   **[Self]** Aggregate all processed data and intermediate results (e.g., the calculated moving average, the arbitrage spread).
-    *   **[Self]** Formulate a coherent summary that connects the different data points. For a broad market outlook, synthesize the index performance with the macroeconomic signals.
-    *   **[Write]** Create the final output file, `analysis_report.md` or `analysis_report.json`, in the working directory. Structure the report logically with clear headings.
+    *   **[Self]** Before writing the final report, explicitly aggregate all processed data using the following checklist. For each data source fetched, record: (a) the source name/tool used, (b) the key metric extracted, and (c) what it implies in isolation. Only after completing this per-source list, proceed to cross-source synthesis.
+    *   **[Self]** Cross-source synthesis rules:
+        *   If both **price/index data** and **macroeconomic data** were fetched: the summary MUST explicitly state how the macro signals contextualize the price movement (e.g., "The index decline is consistent with elevated CPI reducing risk appetite").
+        *   If **arbitrage data** from two exchanges was fetched: the summary MUST state the spread value, not just whether an opportunity exists.
+        *   If **technical analysis** was computed: the summary MUST include the computed numeric value alongside the raw price level.
+        *   If only one data source was fetched: no cross-source synthesis is required; summarize that single source clearly.
+    *   **[Write]** Create the final output file using the format determined in Step 1 — either `analysis_report.md` (Markdown) or `analysis_report.json` (JSON) — in the working directory. Structure the report logically with clear headings.
 
 ## Output Format
-The primary output is a markdown file, `analysis_report.md`, placed in the working directory. If the request explicitly asks for structured data, a `analysis_report.json` file should be generated instead.
+
+**Format Selection Rule (determined once in Step 1, never changed):**
+- Request contains "json", "JSON", or "structured data" → `analysis_report.json`
+- All other requests → `analysis_report.md`
 
 **Markdown Report Example (`analysis_report.md`):**
 ```markdown
@@ -101,18 +151,20 @@
 ## Quality Gates
 Before marking the skill execution as complete, verify the following:
 1.  **Price Data Fetched:** If the request involved a ticker, the final report must contain price data for that ticker.
-2.  **Arbitrage Analyzed:** If arbitrage was requested, the report must compare data from two exchanges and state a clear conclusion (e.g., "Arbitrage opportunity identified" or "No significant arbitrage opportunity found").
+2.  **Arbitrage Analyzed:** If arbitrage was requested, the report must compare data from two exchanges and state the calculated numeric spread value and a clear conclusion (e.g., "Arbitrage opportunity identified: spread of $X" or "No significant arbitrage opportunity found").
 3.  **Macro Indicators Included:** If macro analysis was requested, the report must contain the specific indicators for the requested country.
-4.  **Signals Aggregated:** For broad outlooks, the "Overall Summary" section must exist and synthesize data from at least two different sources (e.g., price data and macro data).
-5.  **Technical Analysis Performed:** If a technical indicator was requested, its calculated value must be present in the report.
-6.  **Structured Output:** The final output file (`analysis_report.md` or `analysis_report.json`) must exist, be well-formatted, and located in the working directory.
+4.  **Signals Aggregated:** For broad outlooks, the "Overall Summary" section must exist and explicitly connect at least two different data sources (e.g., state how price data and macro data relate to each other — not just list them separately).
+5.  **Technical Analysis Performed:** If a technical indicator was requested, its calculated numeric value (computed in-context from raw price data) must be present in the report.
+6.  **Structured Output:** The final output file (`analysis_report.md` or `analysis_report.json`) must exist, be well-formatted, and located in the working directory. The format must match the rule: JSON only when the user's request contained "json", "JSON", or "structured data"; Markdown otherwise.
+7.  **Tool Discovery Completed:** The `plan.md` must list only tools confirmed available in the current MCP context — no assumed tool names that were not verified.
 
 ## Integration Points
 *   **Upstream:** This skill consumes data exclusively from the `tradfi-tools` MCP domain. It is triggered by user prompts or other skills in the autoresearch ecosystem that require financial context.
 *   **Downstream:** The generated `analysis_report.md` can be used as input for a `report-generator` skill to create more formal documents, or a `decision-maker` skill to inform automated strategies. The structured JSON output can be used to update the `world-model.json` with the latest market state.
 
 ## Error Handling
-*   **Tool Failure:** If any `tradfi-tools` command fails (e.g., API error, invalid ticker), the skill should log the error, explicitly mention the missing data in the final report (e.g., "Could not retrieve price history for TSLA due to a tool error."), and proceed with the rest of the analysis if possible.
+*   **Tool Not Found:** If a required `tradfi-tools` tool is not present in the current MCP context during the discovery phase, log the missing tool in `plan.md`, attempt to find an equivalent alternative tool, and only fall back to skipping that analysis type if no alternative exists. Never call a tool that was not confirmed available.
+*   **Tool Failure:** If any `tradfi-tools` MCP tool call fails (e.g., API error, invalid ticker, tool not found), the skill should log the error, explicitly mention the missing data in the final report (e.g., "Could not retrieve price history for TSLA due to a tool error."), and proceed with the rest of the analysis if possible.
 *   **No Data Found:** If a tool returns empty or null data for a valid query, the report should state this clearly (e.g., "No macroeconomic data for 'CPI' was found for the specified country.").
 *   **Ambiguous Request:** If the user's request is too vague to formulate a plan (e.g., "/analyze_market finance"), the skill should not execute tool calls and instead respond by asking for a more specific query.
 
@@ -120,27 +172,29 @@
 ### Example 1: Broad Market Outlook
 *   **Input:** `/analyze_market Provide a market outlook based on current S&P 500 performance and US macro signals.`
 *   **Execution:**
-    1.  Plan to use `get_market_index_performance` and `get_macroeconomic_indicator`.
-    2.  `tradfi-tools.get_market_index_performance --index="SPX" > index_SPX.json`
-    3.  `tradfi-tools.get_macroeconomic_indicator --country="USA" --indicator="CPI" > macro_USA_CPI.json`
-    4.  `tradfi-tools.get_macroeconomic_indicator --country="USA" --indicator="Unemployment" > macro_USA_Unemployment.json`
-    5.  Read the three JSON files, extract key figures, and write a summary to `analysis_report.md`.
-*   **Output (`analysis_report.md`):** A markdown report summarizing the S&P 500's recent performance alongside the latest CPI and unemployment figures, with a concluding paragraph synthesizing these points.
+    1.  Discover available tools; confirm `get_market_index_performance` and `get_macroeconomic_indicator` are present. Plan to use both. Output format: Markdown (no "json" keyword).
+    2.  **[MCP Tool Call]** `tradfi-tools.get_market_index_performance` with `{index: "SPX"}` → Write to `index_SPX.json`
+    3.  **[MCP Tool Call]** `tradfi-tools.get_macroeconomic_indicator` with `{country: "USA", indicator: "CPI"}` → Write to `macro_USA_CPI.json`
+    4.  **[MCP Tool Call]** `tradfi-tools.get_macroeconomic_indicator` with `{country: "USA", indicator: "Unemployment"}` → Write to `macro_USA_Unemployment.json`
+    5.  **[Read]** Load all three JSON files into context. **[Self]** Extract index level/change, CPI value, and unemployment rate directly from the loaded data.
+    6.  Write a summary to `analysis_report.md`. The summary must explicitly state how CPI and unemployment contextualize the index's current performance.
+*   **Output (`analysis_report.md`):** A markdown report summarizing the S&P 500's recent performance alongside the latest CPI and unemployment figures, with a concluding paragraph that connects these data points (e.g., how inflation levels influence index direction).
 
 ### Example 2: Arbitrage Check
 *   **Input:** `/analyze_market Are there any arbitrage opportunities for BTC-USD between Coinbase and Kraken?`
 *   **Execution:**
-    1.  Plan to use `get_order_book` twice.
-    2.  `tradfi-tools.get_order_book --ticker="BTC-USD" --exchange="Coinbase" > order_book_BTC-USD_Coinbase.json`
-    3.  `tradfi-tools.get_order_book --ticker="BTC-USD" --exchange="Kraken" > order_book_BTC-USD_Kraken.json`
-    4.  Read both files, extract the highest bid from one and the lowest ask from the other, calculate the spread, and write the conclusion to `analysis_report.md`.
-*   **Output (`analysis_report.md`):** A report stating the best bid/ask on each exchange, the calculated spread, and a conclusion on whether a profitable arbitrage opportunity exists (ignoring fees).
+    1.  Discover available tools; confirm `get_order_book` is present. Plan to call it twice. Output format: Markdown (no "json" keyword).
+    2.  **[MCP Tool Call]** `tradfi-tools.get_order_book` with `{ticker: "BTC-USD", exchange: "Coinbase"}` → Write to `order_book_BTC-USD_Coinbase.json`
+    3.  **[MCP Tool Call]** `tradfi-tools.get_order_book` with `{ticker: "BTC-USD", exchange: "Kraken"}` → Write to `order_book_BTC-USD_Kraken.json`
+    4.  **[Read]** Load both JSON files into context. **[Self]** Extract the highest bid from Coinbase and the lowest ask from Kraken (and vice versa). Compute the spread numerically in-context.
+    5.  Write the conclusion to `analysis_report.md`, including the exact numeric spread value.
+*   **Output (`analysis_report.md`):** A report stating the best bid/ask on each exchange, the calculated numeric spread (e.g., "Spread: $42.50"), and a conclusion on whether a profitable arbitrage opportunity exists (ignoring fees).
 
 ### Example 3: Technical Analysis
 *   **Input:** `/analyze_market Calculate the 50-day moving average for TSLA and provide the result in JSON.`
 *   **Execution:**
-    1.  Plan to use `get_price_history`.
-    2.  `tradfi-tools.get_price_history --ticker="TSLA" --period="50d" > price_history_TSLA.json`
-    3.  Process `price_history_TSLA.json` using `jq` and `awk` to calculate the average of the closing prices.
+    1.  Discover available tools; confirm `get_price_history` is present. Plan to use it. Output format: **JSON** (request contains "JSON").
+    2.  **[MCP Tool Call]** `tradfi-tools.get_price_history` with `{ticker: "TSLA", period: "50d"}` → Write to `price_history_TSLA.json`
+    3.  **[Read]** Load `price_history_TSLA.json` into context. **[Self]** Extract all `close` values from the array, sum them, divide by count to compute the moving average. Record the exact numeric result.
     4.  Format the final result into the specified JSON structure in `analysis_report.json`.
 *   **Output (`analysis_report.json`):** A JSON object containing the ticker, the analysis type, the period (50d), and the calculated moving average value.
\ No newline at end of file

```

## Generated
- **Timestamp**: 2026-03-27T08:26:59.456Z
- **Source**: `/Users/ramene/.remote/@autoresearch/skills/working-tradfi-market-analyzer/SKILL.md`
- **Baseline**: `/Users/ramene/.remote/@autoresearch/skills/working-tradfi-market-analyzer/SKILL.md.baseline`
