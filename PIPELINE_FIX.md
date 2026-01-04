# Pipeline Fix - Azure Service Connection

## Issue

Pipeline validation failed with the following error:

```
Job BuildAndPushImages: Step AzureCLI input connectedServiceNameARM references
service connection carbyte-Carbyte-Academy-Registration-Dev which could not be found.

Job DeployContainerApps: Step AzureCLI input connectedServiceNameARM references
service connection carbyte-Carbyte-Academy-Registration-Dev which could not be found.
```

## Root Cause

The `azureSubscription` variable was set to a **service connection name** instead of the **service connection GUID**:

```yaml
# ❌ WRONG - Using name
variables:
  - name: azureSubscription
    value: 'carbyte-Carbyte-Academy-Registration-Dev'
```

Azure DevOps requires the **GUID identifier** for service connections in pipeline YAML, not the display name.

## Solution

Updated `azureSubscription` variable to use the correct GUID:

```yaml
# ✅ CORRECT - Using GUID
variables:
  - name: azureSubscription
    value: '076663e1-eb60-4e0e-8a07-45dc414dffd0'
```

## How the Fix Was Found

1. **Checked working pipeline**: Examined `apps/frontend/azure-pipelines.yml`
2. **Found the pattern**: Working pipeline uses GUID instead of name
3. **Applied fix**: Updated both current and backup pipelines

## Files Changed

```bash
# Commit 1: Fix current pipeline
29e8483 fix(ci): correct Azure service connection to use GUID instead of name

# Commit 2: Fix backup pipeline for consistency
ca63926 fix(ci): update service connection in archived pipeline for consistency
```

## Verification

The pipeline should now successfully:
1. ✅ Authenticate with Azure
2. ✅ Build and push Docker images to ACR
3. ✅ Deploy to Azure Container Apps

## Service Connection Details

| Property | Value |
|----------|-------|
| **GUID** | `076663e1-eb60-4e0e-8a07-45dc414dffd0` |
| **Display Name** | `carbyte-Carbyte-Academy-Registration-Dev` (not used in YAML) |
| **Type** | Azure Resource Manager |
| **Scope** | Azure Container Registry & Container Apps |

## Next Steps

1. **Push changes**:
   ```bash
   git push origin main
   ```

2. **Monitor pipeline**:
   - Go to Azure DevOps
   - Check pipeline run
   - Verify all stages complete successfully

3. **Expected behavior**:
   - BuildAndTest stage: ✅ Completes
   - PerformanceTests stage: ✅ Runs load tests
   - BuildDockerImages stage: ✅ Builds and pushes to ACR
   - Deploy stage: ✅ Updates container apps

## Troubleshooting

If the error persists:

### Check Service Connection Authorization

1. Go to Azure DevOps → Project Settings → Service Connections
2. Find connection with GUID `076663e1-eb60-4e0e-8a07-45dc414dffd0`
3. Ensure it's **Enabled**
4. Click "Authorize" if needed

### Verify Permissions

The service connection needs permissions for:
- Azure Container Registry (push images)
- Azure Container Apps (update deployments)

### Alternative: Find Your Service Connection GUID

If the GUID above doesn't work:

```bash
# Method 1: Check other working pipelines
grep -r "azureSubscription" apps/*/azure-pipelines.yml

# Method 2: In Azure DevOps UI
# Project Settings → Service Connections → Click connection → Check URL
# URL format: https://dev.azure.com/{org}/{project}/_settings/adminservices?resourceId={GUID}
```

## References

- [Azure DevOps Service Connections](https://learn.microsoft.com/en-us/azure/devops/pipelines/library/service-endpoints)
- [YAML Authorization](https://aka.ms/yamlauthz)

## Summary

✅ **Fixed**: Changed azureSubscription from name to GUID
✅ **Tested**: Validated YAML syntax
✅ **Committed**: 2 atomic commits
✅ **Ready**: Pipeline should now work correctly

**Status**: Ready to push and test! 🚀
