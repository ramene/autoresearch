# Promotion Proposal: eaas-payment-linker

## Scores
- **Baseline**: 27/36
- **Current**: 36/36
- **Improvement**: +9 points (100.0%)
- **Rounds**: 6

## Promotion Target
`/Users/ramene/Journal/.seed/base/skills/eaas-payment-linker/SKILL.md`

## Key Mutations That Improved Score
1. Add `--api-key "$EaaS_API_KEY"` to the eaas create-link command in Execution Step 4, so the authenticated credential is actually passed to the API call (currently only checked via printenv but never used).
2. Replace Edit tool with Bash `>>` append in Step 6 (Log Transaction) to handle the case where payment_links.jsonl doesn't exist yet, preventing silent log failures on first run.
3. Add explicit `jq` commands in Step 5 to extract payment_url, link_id, service_id, amount, and currency from response.json into shell variables, replacing the vague "parse the JSON" instruction that causes agents to fail silently on field extraction.
4. In Step 1, replace `mkdir -p` with `rm -rf ... && mkdir -p ...` to purge stale response.json/error.log from any previous failed run before each execution begins.
5. No failures exist (36/36 score) — apply a minor defensive improvement: add explicit null-check step after jq extraction to prevent silent pass-through when response.json fields are missing or null.

## Unified Diff (baseline -> current)
```diff
--- /Users/ramene/.remote/@autoresearch/skills/working-eaas-payment-linker/SKILL.md.baseline	2026-03-20 11:28:18.000000000 -0600
+++ /Users/ramene/.remote/@autoresearch/skills/working-eaas-payment-linker/SKILL.md	2026-03-20 12:09:55.000000000 -0600
@@ -36,9 +36,9 @@
     *   `currency`: A 3-letter ISO 4217 currency code (e.g., USD, EUR, GBP).
 
 ## Execution Steps
-1.  **Setup Working Directory:** Create a dedicated directory for this task instance.
+1.  **Setup Working Directory:** Tear down any previous working directory (which may contain stale `response.json` or `error.log` from a prior failed run) and create a fresh one.
     *   **Tool:** `Bash`
-    *   **Command:** `mkdir -p ~/.remote/@autoresearch/skills/working-eaas-payment-linker/`
+    *   **Command:** `rm -rf ~/.remote/@autoresearch/skills/working-eaas-payment-linker/ && mkdir -p ~/.remote/@autoresearch/skills/working-eaas-payment-linker/`
 
 2.  **Parse and Validate Inputs:**
     *   Extract `service_id`, `amount`, and `currency` from the trigger command or context.
@@ -46,29 +46,49 @@
     *   Validate that `currency` is a 3-character uppercase string.
     *   If validation fails, terminate execution and report an "Invalid Input" error (see Error Handling).
 
-3.  **Construct API Command:** Assemble the `eaas` tool command using the validated inputs. The expected command format is: `eaas create-link --service-id "<service_id>" --amount <amount> --currency <currency> --output json`
-    *   **Example:** `eaas create-link --service-id "S-123" --amount 19.99 --currency "USD" --output json`
+3.  **Construct API Command:** Assemble the `eaas` tool command using the validated inputs. The expected command format is: `eaas create-link --service-id "<service_id>" --amount <amount> --currency <currency> --api-key "$EaaS_API_KEY" --output json`
+    *   **Example:** `eaas create-link --service-id "S-123" --amount 19.99 --currency "USD" --api-key "$EaaS_API_KEY" --output json`
 
-4.  **Execute API Call:** Run the command, redirecting standard output to `response.json` and standard error to `error.log`.
+4.  **Execute API Call:** Run the command, passing the API key explicitly via `--api-key`, redirecting standard output to `response.json` and standard error to `error.log`.
     *   **Tool:** `Bash`
-    *   **Command:** `cd ~/.remote/@autoresearch/skills/working-eaas-payment-linker/ && eaas create-link --service-id "<service_id>" --amount <amount> --currency <currency> --output json > response.json 2> error.log`
+    *   **Command:** `cd ~/.remote/@autoresearch/skills/working-eaas-payment-linker/ && eaas create-link --service-id "<service_id>" --amount <amount> --currency <currency> --api-key "$EaaS_API_KEY" --output json > response.json 2> error.log`
 
 5.  **Process Response:**
     *   Check the exit code of the previous command.
     *   **If exit code is 0 (Success):**
         *   Read the contents of `response.json`. (Tool: `Read`)
-        *   Parse the JSON and extract the `payment_url`, `link_id`, `service_id`, `amount`, and `currency`.
-        *   Proceed to Step 6.
+        *   Extract each required field using `jq` — do NOT rely on implicit JSON parsing:
+            *   **Tool:** `Bash`
+            *   ```bash
+                cd ~/.remote/@autoresearch/skills/working-eaas-payment-linker/
+                PAYMENT_URL=$(jq -r '.payment_url' response.json)
+                LINK_ID=$(jq -r '.link_id' response.json)
+                RESP_SERVICE_ID=$(jq -r '.service_id' response.json)
+                RESP_AMOUNT=$(jq -r '.amount' response.json)
+                RESP_CURRENCY=$(jq -r '.currency' response.json)
+                echo "payment_url=$PAYMENT_URL link_id=$LINK_ID service_id=$RESP_SERVICE_ID amount=$RESP_AMOUNT currency=$RESP_CURRENCY"
+                ```
+        *   **Null-check:** After extraction, verify that NONE of the variables equal `null` or are empty string. Run:
+            *   **Tool:** `Bash`
+            *   ```bash
+                for VAR in "$PAYMENT_URL" "$LINK_ID" "$RESP_SERVICE_ID" "$RESP_AMOUNT" "$RESP_CURRENCY"; do
+                  if [ -z "$VAR" ] || [ "$VAR" = "null" ]; then
+                    echo "PARSE_FAILURE: one or more required fields missing from response.json" >&2
+                    exit 1
+                  fi
+                done
+                ```
+            *   If this check fails, treat as a parse failure and report an API error (do NOT proceed to Step 6).
+        *   Proceed to Step 6 using the extracted shell variable values.
     *   **If exit code is not 0 (Failure):**
         *   Read the contents of `error.log`. (Tool: `Read`)
         *   Initiate the error handling protocol for API errors.
 
 6.  **Log Transaction:**
     *   Create a single-line JSON object containing the essential details of the successful transaction: `timestamp`, `request_id`, `link_id`, `payment_url`, `service_id`, `amount`, `currency`.
-    *   Append this JSON line to the central transaction log.
-    *   **Tool:** `Edit`
-    *   **File:** `~/.remote/@autoresearch/logs/payment_links.jsonl`
-    *   **Content (Example):** `{"timestamp": "2023-10-27T10:00:00Z", "request_id": "req_abc123", "link_id": "pl_xyz789", "payment_url": "https://pay.eaas.com/link/xyz789", "service_id": "S-123", "amount": 19.99, "currency": "USD"}`
+    *   Append this JSON line to the central transaction log using `Bash` with `>>` to ensure the file is created if it does not exist.
+    *   **Tool:** `Bash`
+    *   **Command:** `mkdir -p ~/.remote/@autoresearch/logs && echo '{"timestamp": "<timestamp>", "request_id": "<request_id>", "link_id": "<link_id>", "payment_url": "<payment_url>", "service_id": "<service_id>", "amount": <amount>, "currency": "<currency>"}' >> ~/.remote/@autoresearch/logs/payment_links.jsonl`
 
 7.  **Format and Deliver Output:**
     *   Present the final result in the specified output format.

```

## Generated
- **Timestamp**: 2026-03-25T23:17:48.927Z
- **Source**: `/Users/ramene/.remote/@autoresearch/skills/working-eaas-payment-linker/SKILL.md`
- **Baseline**: `/Users/ramene/.remote/@autoresearch/skills/working-eaas-payment-linker/SKILL.md.baseline`
