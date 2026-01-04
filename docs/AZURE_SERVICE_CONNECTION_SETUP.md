# Azure Service Connection Setup Guide

## Issue

The pipeline requires an Azure service connection to be authorized before it can deploy to Azure Container Registry and Container Apps.

**Error Message:**
```
Step AzureCLI input connectedServiceNameARM references service connection
076663e1-eb60-4e0e-8a07-45dc414dffd0 which could not be found.
The service connection does not exist, has been disabled or has not been
authorized for use.
```

## Current Pipeline Behavior

The pipeline is now configured to **gracefully skip** Azure deployment stages if the service connection is not authorized:

### ✅ Always Runs:
- **Stage 1: BuildAndTest** - Build and test all services
- **Stage 2: PerformanceTests** - Docker-based load testing

### ⏭️ Skipped Until Authorized:
- **Stage 3: BuildDockerImages** - Build and push to ACR
- **Stage 4: Deploy** - Deploy to Container Apps

## Solution Options

### Option 1: Authorize the Service Connection (Recommended for Production)

#### Step 1: Locate Service Connection
1. Go to **Azure DevOps**
2. Navigate to **Project Settings** (bottom left)
3. Under **Pipelines**, click **Service connections**
4. Look for connection with ID: `076663e1-eb60-4e0e-8a07-45dc414dffd0`

#### Step 2: Authorize for Pipeline
1. Click on the service connection
2. Click **"Authorize"** or **"Grant access"**
3. Select the pipeline: `azure-pipelines.yml` (or your pipeline name)
4. Confirm authorization

#### Step 3: Verify
1. Go back to your pipeline
2. Click **"Run pipeline"**
3. All 4 stages should now execute

### Option 2: Create New Service Connection

If the service connection doesn't exist:

#### Step 1: Create Service Connection
1. Go to **Project Settings** → **Service connections**
2. Click **"New service connection"**
3. Select **"Azure Resource Manager"**
4. Choose **"Service principal (automatic)"**
5. Select your **Azure subscription**
6. Select resource group: **rg-rosetta**
7. Name it (e.g., "Azure-Rosetta-Connection")
8. Click **"Save"**

#### Step 2: Get the Service Connection GUID
1. Click on the newly created connection
2. Look at the URL in your browser:
   ```
   https://dev.azure.com/{org}/{project}/_settings/adminservices?resourceId={GUID}
   ```
3. Copy the `{GUID}` from the URL

#### Step 3: Update Pipeline
```bash
# Edit azure-pipelines.yml
# Find the azureSubscription variable and update it:

variables:
  - name: azureSubscription
    value: '{YOUR-NEW-GUID-HERE}'
```

#### Step 4: Commit and Push
```bash
git add azure-pipelines.yml
git commit -m "fix(ci): update Azure service connection GUID"
git push origin main
```

### Option 3: Skip Azure Stages (Development/Testing)

If you only want to test build and load testing stages:

#### Set Pipeline Variable
1. Go to your pipeline in Azure DevOps
2. Click **"Run pipeline"**
3. Click **"Variables"**
4. Add new variable:
   - **Name**: `SKIP_AZURE_STAGES`
   - **Value**: `true`
5. Click **"Run"**

This will run only the BuildAndTest and PerformanceTests stages.

### Option 4: Use Simplified Pipeline (No Azure Deployment)

Create a test-only pipeline:

```yaml
# azure-pipelines.test.yml
trigger:
  branches:
    include:
      - main
      - dev

stages:
  - stage: BuildAndTest
    # ... (copy from main pipeline)

  - stage: PerformanceTests
    # ... (copy from main pipeline)

# No BuildDockerImages or Deploy stages
```

## Troubleshooting

### Issue: Service connection not found

**Possible causes:**
1. Connection was deleted
2. Connection is in a different Azure DevOps project
3. You don't have permissions to see it

**Solution:**
- Ask your Azure DevOps admin to:
  - Check if the connection exists
  - Grant you permissions
  - Share the correct GUID

### Issue: "Unauthorized" error

**Possible causes:**
1. Service connection exists but isn't authorized for this pipeline
2. Service principal credentials expired

**Solution:**
```bash
# Option A: Authorize the pipeline (see Option 1)
# Option B: Recreate the service connection (see Option 2)
```

### Issue: Service connection authorized but still failing

**Possible causes:**
1. Service principal doesn't have ACR/Container App permissions
2. Resource group access denied

**Solution:**
1. Go to **Azure Portal**
2. Navigate to **Resource Group: rg-rosetta**
3. Click **Access control (IAM)**
4. Add role assignments:
   - **AcrPush** - For pushing images
   - **Contributor** - For Container App deployments
5. Assign to the service principal

## Permissions Required

The service connection's service principal needs:

| Resource | Role | Purpose |
|----------|------|---------|
| Azure Container Registry (`rosettaacr`) | AcrPush | Push Docker images |
| Resource Group (`rg-rosetta`) | Contributor | Update Container Apps |
| Container Apps | Contributor | Deploy new versions |

## Verification Checklist

Before running the pipeline, verify:

- [ ] Service connection exists
- [ ] Service connection is enabled
- [ ] Pipeline is authorized to use the connection
- [ ] Service principal has ACR push permissions
- [ ] Service principal has Container App deployment permissions
- [ ] Resource group access granted

## Alternative: Manual Deployment

If you can't get the service connection working, you can deploy manually:

```bash
# Use the manual deployment script
./scripts/deploy-manual.sh

# Or deploy specific services
az acr login --name rosettaacr

# Build and push
docker build -t rosettaacr.azurecr.io/backend:v1 -f services/backend/Dockerfile .
docker push rosettaacr.azurecr.io/backend:v1

# Update container app
az containerapp update \
  --name backend \
  --resource-group rg-rosetta \
  --image rosettaacr.azurecr.io/backend:v1
```

## Current Pipeline Status

With the latest changes:

✅ **Working Without Authorization:**
- BuildAndTest stage (all builds and unit tests)
- PerformanceTests stage (Docker-based load testing)

⏳ **Pending Authorization:**
- BuildDockerImages stage (requires Azure connection)
- Deploy stage (requires Azure connection)

## Summary

**For immediate testing:** Pipeline will work for stages 1-2 (no authorization needed)

**For full CI/CD:** Follow Option 1 or Option 2 to authorize/create service connection

**For production:** Ensure all permissions are properly configured

## Need Help?

1. Check Azure DevOps documentation: https://aka.ms/yamlauthz
2. Contact your Azure DevOps administrator
3. Check Azure service principal permissions in Azure Portal

---

**Status**: Pipeline configured to work with or without Azure deployment stages
