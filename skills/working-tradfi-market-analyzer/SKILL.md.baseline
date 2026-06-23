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

## Execution Steps
1.  **Initialization and Planning:**
    *   **[Bash]** Create the working directory: `mkdir -p ~/.remote/@autoresearch/skills/working-tradfi-market-analyzer/`
    *   **[Self]** Parse the user's request to determine the required analysis type(s):
        *   Single Price Fetch (e.g., "price for AAPL")
        *   Technical Analysis (e.g., "moving average for TSLA")
        *   Arbitrage Scan (e.g., "arbitrage for BTC between Coinbase and Kraken")
        *   Macroeconomic Summary (e.g., "CPI data for the United States")
        *   Broad Market Outlook / Comparison (e.g., "S&P 500 outlook", "gold vs. dollar")
    *   **[Write]** Create a `plan.md` file in the working directory outlining the chosen analysis types and the specific tools that will be used.

2.  **Data Gathering:** Based on `plan.md`, execute the necessary `tradfi-tools` commands. Save the output of each command to a separate JSON file for later processing.
    *   **For Price/Technical Analysis:**
        *   **[Bash]** `tradfi-tools.get_price_history --ticker="[TICKER]" --period="[e.g., 50d]" > price_history_[TICKER].json`
    *   **For Arbitrage Scan:**
        *   **[Bash]** `tradfi-tools.get_order_book --ticker="[TICKER]" --exchange="[EXCHANGE_1]" > order_book_[TICKER]_[EXCHANGE_1].json`
        *   **[Bash]** `tradfi-tools.get_order_book --ticker="[TICKER]" --exchange="[EXCHANGE_2]" > order_book_[TICKER]_[EXCHANGE_2].json`
    *   **For Macroeconomic Summary:**
        *   **[Bash]** `tradfi-tools.get_macroeconomic_indicator --country="[COUNTRY]" --indicator="[INDICATOR]" > macro_[COUNTRY]_[INDICATOR].json`
    *   **For Broad Market/Index Analysis:**
        *   **[Bash]** `tradfi-tools.get_market_index_performance --index="[INDEX]" > index_[INDEX].json`
        *   **[Bash]** `tradfi-tools.get_top_movers --market="[MARKET]" > top_movers_[MARKET].json`

3.  **Data Processing and Analysis:**
    *   **[Read, Bash]** For **Technical Analysis**, read the `price_history_*.json` file. Use a tool like `jq` combined with `awk` or a small Python script to calculate the required metric (e.g., moving average).
        *   Example: `cat price_history_TSLA.json | jq '.[].close' | awk '{sum+=$1} END {print sum/NR}' > moving_average_TSLA.txt`
    *   **[Read, Bash]** For **Arbitrage Scan**, read the two `order_book_*.json` files. Use `jq` to extract the highest bid from one and the lowest ask from the other. Compare them to identify any potential spread.
        *   Example: `bid1=$(cat order_book_BTC_Coinbase.json | jq '.bids[0][0]')`, `ask2=$(cat order_book_BTC_Kraken.json | jq '.asks[0][0]')`. Then compare `$bid1` and `$ask2`.
    *   **[Read, Grep]** For all other analysis types, read the relevant JSON files and extract the key data points needed for the final report.

4.  **Synthesis and Report Generation:**
    *   **[Self]** Aggregate all processed data and intermediate results (e.g., the calculated moving average, the arbitrage spread).
    *   **[Self]** Formulate a coherent summary that connects the different data points. For a broad market outlook, synthesize the index performance with the macroeconomic signals.
    *   **[Write]** Create the final output file, `analysis_report.md` or `analysis_report.json`, in the working directory. Structure the report logically with clear headings.

## Output Format
The primary output is a markdown file, `analysis_report.md`, placed in the working directory. If the request explicitly asks for structured data, a `analysis_report.json` file should be generated instead.

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
2.  **Arbitrage Analyzed:** If arbitrage was requested, the report must compare data from two exchanges and state a clear conclusion (e.g., "Arbitrage opportunity identified" or "No significant arbitrage opportunity found").
3.  **Macro Indicators Included:** If macro analysis was requested, the report must contain the specific indicators for the requested country.
4.  **Signals Aggregated:** For broad outlooks, the "Overall Summary" section must exist and synthesize data from at least two different sources (e.g., price data and macro data).
5.  **Technical Analysis Performed:** If a technical indicator was requested, its calculated value must be present in the report.
6.  **Structured Output:** The final output file (`analysis_report.md` or `analysis_report.json`) must exist, be well-formatted, and located in the working directory.

## Integration Points
*   **Upstream:** This skill consumes data exclusively from the `tradfi-tools` MCP domain. It is triggered by user prompts or other skills in the autoresearch ecosystem that require financial context.
*   **Downstream:** The generated `analysis_report.md` can be used as input for a `report-generator` skill to create more formal documents, or a `decision-maker` skill to inform automated strategies. The structured JSON output can be used to update the `world-model.json` with the latest market state.

## Error Handling
*   **Tool Failure:** If any `tradfi-tools` command fails (e.g., API error, invalid ticker), the skill should log the error, explicitly mention the missing data in the final report (e.g., "Could not retrieve price history for TSLA due to a tool error."), and proceed with the rest of the analysis if possible.
*   **No Data Found:** If a tool returns empty or null data for a valid query, the report should state this clearly (e.g., "No macroeconomic data for 'CPI' was found for the specified country.").
*   **Ambiguous Request:** If the user's request is too vague to formulate a plan (e.g., "/analyze_market finance"), the skill should not execute tool calls and instead respond by asking for a more specific query.

## Examples
### Example 1: Broad Market Outlook
*   **Input:** `/analyze_market Provide a market outlook based on current S&P 500 performance and US macro signals.`
*   **Execution:**
    1.  Plan to use `get_market_index_performance` and `get_macroeconomic_indicator`.
    2.  `tradfi-tools.get_market_index_performance --index="SPX" > index_SPX.json`
    3.  `tradfi-tools.get_macroeconomic_indicator --country="USA" --indicator="CPI" > macro_USA_CPI.json`
    4.  `tradfi-tools.get_macroeconomic_indicator --country="USA" --indicator="Unemployment" > macro_USA_Unemployment.json`
    5.  Read the three JSON files, extract key figures, and write a summary to `analysis_report.md`.
*   **Output (`analysis_report.md`):** A markdown report summarizing the S&P 500's recent performance alongside the latest CPI and unemployment figures, with a concluding paragraph synthesizing these points.

### Example 2: Arbitrage Check
*   **Input:** `/analyze_market Are there any arbitrage opportunities for BTC-USD between Coinbase and Kraken?`
*   **Execution:**
    1.  Plan to use `get_order_book` twice.
    2.  `tradfi-tools.get_order_book --ticker="BTC-USD" --exchange="Coinbase" > order_book_BTC-USD_Coinbase.json`
    3.  `tradfi-tools.get_order_book --ticker="BTC-USD" --exchange="Kraken" > order_book_BTC-USD_Kraken.json`
    4.  Read both files, extract the highest bid from one and the lowest ask from the other, calculate the spread, and write the conclusion to `analysis_report.md`.
*   **Output (`analysis_report.md`):** A report stating the best bid/ask on each exchange, the calculated spread, and a conclusion on whether a profitable arbitrage opportunity exists (ignoring fees).

### Example 3: Technical Analysis
*   **Input:** `/analyze_market Calculate the 50-day moving average for TSLA and provide the result in JSON.`
*   **Execution:**
    1.  Plan to use `get_price_history`.
    2.  `tradfi-tools.get_price_history --ticker="TSLA" --period="50d" > price_history_TSLA.json`
    3.  Process `price_history_TSLA.json` using `jq` and `awk` to calculate the average of the closing prices.
    4.  Format the final result into the specified JSON structure in `analysis_report.json`.
*   **Output (`analysis_report.json`):** A JSON object containing the ticker, the analysis type, the period (50d), and the calculated moving average value.