# SKILL: eaas-payment-linker
**DESCRIPTION:** Creates a unique payment link for a specified service and amount using the 'eaas' platform tools.

## Purpose
This skill exists to activate the `eaas:monetization_platform` data stream, which is currently connected but unused. As outlined in `want-023`, this represents a major missed opportunity for autonomous value capture. By enabling the creation of payment links, this skill provides the foundational capability for the agent system to monetize services, complete transactions, and directly engage in economic activities.

## Trigger Conditions
This skill can be activated in the following ways:

1.  **Slash Command (Primary):**
    *   `/create-payment-link --service <SERVICE_ID> --amount <AMOUNT> --currency <CURRENCY_CODE>`
    *   Example: `/create-payment-link --service S-123 --amount 19.99 --currency USD`

2.  **Keywords:**
    *   The agent should recognize natural language requests like:
        *   "Generate a payment link for..."
        *   "Create an invoice for service..."
        *   "Request payment for..."
        *   "Bill the user for..."

3.  **Automatic Detection:**
    *   Triggered by other skills or system states that conclude a transaction is ready for payment. For example, after a `service-provisioner` skill successfully configures a service for a user.

## Prerequisites
Before execution, the following conditions must be met:

1.  **Tool Availability:** The `eaas` command-line tool must be available in the system's `PATH`. Verify its presence by checking the `world-model.json` for the `eaas:monetization_platform` domain.
    *   **Tool:** `Read`, `Grep`
    *   **Command:** `grep "eaas:monetization_platform" ~/.remote/@autoresearch/world-model.json`
2.  **Authentication:** A valid API key must be configured. The skill must check for the existence of the `EaaS_API_KEY` environment variable.
    *   **Tool:** `Bash`
    *   **Command:** `printenv EaaS_API_KEY` (The command should produce non-empty output).
3.  **Valid Inputs:** The trigger must provide three valid arguments:
    *   `service_id`: A non-empty string.
    *   `amount`: A positive numerical value.
    *   `currency`: A 3-letter ISO 4217 currency code (e.g., USD, EUR, GBP).

## Execution Steps
1.  **Setup Working Directory:** Tear down any previous working directory (which may contain stale `response.json` or `error.log` from a prior failed run) and create a fresh one.
    *   **Tool:** `Bash`
    *   **Command:** `rm -rf ~/.remote/@autoresearch/skills/working-eaas-payment-linker/ && mkdir -p ~/.remote/@autoresearch/skills/working-eaas-payment-linker/`

2.  **Parse and Validate Inputs:**
    *   Extract `service_id`, `amount`, and `currency` from the trigger command or context.
    *   Validate that `amount` is a number greater than zero.
    *   Validate that `currency` is a 3-character uppercase string.
    *   If validation fails, terminate execution and report an "Invalid Input" error (see Error Handling).

3.  **Construct API Command:** Assemble the `eaas` tool command using the validated inputs. The expected command format is: `eaas create-link --service-id "<service_id>" --amount <amount> --currency <currency> --api-key "$EaaS_API_KEY" --output json`
    *   **Example:** `eaas create-link --service-id "S-123" --amount 19.99 --currency "USD" --api-key "$EaaS_API_KEY" --output json`

4.  **Execute API Call:** Run the command, passing the API key explicitly via `--api-key`, redirecting standard output to `response.json` and standard error to `error.log`.
    *   **Tool:** `Bash`
    *   **Command:** `cd ~/.remote/@autoresearch/skills/working-eaas-payment-linker/ && eaas create-link --service-id "<service_id>" --amount <amount> --currency <currency> --api-key "$EaaS_API_KEY" --output json > response.json 2> error.log`

5.  **Process Response:**
    *   Check the exit code of the previous command.
    *   **If exit code is 0 (Success):**
        *   Read the contents of `response.json`. (Tool: `Read`)
        *   Extract each required field using `jq` — do NOT rely on implicit JSON parsing:
            *   **Tool:** `Bash`
            *   ```bash
                cd ~/.remote/@autoresearch/skills/working-eaas-payment-linker/
                PAYMENT_URL=$(jq -r '.payment_url' response.json)
                LINK_ID=$(jq -r '.link_id' response.json)
                RESP_SERVICE_ID=$(jq -r '.service_id' response.json)
                RESP_AMOUNT=$(jq -r '.amount' response.json)
                RESP_CURRENCY=$(jq -r '.currency' response.json)
                echo "payment_url=$PAYMENT_URL link_id=$LINK_ID service_id=$RESP_SERVICE_ID amount=$RESP_AMOUNT currency=$RESP_CURRENCY"
                ```
        *   **Null-check:** After extraction, verify that NONE of the variables equal `null` or are empty string. Run:
            *   **Tool:** `Bash`
            *   ```bash
                for VAR in "$PAYMENT_URL" "$LINK_ID" "$RESP_SERVICE_ID" "$RESP_AMOUNT" "$RESP_CURRENCY"; do
                  if [ -z "$VAR" ] || [ "$VAR" = "null" ]; then
                    echo "PARSE_FAILURE: one or more required fields missing from response.json" >&2
                    exit 1
                  fi
                done
                ```
            *   If this check fails, treat as a parse failure and report an API error (do NOT proceed to Step 6).
        *   Proceed to Step 6 using the extracted shell variable values.
    *   **If exit code is not 0 (Failure):**
        *   Read the contents of `error.log`. (Tool: `Read`)
        *   Initiate the error handling protocol for API errors.

6.  **Log Transaction:**
    *   Create a single-line JSON object containing the essential details of the successful transaction: `timestamp`, `request_id`, `link_id`, `payment_url`, `service_id`, `amount`, `currency`.
    *   Append this JSON line to the central transaction log using `Bash` with `>>` to ensure the file is created if it does not exist.
    *   **Tool:** `Bash`
    *   **Command:** `mkdir -p ~/.remote/@autoresearch/logs && echo '{"timestamp": "<timestamp>", "request_id": "<request_id>", "link_id": "<link_id>", "payment_url": "<payment_url>", "service_id": "<service_id>", "amount": <amount>, "currency": "<currency>"}' >> ~/.remote/@autoresearch/logs/payment_links.jsonl`

7.  **Format and Deliver Output:**
    *   Present the final result in the specified output format.
    *   Clean up the working directory.
    *   **Tool:** `Bash`
    *   **Command:** `rm -rf ~/.remote/@autoresearch/skills/working-eaas-payment-linker/`

## Output Format
The skill must produce two forms of output:

1.  **Structured Output (for other skills):** A JSON object printed to STDOUT containing the key details of the generated link.
    ```json
    {
      "status": "success",
      "data": {
        "link_id": "pl_xyz789",
        "payment_url": "https://pay.eaas.com/link/xyz789",
        "service_id": "S-123",
        "amount": 19.99,
        "currency": "USD",
        "created_at": "2023-10-27T10:00:00Z"
      }
    }
    ```
2.  **Human-Readable Output (for console):** A clear, concise message.
    *   `Successfully created payment link for service S-123 ($19.99 USD): https://pay.eaas.com/link/xyz789`

## Quality Gates
Before marking the skill execution as complete, perform these validation checks:

1.  **Authentication Success:** The `eaas` command must complete with exit code 0. An exit code of 1 or higher with an "authentication failed" message in `error.log` is a failure.
2.  **URL Validity:** The `payment_url` in the `response.json` must be a valid, well-formed HTTPS URL.
3.  **Service ID Match:** The `service_id` in the `response.json` must exactly match the `service_id` provided as input.
4.  **Amount/Currency Match:** The `amount` and `currency` in the `response.json` must exactly match the values provided as input.
5.  **Graceful Error Handling:** When tested with a non-existent service ID (e.g., 'S-999'), the skill must not crash. It should correctly identify the API error from `error.log` and produce a structured error output.
6.  **Log Persistence:** After a successful run, the `payment_links.jsonl` file must contain a new line corresponding to the generated link. Verify by reading the last line of the file.

## Integration Points
*   **Upstream:** This skill can be called by other skills like `service-provisioner` or `sales-negotiator` once a service agreement has been reached. The input parameters (`service_id`, `amount`, `currency`) will be provided by the calling skill.
*   **Downstream:** The `link_id` from the structured output can be passed to the `eaas-payment-verifier` skill to check the payment status. The `payment_url` can be passed to a `notification-sender` skill to deliver the link to a user via email or another channel.
*   **Data Model:** The skill contributes to the `payment_links.jsonl` log file, which serves as a system-wide ledger of all payment transactions initiated. This log can be used by `reporting` or `analytics` skills.

## Error Handling
*   **Invalid Input:** If `amount` is <= 0 or `currency` is not a valid format, terminate and output:
    ```json
    {
      "status": "error",
      "message": "Invalid input. Amount must be positive and currency must be a 3-letter ISO code."
    }
    ```
*   **Authentication Failure:** If the `EaaS_API_KEY` is missing or invalid, the `eaas` tool will fail. Detect this from `error.log` (e.g., "401 Unauthorized"). Output:
    ```json
    {
      "status": "error",
      "message": "Authentication failed. Check EaaS_API_KEY configuration."
    }
    ```
*   **API Errors (e.g., Invalid Service ID):** If the API returns an error (e.g., "Service not found"), parse the message from `error.log`. Output:
    ```json
    {
      "status": "error",
      "message": "API Error: Service ID 'S-999' not found."
    }
    ```
*   **Network/Timeout:** If the command fails without a clear API error, assume a transient issue. Output:
    ```json
    {
      "status": "error",
      "message": "Request failed due to a network error or timeout. Please try again."
    }
    ```

## Examples
### Example 1: Standard USD Payment
*   **Trigger:** `/create-payment-link --service S-123 --amount 10.00 --currency USD`
*   **STDOUT:**
    ```json
    {
      "status": "success",
      "data": {
        "link_id": "pl_abc123",
        "payment_url": "https://pay.eaas.com/link/abc123",
        "service_id": "S-123",
        "amount": 10.00,
        "currency": "USD",
        "created_at": "2023-10-27T10:05:00Z"
      }
    }
    ```
*   **Console:** `Successfully created payment link for service S-123 ($10.00 USD): https://pay.eaas.com/link/abc123`

### Example 2: Standard EUR Payment
*   **Trigger:** `/create-payment-link --service S-456 --amount 50 --currency EUR`
*   **STDOUT:**
    ```json
    {
      "status": "success",
      "data": {
        "link_id": "pl_def456",
        "payment_url": "https://pay.eaas.com/link/def456",
        "service_id": "S-456",
        "amount": 50.00,
        "currency": "EUR",
        "created_at": "2023-10-27T10:06:15Z"
      }
    }
    ```
*   **Console:** `Successfully created payment link for service S-456 (€50.00 EUR): https://pay.eaas.com/link/def456`

### Example 3: Handling a Non-Existent Service
*   **Trigger:** `/create-payment-link --service S-999 --amount 25.00 --currency USD`
*   **STDOUT:**
    ```json
    {
      "status": "error",
      "message": "API Error: Service ID 'S-999' not found."
    }
    ```
*   **Console:** `Error: Failed to create payment link. API Error: Service ID 'S-999' not found.`