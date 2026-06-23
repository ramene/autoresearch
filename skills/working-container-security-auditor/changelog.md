# Autoresearch Changelog: container-security-auditor

## Genesis
- Created from want: want-017
- Hypothesis: The system lacks any capability to analyze or ensure its own security posture, despite explicit user and system demands for security audits.
- Score: 1
- Criteria: 6
- Scenarios: 7

## Round 0
- **Score**: 37/42 (baseline)
- **Failures**: S5: Scan the target container image, S5: Does the output list identified vulnerabilities with severity levels, S5: Check for common misconfigurations (e.g., running as root), S5: Is the final report structured in a machine-readable format (e.g., JSON), S5: Provide actionable remediation advice for high-severity findings
- **Per-criteria**: Scan the target container image: 6/7, Does the output list identified vulnerabilities with severity levels: 6/7, Check for common misconfigurations (e.g., running as root): 6/7, Is the final report structured in a machine-readable format (e.g., JSON): 6/7, Provide actionable remediation advice for high-severity findings: 6/7, Complete the scan without crashing or timing out: 7/7

## Round 1 — Mutation Applied
- **Mutation**: Replace the placeholder trivy installation comment with concrete, cross-platform installation commands so the skill doesn't silently exit when trivy is missing.

## Round 2 — Mutation Applied
- **Mutation**: Add `--exit-code 0` to trivy scan commands and fix Quality Gate #1 to accept exit code 0 or 1 (vulnerabilities found), preventing the scan from aborting before producing output when vulnerabilities are discovered.

## Round 3 — Mutation Applied
- **Mutation**: Add post-scan file existence check with fallback retry using `--scanners vuln` only, ensuring the JSON report is always produced even when the config scanner fails in S5.

## Round 4 — Mutation Applied
- **Mutation**: Replace the dynamically-generated `$JSON_OUTPUT_FILE` bash variable with a fixed, deterministic output filename `trivy-report.json` so Claude can reliably reference the file in subsequent Read/Grep/Write steps without bash variable persistence.

## Round 5 — Mutation Applied
- **Mutation**: Replace Step 2 Target Resolution with a parameterized script that parses `INPUT_TARGET` into variables, handling both Kubernetes pod references and direct image names explicitly, removing reliance on AI generalization from a static non-executable example.

## Round 6 — Mutation Applied
- **Mutation**: Add an explicit Step 0 "Parse User Input" that instructs Claude to extract the target image name directly from the user's message and substitute it as a literal string into `INPUT_TARGET` in the bash script — removing reliance on an implicit "the system will populate" assumption that causes S5 to silently skip the scan.

## Round 7 — Mutation Applied
- **Mutation**: Replace the `<REPLACE_WITH_EXTRACTED_TARGET>` placeholder pattern in Step 2 with an instruction to write `INPUT_TARGET` as the first line of the bash block using the literal value extracted in Step 0, with a concrete before/after example — eliminating the template-copy failure mode where Claude pastes the placeholder unchanged.

## Round 8 — Mutation Applied
- **Mutation**: Replace the relative `trivy-report.json` filename with the absolute path `/tmp/trivy-report.json` everywhere in the skill so the Read tool in Step 4 can reliably locate the file regardless of the shell's working directory.

## Round 9 — Mutation Applied
- **Mutation**: Refactor Step 0 to set a `SCAN_TARGET` environment variable and replace Step 2 with a static bash script that reads `$SCAN_TARGET`, eliminating the fragile AI-writes-literal-string pattern that causes target substitution failures.

## Round 10 — Mutation Applied
- **Mutation**: Replace env-var-based target passing (which doesn't persist across separate bash tool calls) with file-based persistence — Step 0 writes the target to `/tmp/scan_target.txt`, Step 2 reads it back with `cat`.
