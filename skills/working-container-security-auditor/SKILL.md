# container-security-auditor
Scans a specified container image for known CVEs and common misconfigurations.

## Purpose
This skill addresses a critical capability gap identified in **want-017**. The core hypothesis is that the system lacks the ability to analyze or ensure its own security posture. This skill provides a direct, actionable method to perform security audits on containerized components, a foundational step towards achieving the strategic goal of `security-posture`. It directly fulfills user intent patterns for 'security audit' and enables the completion of tactical goals like "Run a security audit on the OpenClaw production container."

## Trigger Conditions
This skill should be activated under the following conditions:

*   **Slash Command:** `/scan-container <image_name_or_id> [--severity <level>] [--format <json|table>] [--output <file_path>]`
*   **Keywords:** When user prompts include phrases like:
    *   "scan container for vulnerabilities"
    *   "security audit for docker image"
    *   "check [image_name] for CVEs"
    *   "are there any misconfigurations in [image_name]?"
*   **Automatic Detection:** Triggered by the `tactical-planner` when a goal or sub-task explicitly requires a security audit of a containerized asset.

## Prerequisites
1.  **Tooling:** The `trivy` command-line tool must be installed and available in the system's `$PATH`.
2.  **System Access:** The agent must have sufficient permissions to interact with the container runtime (e.g., read access to the Docker socket at `/var/run/docker.sock`) or the Kubernetes cluster API (via a valid `kubeconfig`).
3.  **Target Specification:** A clear and unambiguous target must be provided. This can be:
    *   A container image name with an optional tag (e.g., `ubuntu:latest`, `nginx:1.21`).
    *   A local container image ID (e.g., `sha256:f64...`).
    *   A Kubernetes pod name and namespace, from which the image name will be derived (e.g., `pod/prod-api-server-5f4... -n production`).

## Execution Steps

1.  **[Bash] Initialization & Prerequisite Check:**
    *   Parse the input arguments: target image, severity filter, output format, and output file path.
    *   Check for the existence of the `trivy` executable. If not found, install it using the appropriate method for the current OS before proceeding.
    ```bash
    if ! command -v trivy &> /dev/null; then
        echo "Trivy not found. Attempting installation..."
        OS="$(uname -s)"
        if [ "$OS" = "Darwin" ]; then
            # macOS: use Homebrew
            if command -v brew &> /dev/null; then
                brew install trivy
            else
                echo "Error: Homebrew not found. Install trivy manually: https://aquasecurity.github.io/trivy/latest/getting-started/installation/"
                exit 1
            fi
        elif [ "$OS" = "Linux" ]; then
            # Linux: use the official install script
            curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
        else
            echo "Error: Unsupported OS '$OS'. Install trivy manually: https://aquasecurity.github.io/trivy/latest/getting-started/installation/"
            exit 1
        fi
        # Verify installation succeeded
        if ! command -v trivy &> /dev/null; then
            echo "Error: Trivy installation failed. Please install it manually and re-run the scan."
            exit 1
        fi
        echo "Trivy installed successfully."
    fi
    ```
    *   Update the `trivy` vulnerability database to ensure the latest definitions are used. This is crucial for accurate scans.
    ```bash
    trivy image --download-db-only
    ```

2.  **[Bash] Target Resolution:**
    *   Define a variable `INPUT_TARGET` which holds the full target string provided by the user (e.g., `nginx:latest`, `pod/prod-api-server -n namespace`). This variable will be populated by the system from the trigger arguments.
    *   Check if the target is a Kubernetes pod reference. If so, parse the pod name and namespace, then use `kubectl` to find the image name. Otherwise, assume the target is an image name/ID.
    ```bash
    # The system will populate INPUT_TARGET from the user's command.
    # For example: INPUT_TARGET="pod/prod-api-server-5f4... -n production"

    TARGET_IMAGE=""

    if [[ "$INPUT_TARGET" == pod/* ]]; then
        # Handle Kubernetes pod target
        # Expected format: "pod/<pod-name> [-n <namespace>]"
        POD_NAME=$(echo "$INPUT_TARGET" | sed -n 's;pod/\([^ ]*\).*;\1;p')
        NAMESPACE=$(echo "$INPUT_TARGET" | sed -n 's/.*-n \([^ ]*\).*/\1/p')

        if [ -z "$NAMESPACE" ]; then
            NAMESPACE="default"
        fi

        echo "Attempting to resolve image from Kubernetes pod '$POD_NAME' in namespace '$NAMESPACE'..."
        TARGET_IMAGE=$(kubectl get pod "$POD_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.containers[0].image}' 2>/dev/null)

        if [ -z "$TARGET_IMAGE" ]; then
            echo "Error: Could not resolve image for pod '$POD_NAME' in namespace '$NAMESPACE'. Check pod name, namespace, and kubectl permissions."
            exit 1
        fi
        echo "Resolved image from pod: $TARGET_IMAGE"
    else
        # Handle direct image name or ID
        TARGET_IMAGE="$INPUT_TARGET"
        echo "Target is a direct image reference: $TARGET_IMAGE"
    fi
    ```

3.  **[Bash] Execute Scan:**
    *   Construct the `trivy` command based on the parsed arguments. The base command should scan for both vulnerabilities and misconfigurations.
    *   **IMPORTANT:** Always use the fixed output filename `trivy-report.json` for the JSON report. This ensures all subsequent steps can reliably locate the file. Do not use dynamically-generated filenames with bash variables for this file — the fixed name is required for cross-step continuity.
    *   **IMPORTANT:** Always pass `--exit-code 0` to the trivy scan commands. This ensures trivy exits cleanly (code 0) even when vulnerabilities are found, so the skill continues to generate reports. Trivy's default behavior is to exit with code 1 when vulnerabilities are discovered, which would abort the skill before any output is produced. The exit code is not an indicator of scan failure — only stderr output or a code ≥2 indicates a true scan error.
    *   **Scan strategy:** Attempt the full scan (vulnerabilities + misconfigurations) first. If `trivy-report.json` is not produced or is empty after the first attempt, fall back to a vulnerability-only scan. This handles environments where the `config` scanner is unavailable or incompatible.
    *   **Attempt 1: Full scan (vulnerabilities + misconfigurations):**
    ```bash
    trivy image --exit-code 0 --format json --scanners vuln,config --output trivy-report.json "$TARGET_IMAGE"
    # Verify output was produced
    if [ ! -s trivy-report.json ]; then
        echo "Warning: Full scan (vuln+config) produced no output. Retrying with vulnerability-only scan..."
        trivy image --exit-code 0 --format json --scanners vuln --output trivy-report.json "$TARGET_IMAGE"
    fi
    # Final check
    if [ ! -s trivy-report.json ]; then
        echo "Error: Scan produced no output file. Check that the image '$TARGET_IMAGE' is accessible."
        exit 2
    fi
    echo "JSON report written to: trivy-report.json"
    ```
    *   For a filtered, human-readable table view for the console (run after confirming `trivy-report.json` exists):
    ```bash
    SEVERITY_FILTER=${1:-"CRITICAL,HIGH"} # Default to CRITICAL,HIGH if not specified
    trivy image --exit-code 0 --format table --scanners vuln,config --severity "$SEVERITY_FILTER" "$TARGET_IMAGE" 2>/dev/null || \
    trivy image --exit-code 0 --format table --scanners vuln --severity "$SEVERITY_FILTER" "$TARGET_IMAGE"
    ```

4.  **[Read, Grep] Process Results & Identify Key Findings:**
    *   **Read the file `trivy-report.json`** (this fixed filename is always used in Step 3 above).
    *   The trivy JSON schema has the structure: `{ "Results": [ { "Target": "...", "Vulnerabilities": [ { "VulnerabilityID": "CVE-...", "PkgName": "...", "InstalledVersion": "...", "FixedVersion": "...", "Severity": "CRITICAL|HIGH|MEDIUM|LOW|UNKNOWN", "Description": "..." } ], "Misconfigurations": [ { "ID": "...", "Title": "...", "Severity": "...", "Message": "..." } ] } ] }`.
    *   Identify the count of vulnerabilities for each severity level (CRITICAL, HIGH, MEDIUM, LOW) by inspecting `Results[*].Vulnerabilities[*].Severity`.
    *   Identify the top 3 most severe findings (prioritizing CRITICAL, then HIGH). Note their CVE ID (`VulnerabilityID`), vulnerable package name (`PkgName`), installed version (`InstalledVersion`), and fixed version (`FixedVersion`).
    *   Check `Results[*].Misconfigurations` for common misconfigurations, such as the container running as the `root` user (look for `"Title"` containing "root" or `"ID"` like `DS002`). If the JSON was produced by a vuln-only fallback scan (no `Misconfigurations` key present), note that misconfiguration data was unavailable and explicitly state "No misconfiguration data available (config scanner not supported in this environment)."

5.  **[Bash, Write] Generate Remediation Advice & Summary:**
    *   For the top 3 severe findings identified in the previous step, formulate actionable remediation advice.
        *   **Example for an outdated package:** "Remediation: Update the package `openssl` from version `1.1.1n-r0` to `1.1.1s-r0` in the Dockerfile."
        *   **Example for a base image CVE:** "Remediation: The vulnerability is in the base image. Update the `FROM` instruction in the Dockerfile to a newer, patched version (e.g., `FROM ubuntu:22.04.3`)."
        *   **Example for a misconfiguration:** "Remediation: The container is configured to run as root. Add a `USER` instruction in the Dockerfile to switch to a non-root user (e.g., `USER 1001`)."
    *   Derive a timestamp-based summary filename: `scan-summary-<image_name_sanitized>-<timestamp>.md` (sanitize image name by replacing `:`, `/`, `@` with `_`).
    *   **[Write]** Write the summary markdown file, including:
        *   Target Image
        *   Scan Timestamp
        *   Vulnerability Summary (Counts by severity)
        *   Top 3 High-Severity Findings with detailed remediation advice.
        *   Misconfiguration Findings with remediation advice (or note if unavailable).
        *   A link to the full JSON report (`trivy-report.json`).

6.  **[Write] Update World Model:**
    *   Update `~/.remote/@autoresearch/world-model.json` to reflect the security posture of the scanned asset.
    ```json
    {
      "assets": {
        "containerImages": {
          "nginx:latest": {
            "lastScanTimestamp": "...",
            "vulnerabilities": {
              "critical": 5,
              "high": 12
            },
            "reportPath": "trivy-report.json"
          }
        }
      }
    }
    ```

## Output Format
*   **Primary Artifact (Machine-Readable):** A JSON file named `trivy-report.json` (fixed filename) containing the complete, raw output from `trivy`.
*   **Secondary Artifact (Human-Readable):** A Markdown file named `scan-summary-<image_name>-<timestamp>.md` containing a high-level summary, key findings, and actionable remediation steps.
*   **Console Output:** A brief message indicating scan completion, a summary of critical/high findings, and the paths to the generated report files.

## Quality Gates
Before marking the skill as complete, verify the following:
1.  The `trivy` scan command completed without a true scan error. Because `--exit-code 0` is always passed, trivy will exit with code 0 regardless of whether vulnerabilities were found. A true scan failure is indicated by exit code ≥2 or by trivy writing an error to stderr (e.g., image not found, network failure). Exit code 0 or 1 (without `--exit-code 0`) both indicate a successful scan.
2.  The JSON output file `trivy-report.json` was created, is not empty (use `[ -s trivy-report.json ]` to verify), and contains a valid JSON structure with a `Results` key.
3.  The summary markdown file (`scan-summary-*.md`) was created and contains sections for "Vulnerability Summary" and "Remediation Advice".
4.  If CRITICAL or HIGH vulnerabilities were found, the summary file explicitly lists at least one actionable remediation step.
5.  The `world-model.json` has been updated with an entry for the scanned image.

## Integration Points
*   **tactical-planner:** This skill is a primary tool for executing any security-related tactical goals. The planner can invoke this skill with the appropriate target.
*   **code-editor / dockerfile-modifier:** The remediation advice generated by this skill can be passed as a prompt to a code-editing skill to automatically patch Dockerfiles.
*   **vulnerability-tracker:** The output JSON (`trivy-report.json`) can be fed into a separate skill that tracks vulnerabilities over time, identifies trends, and raises alerts for newly discovered CVEs in previously scanned images.
*   **reporting-generator:** The summary markdown can be ingested by a reporting skill to be included in periodic system health and security reports.

## Error Handling
*   **Image Not Found:** If `trivy` or `docker` fails to find the image, log a clear error message "Error: Target image '<image_name>' not found locally or in remote registries." and terminate gracefully.
*   **Tool Not Found:** If `trivy` is not installed and automatic installation fails, exit with a message instructing the user on how to install it manually: `https://aquasecurity.github.io/trivy/latest/getting-started/installation/`
*   **Permission Denied:** If the scan fails due to permissions (e.g., cannot connect to Docker socket), report the error and suggest checking user permissions (e.g., "Error: Permission denied while trying to connect to the Docker daemon socket. Ensure the agent is running with appropriate permissions or is part of the 'docker' group.").
*   **Scan Failure:** If `trivy` exits with code ≥2 or writes a fatal error to stderr, capture `stderr`, log it, and report a generic scan failure. Note: exit code 1 without `--exit-code 0` simply means vulnerabilities were found and is not a failure.
*   **Config Scanner Unavailable:** If `--scanners vuln,config` produces no output (empty or missing `trivy-report.json`), automatically retry with `--scanners vuln`. Log a warning: "Config scanner unavailable; falling back to vulnerability-only scan." The skill must still produce a complete JSON report and summary in this case.

## Examples

### Example 1: Scan `nginx:latest` and filter for high-severity issues
*   **Command:** `/scan-container nginx:latest --severity HIGH,CRITICAL`
*   **Execution:**
    1.  Agent sets `INPUT_TARGET="nginx:latest"`. Since it does not start with `pod/`, sets `TARGET_IMAGE="nginx:latest"`.
    2.  Agent runs `trivy image --exit-code 0 --severity HIGH,CRITICAL nginx:latest`.
    3.  Agent runs `trivy image --exit-code 0 --format json --scanners vuln,config --output trivy-report.json nginx:latest`.
    4.  Agent verifies `trivy-report.json` is non-empty; if empty, retries with `--scanners vuln`.
    5.  Agent reads `trivy-report.json` and parses `Results[*].Vulnerabilities[*]` to find the top 3 findings.
    6.  Agent generates `scan-summary-nginx_latest-....md` with remediation for the top findings.
*   **Output (Console):**
    ```
    Scan complete for nginx:latest.
    Found: 3 CRITICAL, 8 HIGH vulnerabilities.
    Summary report saved to: scan-summary-nginx_latest-1678886400.md
    Full JSON report saved to: trivy-report.json
    ```

### Example 2: Generate a full JSON report for a local image
*   **Command:** `/scan-container f64e70b92a98 --format json --output /tmp/ubuntu_scan.json`
*   **Execution:**
    1.  Agent sets `INPUT_TARGET="f64e70b92a98"`. Since it does not start with `pod/`, sets `TARGET_IMAGE="f64e70b92a98"`.
    2.  Agent runs `trivy image --exit-code 0 --format json --scanners vuln,config --output trivy-report.json f64e70b92a98`.
    3.  Agent verifies `trivy-report.json` is non-empty; retries with `--scanners vuln` if needed.
    4.  If `--output /tmp/ubuntu_scan.json` was specified, copy `trivy-report.json` to that path as well.
*   **Output (Console):**
    ```
    Scan complete for image f64e70b92a98.
    Full JSON report saved to: trivy-report.json
    ```

### Example 3: Scan a production container from a Kubernetes pod
*   **Command:** `security audit for pod/prod-frontend-7ff... in namespace 'production'`
*   **Execution:**
    1.  Agent's keyword detection triggers the skill.
    2.  Agent sets `INPUT_TARGET="pod/prod-frontend-7ff... -n production"`.
    3.  Since `INPUT_TARGET` starts with `pod/`, the script parses: `POD_NAME="prod-frontend-7ff..."`, `NAMESPACE="production"`.
    4.  Agent runs `kubectl get pod prod-frontend-7ff... -n production -o jsonpath='{.spec.containers[0].image}'` to get `TARGET_IMAGE="my-registry/frontend:v2.3.1"`.
    5.  Agent runs a full scan on `my-registry/frontend:v2.3.1` with `--exit-code 0`, writing output to `trivy-report.json`.
    6.  Agent reads `trivy-report.json` and verifies it is non-empty before proceeding.
    7.  Agent updates the `world-model.json` with the results.
*   **Output (Console):**
    ```
    Resolved image 'my-registry/frontend:v2.3.1' from pod 'prod-frontend-7ff...'.
    Starting security scan...
    Scan complete. Found: 0 CRITICAL, 2 HIGH vulnerabilities.
    Summary report saved to: scan-summary-frontend_v2.3.1-1678886800.md
    Full JSON report saved to: trivy-report.json
    ```