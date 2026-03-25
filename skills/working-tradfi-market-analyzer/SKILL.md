# tradfi-market-analyzer
Analyzes traditional finance markets using price feeds, arbitrage scanning, and macroeconomic signals.

## Purpose
This skill exists to leverage the connected `tradfi-tools` data stream, which currently has 24 tools but no associated analytical skills. As identified in `want-019`, this represents a major untapped capability. This skill bridges that gap by providing a structured methodology for fetching, processing, and synthesizing financial data into actionable analysis, directly addressing the hypothesis that the system can perform valuable financial market analysis.

## Trigger Conditions
This skill should be activated under the following conditions:

*   **Slash Command:** `/analyze_market [query]`
    *   Example: `/analyze_market What is the current state of the S&P 500?`
*   **Keywords:** When user prompts contain keywords related to financial analysis, such as:
    *   "analyze market", "market outlook", "price of AAPL", "S&P 500 performance"
    *   "arbitrage opportunity for BTC", "compare exchanges"
    *   "US CPI data", "unemployment rate", "macroeconomic signals"
    *   "50-day moving average for TSLA", "technical analysis"
    *   "gold vs dollar", "compare assets"
*   **Automatic Detection:** The skill can be triggered by other system components that detect a need for financial analysis, such as a significant market event alert or a newly filed `want` related to financial data.

## Prerequisites
1.  **Tool Availability:** The `tradfi-tools` MCP domain must be connected and its tools available. Verify this by checking for its presence in `~/.remote/@autoresearch/world-model.json`.
2.  **Clear Objective:** The user prompt or triggering event must provide a clear target for analysis (e.g., a specific ticker, index, country, or type of analysis).
3.  **Working Directory:** A dedicated working directory must be created for the skill's execution: `~/.remote/@autoresearch/skills/working-tradfi-market-analyzer/`.

## Critical: How to Call tradfi-tools

**tradfi-tools are MCP tools, NOT bash/shell commands.** They must be invoked as tool calls through the MCP interface — the same way any other MCP tool (e.g., `mcp__polymarket__get_market_details`) is called. Do NOT attempt to run them as bash commands like `tradfi-tools.get_price_history --ticker=TSLA`. That will fail silently.

**Correct invocation pattern:**
- Invoke `tradfi-tools.<tool_name>` as a structured MCP tool call with parameters as key-value arguments.
- After receiving the tool response, use **[Write]** to save the result as a JSON file in the working directory for later processing.

**Example (correct):**
1. Call MCP tool: `tradfi-tools.get_price_history` with params `{ticker: "TSLA", period: "50d"}`
2. Receive JSON response from tool.
3. **[Write]** Save to `~/.remote/@autoresearch/skills/working-tradfi-market-analyzer/price_history_TSLA.json`

**Example (incorrect — do not do this):**
```bash
tradfi-tools.get_price_history --ticker="TSLA" --period="50d" > price_history_TSLA.json
```

## Execution Steps
1.  **Initialization, Tool Discovery, and Planning:**
    *   **[Bash]** Create the working directory: `mkdir -p ~/.remote/@autoresearch/skills/working-tradfi-market-analyzer/`
    *   **[Self]** Before planning any tool calls, enumerate the tradfi-tools that are actually available in the current MCP context. Identify which of the following canonical tools are present: `get_price_history`, `get_order_book`, `get_macroeconomic_indicator`, `get_market_index_performance`, `get_top_movers`. If a required tool is missing, note it and select the closest available alternative. Do not assume a tool exists — only plan to call tools confirmed present.
    *   **[Self]** Parse the user's request to determine the required analysis type(s):
        *   Single Price Fetch (e.g., "price for AAPL")
        *   Technical Analysis (e.g., "moving average for TSLA")
        *   Arbitrage Scan (e.g., "arbitrage for BTC between Coinbase and Kraken")
        *   Macroeconomic Summary (e.g., "CPI data for the United States")
        *   Broad Market Outlook / Comparison (e.g., "S&P 500 outlook", "gold vs. dollar")
    *   **[Self]** Determine the output format now, before writing the plan. Apply this rule exactly:
        *   If the user's request contains the word **"json"**, **"JSON"**, or the phrase **"structured data"** → output format is **JSON** (`analysis_report.json`)
        *   Otherwise → output format is **Markdown** (`analysis_report.md`)
        Record the chosen format in `plan.md` and do not change it afterward.
    *   **[Write]** Create a `plan.md` file in the working directory outlining the chosen analysis types, the confirmed-available tools that will be used, any tool substitutions made, and the selected output format.

2.  **Data Gathering:** Based on `plan.md`, invoke the necessary `tradfi-tools` as **MCP tool calls** (not bash commands). After each call, save the response using **[Write]** to a separate JSON file in the working directory for later processing.

    *   **For Price/Technical Analysis:**
        *   **[MCP Tool Call]** Invoke `tradfi-tools.get_price_history` with params `{ticker: "[TICKER]", period: "[e.g., 50d]"}`
        *   **[Write]** Save response to `price_history_[TICKER].json`

    *   **For Arbitrage Scan:**
        *   **[MCP Tool Call]** Invoke `tradfi-tools.get_order_book` with params `{ticker: "[TICKER]", exchange: "[EXCHANGE_1]"}`
        *   **[Write]** Save response to `order_book_[TICKER]_[EXCHANGE_1].json`
        *   **[MCP Tool Call]** Invoke `tradfi-tools.get_order_book` with params `{ticker: "[TICKER]", exchange: "[EXCHANGE_2]"}`
        *   **[Write]** Save response to `order_book_[TICKER]_[EXCHANGE_2].json`

    *   **For Macroeconomic Summary:**
        *   **[MCP Tool Call]** Invoke `tradfi-tools.get_macroeconomic_indicator` with params `{country: "[COUNTRY]", indicator: "[INDICATOR]"}`
        *   **[Write]** Save response to `macro_[COUNTRY]_[INDICATOR].json`

    *   **For Broad Market/Index Analysis:**
        *   **[MCP Tool Call]** Invoke `tradfi-tools.get_market_index_performance` with params `{index: "[INDEX]"}`
        *   **[Write]** Save response to `index_[INDEX].json`
        *   **[MCP Tool Call]** Invoke `tradfi-tools.get_top_movers` with params `{market: "[MARKET]"}`
        *   **[Write]** Save response to `top_movers_[MARKET].json`

3.  **Data Processing and Analysis:**

    > **IMPORTANT: Do NOT use bash/shell pipes (jq, awk, Python scripts) to compute derived values. Instead, use [Read] to load the JSON file into context and [Self] to compute values directly. This ensures reliable calculation even when shell tools are unavailable.**

    *   **For Technical Analysis (e.g., moving average):**
        *   **[Read]** Load `price_history_[TICKER].json` into context.
        *   **[Self]** Extract all `close` price values from the JSON array. Sum them and divide by the count to compute the moving average. Record the exact numeric result (e.g., "50-day MA for TSLA = $255.75"). This computed value MUST appear in the final report.

    *   **For Arbitrage Scan:**
        *   **[Read]** Load `order_book_[TICKER]_[EXCHANGE_1].json` into context.
        *   **[Read]** Load `order_book_[TICKER]_[EXCHANGE_2].json` into context.
        *   **[Self]** Extract the highest bid price from Exchange 1 and the lowest ask price from Exchange 2 (and vice versa). Compute the spread: `spread = highest_bid - lowest_ask`. Record the exact numeric spread value. If spread > 0, an arbitrage opportunity exists. Both the spread value and the conclusion MUST appear in the final report.

    *   **For Macroeconomic Summary and other analysis types:**
        *   **[Read]** Load all relevant JSON files into context.
        *   **[Self]** Extract the key data points needed for the final report (e.g., CPI value, unemployment rate, index level, percentage change).

4.  **Synthesis and Report Generation:**
    *   **[Self]** Before writing the final report, explicitly aggregate all processed data using the following checklist. For each data source fetched, record: (a) the source name/tool used, (b) the key metric extracted, and (c) what it implies in isolation. Only after completing this per-source list, proceed to cross-source synthesis.
    *   **[Self]** Cross-source synthesis rules:
        *   If both **price/index data** and **macroeconomic data** were fetched: the summary MUST explicitly state how the macro signals contextualize the price movement (e.g., "The index decline is consistent with elevated CPI reducing risk appetite").
        *   If **arbitrage data** from two exchanges was fetched: the summary MUST state the spread value, not just whether an opportunity exists.
        *   If **technical analysis** was computed: the summary MUST include the computed numeric value alongside the raw price level.
        *   If only one data source was fetched: no cross-source synthesis is required; summarize that single source clearly.
    *   **[Write]** Create the final output file using the format determined in Step 1 — either `analysis_report.md` (Markdown) or `analysis_report.json` (JSON) — in the working directory. Structure the report logically with clear headings.

## Output Format

**Format Selection Rule (determined once in Step 1, never changed):**
- Request contains "json", "JSON", or "structured data" → `analysis_report.json`
- All other requests → `analysis_report.md`

**Markdown Report Example (`analysis_report.md`):**
```markdown
# Financial Market Analysis: S&P 500 and US Macro Signals

**Date:** 2023-10-27

## Market Index Performance: S&P 500 (SPX)
*   **Current Level:** 4,117.37
*   **Today's Change:** -19.86 (-0.48%)
*   **52-Week High:** 4,588.96
*   **52-Week Low:** 3,577.03

## Key Macroeconomic Signals: United States
*   **Consumer Price Index (CPI):** 3.7% (YoY, September 2023)
*   **Unemployment Rate:** 3.8% (September 2023)

## Overall Summary
The S&P 500 shows a slight downturn in today's trading session. This movement is contextualized by persistent inflation, as indicated by a 3.7% CPI, and a stable but tight labor market with a 3.8% unemployment rate. These signals suggest continued market sensitivity to Federal Reserve policy.
```

**JSON Output Example (`analysis_report.json`):**
```json
{
  "query": "Calculate the 50-day moving average for TSLA",
  "analysis_timestamp": "2023-10-27T10:00:00Z",
  "results": [
    {
      "type": "technical_analysis",
      "ticker": "TSLA",
      "indicator": "moving_average",
      "period": "50d",
      "value": 255.75
    }
  ],
  "summary": "The 50-day moving average for TSLA is calculated to be $255.75."
}
```

## Quality Gates
Before marking the skill execution as complete, verify the following:
1.  **Price Data Fetched:** If the request involved a ticker, the final report must contain price data for that ticker.
2.  **Arbitrage Analyzed:** If arbitrage was requested, the report must compare data from two exchanges and state the calculated numeric spread value and a clear conclusion (e.g., "Arbitrage opportunity identified: spread of $X" or "No significant arbitrage opportunity found").
3.  **Macro Indicators Included:** If macro analysis was requested, the report must contain the specific indicators for the requested country.
4.  **Signals Aggregated:** For broad outlooks, the "Overall Summary" section must exist and explicitly connect at least two different data sources (e.g., state how price data and macro data relate to each other — not just list them separately).
5.  **Technical Analysis Performed:** If a technical indicator was requested, its calculated numeric value (computed in-context from raw price data) must be present in the report.
6.  **Structured Output:** The final output file (`analysis_report.md` or `analysis_report.json`) must exist, be well-formatted, and located in the working directory. The format must match the rule: JSON only when the user's request contained "json", "JSON", or "structured data"; Markdown otherwise.
7.  **Tool Discovery Completed:** The `plan.md` must list only tools confirmed available in the current MCP context — no assumed tool names that were not verified.

## Integration Points
*   **Upstream:** This skill consumes data exclusively from the `tradfi-tools` MCP domain. It is triggered by user prompts or other skills in the autoresearch ecosystem that require financial context.
*   **Downstream:** The generated `analysis_report.md` can be used as input for a `report-generator` skill to create more formal documents, or a `decision-maker` skill to inform automated strategies. The structured JSON output can be used to update the `world-model.json` with the latest market state.

## Error Handling
*   **Tool Not Found:** If a required `tradfi-tools` tool is not present in the current MCP context during the discovery phase, log the missing tool in `plan.md`, attempt to find an equivalent alternative tool, and only fall back to skipping that analysis type if no alternative exists. Never call a tool that was not confirmed available.
*   **Tool Failure:** If any `tradfi-tools` MCP tool call fails (e.g., API error, invalid ticker, tool not found), the skill should log the error, explicitly mention the missing data in the final report (e.g., "Could not retrieve price history for TSLA due to a tool error."), and proceed with the rest of the analysis if possible.
*   **No Data Found:** If a tool returns empty or null data for a valid query, the report should state this clearly (e.g., "No macroeconomic data for 'CPI' was found for the specified country.").
*   **Ambiguous Request:** If the user's request is too vague to formulate a plan (e.g., "/analyze_market finance"), the skill should not execute tool calls and instead respond by asking for a more specific query.

## Examples
### Example 1: Broad Market Outlook
*   **Input:** `/analyze_market Provide a market outlook based on current S&P 500 performance and US macro signals.`
*   **Execution:**
    1.  Discover available tools; confirm `get_market_index_performance` and `get_macroeconomic_indicator` are present. Plan to use both. Output format: Markdown (no "json" keyword).
    2.  **[MCP Tool Call]** `tradfi-tools.get_market_index_performance` with `{index: "SPX"}` → Write to `index_SPX.json`
    3.  **[MCP Tool Call]** `tradfi-tools.get_macroeconomic_indicator` with `{country: "USA", indicator: "CPI"}` → Write to `macro_USA_CPI.json`
    4.  **[MCP Tool Call]** `tradfi-tools.get_macroeconomic_indicator` with `{country: "USA", indicator: "Unemployment"}` → Write to `macro_USA_Unemployment.json`
    5.  **[Read]** Load all three JSON files into context. **[Self]** Extract index level/change, CPI value, and unemployment rate directly from the loaded data.
    6.  Write a summary to `analysis_report.md`. The summary must explicitly state how CPI and unemployment contextualize the index's current performance.
*   **Output (`analysis_report.md`):** A markdown report summarizing the S&P 500's recent performance alongside the latest CPI and unemployment figures, with a concluding paragraph that connects these data points (e.g., how inflation levels influence index direction).

### Example 2: Arbitrage Check
*   **Input:** `/analyze_market Are there any arbitrage opportunities for BTC-USD between Coinbase and Kraken?`
*   **Execution:**
    1.  Discover available tools; confirm `get_order_book` is present. Plan to call it twice. Output format: Markdown (no "json" keyword).
    2.  **[MCP Tool Call]** `tradfi-tools.get_order_book` with `{ticker: "BTC-USD", exchange: "Coinbase"}` → Write to `order_book_BTC-USD_Coinbase.json`
    3.  **[MCP Tool Call]** `tradfi-tools.get_order_book` with `{ticker: "BTC-USD", exchange: "Kraken"}` → Write to `order_book_BTC-USD_Kraken.json`
    4.  **[Read]** Load both JSON files into context. **[Self]** Extract the highest bid from Coinbase and the lowest ask from Kraken (and vice versa). Compute the spread numerically in-context.
    5.  Write the conclusion to `analysis_report.md`, including the exact numeric spread value.
*   **Output (`analysis_report.md`):** A report stating the best bid/ask on each exchange, the calculated numeric spread (e.g., "Spread: $42.50"), and a conclusion on whether a profitable arbitrage opportunity exists (ignoring fees).

### Example 3: Technical Analysis
*   **Input:** `/analyze_market Calculate the 50-day moving average for TSLA and provide the result in JSON.`
*   **Execution:**
    1.  Discover available tools; confirm `get_price_history` is present. Plan to use it. Output format: **JSON** (request contains "JSON").
    2.  **[MCP Tool Call]** `tradfi-tools.get_price_history` with `{ticker: "TSLA", period: "50d"}` → Write to `price_history_TSLA.json`
    3.  **[Read]** Load `price_history_TSLA.json` into context. **[Self]** Extract all `close` values from the array, sum them, divide by count to compute the moving average. Record the exact numeric result.
    4.  Format the final result into the specified JSON structure in `analysis_report.json`.
*   **Output (`analysis_report.json`):** A JSON object containing the ticker, the analysis type, the period (50d), and the calculated moving average value.