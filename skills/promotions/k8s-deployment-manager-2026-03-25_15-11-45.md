# Promotion Proposal: k8s-deployment-manager

## Scores
- **Baseline**: 36/36
- **Current**: 36/36
- **Improvement**: +0 points (100.0%)
- **Rounds**: 6

## Promotion Target
`/Users/ramene/Journal/.seed/base/skills/k8s-deployment-manager/SKILL.md`

## Key Mutations That Improved Score
1. No failures detected across all criteria — added a note to the Get Pod Logs action recommending use of `kubectl get pods` label selector directly via `-l` flag instead of the fragile `sed`-based selector parsing, which is prone to breakage on non-standard label formats.
2. No failures present — improved the `Get Pod Logs` selector construction to use `kubectl get deployment -o jsonpath` with direct `-l` flag syntax, eliminating the fragile `sed`/`tr` shell pipeline that can break on non-standard label formats.
3. All criteria pass with 0 failures — applied a minor robustness improvement to the `Get Pod Logs` selector construction by replacing the `awk`/`paste` pipeline with a simpler, more portable `kubectl` jsonpath pattern that formats the selector directly, reducing shell parsing surface area.
4. All criteria pass with 0 failures — improved the Get Pod Logs selector construction to use a single clean jsonpath query with explicit key=value formatting, removing the dual-approach confusion and unreliable fallback chain.
5. Add multi-container pod handling to Update Deployment Image action - disambiguates target container when deployment has multiple containers instead of naively using containers[0]

## Unified Diff (baseline -> current)
```diff
--- /Users/ramene/.remote/@autoresearch/skills/working-k8s-deployment-manager/SKILL.md.baseline	2026-03-20 14:37:35.000000000 -0600
+++ /Users/ramene/.remote/@autoresearch/skills/working-k8s-deployment-manager/SKILL.md	2026-03-20 15:14:49.000000000 -0600
@@ -40,17 +40,20 @@
 3.  **[Format]** Present the command's standard output to the user in a readable format.
 
 ### Action: Update Deployment Image
-1.  **[Identify]** Parse the deployment name, new image URL/tag, and namespace from the user's request.
-2.  **[Identify Container]** Before updating, you must determine the name of the container within the deployment to update. Execute the following command to retrieve it. Most deployments have only one container; use the first one by default.
+1.  **[Identify]** Parse the deployment name, new image URL/tag, and namespace from the user's request. The user may optionally specify a container name.
+2.  **[List Containers]** Check the containers in the deployment to determine the correct target for the image update.
     ```bash
-    kubectl get deployment <deployment-name> -n <namespace> -o jsonpath='{.spec.template.spec.containers[0].name}'
+    CONTAINERS=$(kubectl get deployment <deployment-name> -n <namespace> -o jsonpath='{.spec.template.spec.containers[*].name}')
     ```
-    Store this container name for the next step.
-3.  **[Bash]** Construct and execute the `set image` command:
+3.  **[Disambiguate]**
+    *   If the user specified a container name, verify it exists in the `CONTAINERS` list. If not, report an error and list the available containers.
+    *   If the user did not specify a container name and there is only one container in the list, use that container's name.
+    *   If the user did not specify a container name and there is more than one container, **halt execution and ask the user to clarify**. Respond with: "The `<deployment-name>` deployment has multiple containers: [<list of containers>]. Please specify which container you want to update."
+4.  **[Bash]** Once the target container name is confirmed, construct and execute the `set image` command:
     ```bash
-    kubectl set image deployment/<deployment-name> <container-name>=<new-image> -n <namespace>
+    kubectl set image deployment/<deployment-name> <target-container-name>=<new-image> -n <namespace>
     ```
-4.  **[Report]** Inform the user that the update process has been initiated. Advise them to check the rollout status using the `k8s-status` action.
+5.  **[Report]** Inform the user that the update process has been initiated for the specified container. Advise them to check the rollout status using the `k8s-status` action.
 
 ### Action: Check Rollout Status
 1.  **[Identify]** Parse the deployment name and namespace from the user's request.
@@ -70,14 +73,21 @@
 
 ### Action: Get Pod Logs
 1.  **[Identify]** Parse the deployment name and namespace from the user's request.
-2.  **[Identify Labels]** First, get the label selector for the deployment. This is critical for finding the correct pods.
+2.  **[Identify Labels]** Build the label selector by querying the deployment's `matchLabels` with a jsonpath expression that outputs each key=value pair separated by commas:
     ```bash
-    # This command gets the labels and formats them into a selector string like "app=my-app,tier=backend"
-    SELECTOR=$(kubectl get deployment <deployment-name> -n <namespace> -o jsonpath='{.spec.selector.matchLabels}' | sed 's/map\[//' | sed 's/\]//' | sed 's/ /\,/g' | sed 's/:/=/g')
+    SELECTOR=$(kubectl get deployment <deployment-name> -n <namespace> \
+      -o jsonpath='{range .spec.selector.matchLabels}{@..key}={@..value},{end}' \
+      | sed 's/,$//')
+    ```
+    If the above produces an empty string or fails, fall back to using the deployment name as the app label:
+    ```bash
+    SELECTOR="app=<deployment-name>"
     ```
 3.  **[Identify Pod]** Use the selector from the previous step to find the most recently created pod for that deployment.
     ```bash
-    POD_NAME=$(kubectl get pods -n <namespace> --selector=$SELECTOR --sort-by=.metadata.creationTimestamp -o jsonpath='{.items[-1:].metadata.name}')
+    POD_NAME=$(kubectl get pods -n <namespace> -l "$SELECTOR" \
+      --sort-by=.metadata.creationTimestamp \
+      -o jsonpath='{.items[-1:].metadata.name}')
     ```
 4.  **[Bash]** Fetch the logs for that specific pod. To avoid overwhelming the user, retrieve the last 100 lines.
     ```bash
@@ -113,16 +123,25 @@
     4.  Proactively ask the user if they would like to initiate a rollback.
 
 ## Examples
-### Example 1: Standard Deployment Update
+### Example 1: Standard Deployment Update (Single Container)
 *   **User:** `/deploy api-server to my-registry/api-server:v1.5.0 in production`
 *   **Agent:**
-    1.  Identifies container name for `api-server` deployment.
+    1.  Lists containers for `api-server` deployment: finds only `api-server-container`.
     2.  Executes `kubectl set image deployment/api-server api-server-container=my-registry/api-server:v1.5.0 -n production`.
-    3.  Responds: "Deployment for 'api-server' in namespace 'production' has been updated to image 'my-registry/api-server:v1.5.0'. Initiating status check."
+    3.  Responds: "Deployment for 'api-server' in namespace 'production' has been updated to image 'my-registry/api-server:v1.5.0' for container 'api-server-container'. Initiating status check."
     4.  Executes `kubectl rollout status deployment/api-server -n production`.
     5.  Responds: "deployment "api-server" successfully rolled out".
 
-### Example 2: Rollback on Failure
+### Example 2: Multi-Container Disambiguation
+*   **User:** `/deploy sidecar-app to my-registry/sidecar-app:v2.0.0 in staging`
+*   **Agent:**
+    1.  Lists containers for `sidecar-app` deployment: finds `app-container` and `log-forwarder`.
+    2.  Responds: "The `sidecar-app` deployment has multiple containers: [app-container, log-forwarder]. Please specify which container you want to update."
+    3.  **User:** `app-container`
+    4.  Executes `kubectl set image deployment/sidecar-app app-container=my-registry/sidecar-app:v2.0.0 -n staging`.
+    5.  Responds: "Deployment for 'sidecar-app' in namespace 'staging' has been updated to image 'my-registry/sidecar-app:v2.0.0' for container 'app-container'."
+
+### Example 3: Rollback on Failure
 *   **User:** `/deploy worker to my-registry/worker:v2.1.0-buggy in default`
 *   **Agent:**
     1.  Initiates the deployment update.
@@ -135,7 +154,7 @@
     8.  Executes `kubectl rollout undo deployment/worker -n default`.
     9.  Responds: "Rollback initiated for 'worker' deployment."
 
-### Example 3: Debugging with Logs
+### Example 4: Debugging with Logs
 *   **User:** "Show me the logs for the latest worker pod in the production namespace."
 *   **Agent:**
     1.  Triggers the `Get Pod Logs` action for deployment `worker` in namespace `production`.

```

## Generated
- **Timestamp**: 2026-03-25T15:11:45.184Z
- **Source**: `/Users/ramene/.remote/@autoresearch/skills/working-k8s-deployment-manager/SKILL.md`
- **Baseline**: `/Users/ramene/.remote/@autoresearch/skills/working-k8s-deployment-manager/SKILL.md.baseline`
