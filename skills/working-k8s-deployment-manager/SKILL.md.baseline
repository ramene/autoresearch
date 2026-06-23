# k8s-deployment-manager
Interacts with a Kubernetes cluster to deploy, update, or rollback a service.

## Purpose
This skill exists to manage software deployments within a Kubernetes cluster, a core operational function. It addresses the capability gap identified in `want-021`, where the system lacked the ability to autonomously update its own services or other managed applications. By providing a robust interface to `kubectl`, this skill enables the agent to perform deployments, monitor their progress, and react to failures, moving it closer to autonomous system management.

## Trigger Conditions
This skill should be activated under the following conditions:

*   **Slash Commands:**
    *   `/deploy <deployment> to <image> in <namespace>`
    *   `/k8s-status <deployment> in <namespace>`
    *   `/rollback <deployment> in <namespace>`
    *   `/k8s-list-deployments in <namespace>`
    *   `/k8s-logs <deployment> in <namespace>`
*   **Keywords:** The skill should be considered when user prompts include phrases like:
    *   "deploy the new version of api-server"
    *   "update the worker image to v1.2.3"
    *   "what's the status of the production deployment?"
    *   "the last deployment failed, roll it back"
    *   "show me the logs for the api-server"
*   **Automatic Detection:** This skill can be triggered by other skills or system events, such as a `ci-pipeline-monitor` skill reporting a new container image has been successfully built and pushed to a registry.

## Prerequisites
Before execution, the following conditions must be met:

1.  **`kubectl` CLI:** The `kubectl` command-line tool must be installed and available in the system's `$PATH`.
2.  **Valid Kubeconfig:** A valid Kubernetes configuration file must exist, typically at `~/.kube/config` or specified by the `$KUBECONFIG` environment variable.
3.  **Permissions:** The service account or user configured in the kubeconfig must have the necessary Role-Based Access Control (RBAC) permissions in the target namespace(s) to `get`, `list`, `patch`, and `describe` deployments, replicasets, and pods, as well as `get` pod logs.

## Execution Steps
The agent will determine the user's intent (list, update, status, rollback, logs) and follow the corresponding steps.

### Action: List Deployments
1.  **[Identify]** Parse the target namespace from the user's request. If no namespace is provided, default to `default`.
2.  **[Bash]** Execute the following command:
    ```bash
    kubectl get deployments -n <namespace>
    ```
3.  **[Format]** Present the command's standard output to the user in a readable format.

### Action: Update Deployment Image
1.  **[Identify]** Parse the deployment name, new image URL/tag, and namespace from the user's request.
2.  **[Identify Container]** Before updating, you must determine the name of the container within the deployment to update. Execute the following command to retrieve it. Most deployments have only one container; use the first one by default.
    ```bash
    kubectl get deployment <deployment-name> -n <namespace> -o jsonpath='{.spec.template.spec.containers[0].name}'
    ```
    Store this container name for the next step.
3.  **[Bash]** Construct and execute the `set image` command:
    ```bash
    kubectl set image deployment/<deployment-name> <container-name>=<new-image> -n <namespace>
    ```
4.  **[Report]** Inform the user that the update process has been initiated. Advise them to check the rollout status using the `k8s-status` action.

### Action: Check Rollout Status
1.  **[Identify]** Parse the deployment name and namespace from the user's request.
2.  **[Bash]** Execute the following command. This command will block until the rollout completes, fails, or times out.
    ```bash
    kubectl rollout status deployment/<deployment-name> -n <namespace>
    ```
3.  **[Report]** Relay the final, complete output of the command to the user. If the command fails or times out, proceed to the **Error Handling** section for rollout failures.

### Action: Rollback Deployment
1.  **[Identify]** Parse the deployment name and namespace from the user's request.
2.  **[Bash]** Execute the `rollout undo` command to revert to the previous deployment revision:
    ```bash
    kubectl rollout undo deployment/<deployment-name> -n <namespace>
    ```
3.  **[Report]** Inform the user that the rollback has been initiated. Recommend they monitor the progress using the `k8s-status` action.

### Action: Get Pod Logs
1.  **[Identify]** Parse the deployment name and namespace from the user's request.
2.  **[Identify Labels]** First, get the label selector for the deployment. This is critical for finding the correct pods.
    ```bash
    # This command gets the labels and formats them into a selector string like "app=my-app,tier=backend"
    SELECTOR=$(kubectl get deployment <deployment-name> -n <namespace> -o jsonpath='{.spec.selector.matchLabels}' | sed 's/map\[//' | sed 's/\]//' | sed 's/ /\,/g' | sed 's/:/=/g')
    ```
3.  **[Identify Pod]** Use the selector from the previous step to find the most recently created pod for that deployment.
    ```bash
    POD_NAME=$(kubectl get pods -n <namespace> --selector=$SELECTOR --sort-by=.metadata.creationTimestamp -o jsonpath='{.items[-1:].metadata.name}')
    ```
4.  **[Bash]** Fetch the logs for that specific pod. To avoid overwhelming the user, retrieve the last 100 lines.
    ```bash
    kubectl logs $POD_NAME -n <namespace> --tail=100
    ```
5.  **[Report]** Present the logs to the user.

## Output Format
*   **Console Output:** All interactions will produce formatted text output directly in the user's console. This includes lists of deployments, status messages, confirmation text, and logs.
*   **World Model Update:** Upon a successful image update, the skill may update the `world-model.json` to reflect the new state, e.g., `{"services": {"api-server": {"image": "new-image:v1.2.3"}}}`.

## Quality Gates
Before marking the skill execution as complete, verify the following:
1.  **List:** The `kubectl get deployments` command executes successfully and returns a list of resources or a "No resources found" message.
2.  **Update:** The `kubectl set image` command returns a `deployment.apps/... configured` message.
3.  **Status:** The `kubectl rollout status` command exits with a status code of 0 and prints a "successfully rolled out" message.
4.  **Rollback:** The `kubectl rollout undo` command returns a `deployment.apps/... rolled back` message.
5.  **Authentication:** If authentication fails, the skill must detect the error message from `kubectl` and report it gracefully without crashing.
6.  **Error Reporting:** If a deployment fails (e.g., `ImagePullBackOff`), the skill must report the failure status clearly to the user.

## Integration Points
*   **`ci-pipeline-monitor`**: This skill can be triggered by `ci-pipeline-monitor` when a new image is available in the container registry.
*   **`system-monitoring`**: After a successful deployment, this skill can trigger `system-monitoring` to verify application health (e.g., check HTTP status codes, latency). Conversely, if `system-monitoring` detects a spike in errors, it can trigger this skill to perform a rollback.
*   **`log-analyzer`**: The output of the `Get Pod Logs` action can be piped directly to the `log-analyzer` skill for automated error detection and root cause analysis.

## Error Handling
*   **Authentication/Authorization Errors:** If any `kubectl` command fails with an error message containing "Unauthorized", "Forbidden", or "could not be found", report the error to the user. Advise them to check their `~/.kube/config` file and RBAC permissions. Do not retry.
*   **Resource Not Found:** If `kubectl` reports that a namespace, deployment, or pod was "not found", clearly communicate this to the user and halt the current action.
*   **Rollout Failure:** If `kubectl rollout status` fails or times out, the deployment is in a bad state.
    1.  Report the failure and the final status message to the user.
    2.  Automatically run `kubectl get pods -n <namespace>` and `kubectl describe deployment <deployment-name> -n <namespace>` to gather diagnostic information.
    3.  Present a summary of the pod statuses (e.g., `ImagePullBackOff`, `CrashLoopBackOff`) and relevant events from the deployment description.
    4.  Proactively ask the user if they would like to initiate a rollback.

## Examples
### Example 1: Standard Deployment Update
*   **User:** `/deploy api-server to my-registry/api-server:v1.5.0 in production`
*   **Agent:**
    1.  Identifies container name for `api-server` deployment.
    2.  Executes `kubectl set image deployment/api-server api-server-container=my-registry/api-server:v1.5.0 -n production`.
    3.  Responds: "Deployment for 'api-server' in namespace 'production' has been updated to image 'my-registry/api-server:v1.5.0'. Initiating status check."
    4.  Executes `kubectl rollout status deployment/api-server -n production`.
    5.  Responds: "deployment "api-server" successfully rolled out".

### Example 2: Rollback on Failure
*   **User:** `/deploy worker to my-registry/worker:v2.1.0-buggy in default`
*   **Agent:**
    1.  Initiates the deployment update.
    2.  Executes `kubectl rollout status deployment/worker -n default`.
    3.  The command times out or exits with an error.
    4.  Responds: "Rollout of 'worker' has failed. Checking pod status..."
    5.  Runs `kubectl get pods -n default -l app=worker` and sees pods are in `CrashLoopBackOff`.
    6.  Responds: "Pods for the 'worker' deployment are failing to start with status `CrashLoopBackOff`. Would you like me to roll back to the previous version? (yes/no)"
    7.  **User:** `yes`
    8.  Executes `kubectl rollout undo deployment/worker -n default`.
    9.  Responds: "Rollback initiated for 'worker' deployment."

### Example 3: Debugging with Logs
*   **User:** "Show me the logs for the latest worker pod in the production namespace."
*   **Agent:**
    1.  Triggers the `Get Pod Logs` action for deployment `worker` in namespace `production`.
    2.  Determines the label selector for the deployment.
    3.  Finds the most recent pod name (e.g., `worker-7f5c8b4f9d-z8k2l`).
    4.  Executes `kubectl logs worker-7f5c8b4f9d-z8k2l -n production --tail=100`.
    5.  Presents the last 100 lines of the pod's logs to the user.