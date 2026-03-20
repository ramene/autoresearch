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
    *   Check for the existence of the `trivy` executable.
    ```bash
    if ! command -v trivy &> /dev/null; then
        echo "Trivy not found. Attempting installation..."
        # Add installation logic for common package managers, e.g., apt, yum, brew
        # If installation fails, exit with an error.
        exit 1
    fi
    ```
    *   Update the `trivy` vulnerability database to ensure the latest definitions are used. This is crucial for accurate scans.
    ```bash
    trivy image --download-db-only
    ```

2.  **[Bash] Target Resolution:**
    *   **If the target is a Kubernetes pod:** Use `kubectl` to get the image name(s) for the specified pod. If there are multiple containers, scan each one.
    ```bash
    # Example for a pod named 'my-pod' in 'default' namespace
    TARGET_IMAGE=$(kubectl get pod my-pod -n default -o jsonpath='{.spec.containers[0].image}')
    if [ -z "$TARGET_IMAGE" ]; then
        echo "Error: Could not resolve image for pod my-pod."
        exit 1
    fi
    echo "Resolved image from pod: $TARGET_IMAGE"
    ```
    *   **If the target is an image name or ID:** Proceed directly to the next step. Verify the image exists locally or can be pulled from a remote registry.

3.  **[Bash] Execute Scan:**
    *   Construct the `trivy` command based on the parsed arguments. The base command should scan for both vulnerabilities and misconfigurations.
    *   Define a unique output filename using the image name and a timestamp to avoid collisions. A good pattern is `scan-report-$(basename "$TARGET_IMAGE" | tr ':' '_')-$(date +%s)`.
    *   For a full JSON report (required for machine readability):
    ```bash
    JSON_OUTPUT_FILE="scan-report-$(basename "$TARGET_IMAGE" | tr ':' '_')-$(date +%s).json"
    trivy image --format json --scanners vuln,config --output "$JSON_OUTPUT_FILE" "$TARGET_IMAGE"
    ```
    *   For a filtered, human-readable table view for the console:
    ```bash
    SEVERITY_FILTER=${1:-"CRITICAL,HIGH"} # Default to CRITICAL,HIGH if not specified
    trivy image --format table --scanners vuln,config --severity "$SEVERITY_FILTER" "$TARGET_IMAGE"
    ```

4.  **[Read, Grep] Process Results & Identify Key Findings:**
    *   Read the generated JSON output file.
    *   Identify the count of vulnerabilities for each severity level (CRITICAL, HIGH, MEDIUM, LOW).
    *   Identify the top 3 most severe findings (prioritizing CRITICAL, then HIGH). Note their CVE ID, vulnerable package name, and installed version.
    *   Check for common misconfigurations, such as the container running as the `root` user.

5.  **[Bash, Write] Generate Remediation Advice & Summary:**
    *   For the top 3 severe findings identified in the previous step, formulate actionable remediation advice.
        *   **Example for an outdated package:** "Remediation: Update the package `openssl` from version `1.1.1n-r0` to `1.1.1s-r0` in the Dockerfile."
        *   **Example for a base image CVE:** "Remediation: The vulnerability is in the base image. Update the `FROM` instruction in the Dockerfile to a newer, patched version (e.g., `FROM ubuntu:22.04.3`)."
        *   **Example for a misconfiguration:** "Remediation: The container is configured to run as root. Add a `USER` instruction in the Dockerfile to switch to a non-root user (e.g., `USER 1001`)."
    *   Create a summary markdown file (`scan-summary-....md`).
    *   **[Write]** Write the summary, including:
        *   Target Image
        *   Scan Timestamp
        *   Vulnerability Summary (Counts by severity)
        *   Top 3 High-Severity Findings with detailed remediation advice.
        *   Misconfiguration Findings with remediation advice.
        *   A link to the full JSON report.

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
            "reportPath": "path/to/scan-report-nginx_latest-....json"
          }
        }
      }
    }
    ```

## Output Format
*   **Primary Artifact (Machine-Readable):** A JSON file named `scan-report-<image_name>-<timestamp>.json` containing the complete, raw output from `trivy`.
*   **Secondary Artifact (Human-Readable):** A Markdown file named `scan-summary-<image_name>-<timestamp>.md` containing a high-level summary, key findings, and actionable remediation steps.
*   **Console Output:** A brief message indicating scan completion, a summary of critical/high findings, and the paths to the generated report files.

## Quality Gates
Before marking the skill as complete, verify the following:
1.  The `trivy` scan command completed with a `0` exit code.
2.  The JSON output file (`scan-report-*.json`) was created, is not empty, and contains a valid JSON structure with a `Results` key.
3.  The summary markdown file (`scan-summary-*.md`) was created and contains sections for "Vulnerability Summary" and "Remediation Advice".
4.  If CRITICAL or HIGH vulnerabilities were found, the summary file explicitly lists at least one actionable remediation step.
5.  The `world-model.json` has been updated with an entry for the scanned image.

## Integration Points
*   **tactical-planner:** This skill is a primary tool for executing any security-related tactical goals. The planner can invoke this skill with the appropriate target.
*   **code-editor / dockerfile-modifier:** The remediation advice generated by this skill can be passed as a prompt to a code-editing skill to automatically patch Dockerfiles.
*   **vulnerability-tracker:** The output JSON can be fed into a separate skill that tracks vulnerabilities over time, identifies trends, and raises alerts for newly discovered CVEs in previously scanned images.
*   **reporting-generator:** The summary markdown can be ingested by a reporting skill to be included in periodic system health and security reports.

## Error Handling
*   **Image Not Found:** If `trivy` or `docker` fails to find the image, log a clear error message "Error: Target image '<image_name>' not found locally or in remote registries." and terminate gracefully.
*   **Tool Not Found:** If `trivy` is not installed and automatic installation fails, exit with a message instructing the user on how to install it manually.
*   **Permission Denied:** If the scan fails due to permissions (e.g., cannot connect to Docker socket), report the error and suggest checking user permissions (e.g., "Error: Permission denied while trying to connect to the Docker daemon socket. Ensure the agent is running with appropriate permissions or is part of the 'docker' group.").
*   **Scan Failure:** If `trivy` exits with a non-zero status for reasons other than the above, capture `stderr`, log it, and report a generic scan failure.

## Examples

### Example 1: Scan `nginx:latest` and filter for high-severity issues
*   **Command:** `/scan-container nginx:latest --severity HIGH,CRITICAL`
*   **Execution:**
    1.  Agent runs `trivy image --severity HIGH,CRITICAL nginx:latest`.
    2.  Agent runs `trivy image --format json --output scan-report-nginx_latest-....json nginx:latest`.
    3.  Agent parses the JSON to find the top 3 findings.
    4.  Agent generates `scan-summary-nginx_latest-....md` with remediation for the top findings.
*   **Output (Console):**
    ```
    Scan complete for nginx:latest.
    Found: 3 CRITICAL, 8 HIGH vulnerabilities.
    Summary report saved to: scan-summary-nginx_latest-1678886400.md
    Full JSON report saved to: scan-report-nginx_latest-1678886400.json
    ```

### Example 2: Generate a full JSON report for a local image
*   **Command:** `/scan-container f64e70b92a98 --format json --output /tmp/ubuntu_scan.json`
*   **Execution:**
    1.  Agent resolves `f64e70b92a98` to a local image.
    2.  Agent runs `trivy image --format json --scanners vuln,config --output /tmp/ubuntu_scan.json f64e70b92a98`.
*   **Output (Console):**
    ```
    Scan complete for image f64e70b92a98.
    Full JSON report saved to: /tmp/ubuntu_scan.json
    ```

### Example 3: Scan a production container from a Kubernetes pod
*   **Command:** `security audit for pod/prod-frontend-7ff... in namespace 'production'`
*   **Execution:**
    1.  Agent's keyword detection triggers the skill.
    2.  Agent runs `kubectl get pod prod-frontend-7ff... -n production -o jsonpath='{.spec.containers[0].image}'` to get the image name (e.g., `my-registry/frontend:v2.3.1`).
    3.  Agent runs a full scan on `my-registry/frontend:v2.3.1`, generating both JSON and Markdown reports in the current working directory.
    4.  Agent updates the `world-model.json` with the results.
*   **Output (Console):**
    ```
    Resolved image 'my-registry/frontend:v2.3.1' from pod 'prod-frontend-7ff...'.
    Starting security scan...
    Scan complete. Found: 0 CRITICAL, 2 HIGH vulnerabilities.
    Summary report saved to: scan-summary-frontend_v2.3.1-1678886800.md
    Full JSON report saved to: scan-report-frontend_v2.3.1-1678886800.json
    ```