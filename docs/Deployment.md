# Rosetta Platform - Azure Deployment Guide

A step-by-step guide to deploy the Rosetta platform on Microsoft Azure using Azure Container Apps. This guide is designed for first-time Azure deployments and explains each step in detail.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step 1: Azure Setup](#step-1-azure-setup)
4. [Step 2: Create Resource Group](#step-2-create-resource-group)
5. [Step 3: Create Container Registry](#step-3-create-container-registry)
6. [Step 4: Create Databases](#step-4-create-databases)
7. [Step 5: Create Container Apps Environment](#step-5-create-container-apps-environment)
8. [Step 6: Deploy Container Apps](#step-6-deploy-container-apps)
9. [Step 7: Configure Azure DevOps Pipeline](#step-7-configure-azure-devops-pipeline)
10. [Troubleshooting](#troubleshooting)
11. [Cost Management](#cost-management)
12. [Related Documentation](#related-documentation)

---

## Overview

### What We're Building

```
Internet
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Azure Container Apps Environment                  │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                    nginx (external)                          │   │
│   │                                                              │   │
│   │   /api/*     → backend                                       │   │
│   │   /editor/*  → backend-editor                                │   │
│   │   /studio/*  → frontend-editor                               │   │
│   │   /auth/*    → auth-service                                  │   │
│   │   /*         → frontend                                      │   │
│   └─────────────────────────────────────────────────────────────┘   │
│          │              │              │              │              │
│          ▼              ▼              ▼              ▼              │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐        │
│   │ frontend │   │ backend  │   │be-editor │   │   auth   │        │
│   │(internal)│   │(internal)│   │(internal)│   │(internal)│        │
│   └──────────┘   └──────────┘   └──────────┘   └──────────┘        │
│          │              │              │                             │
└──────────┼──────────────┼──────────────┼─────────────────────────────┘
           │              │              │
      ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
      │PostgreSQL│   │Cosmos DB│    │  Redis  │
      │ (Azure)  │   │(MongoDB)│    │ (Azure) │
      └──────────┘   └──────────┘   └──────────┘
```

**Single domain for all services:**
```
https://nginx.purplebay-xxx.westeurope.azurecontainerapps.io
```

See [ADR-001: Nginx Reverse Proxy](./adr/ADR-001-nginx-reverse-proxy.md) for architectural decision details.

### Why Azure Container Apps?

- **Simple**: No Kubernetes knowledge required
- **Cost-effective**: Scales to zero, pay only for what you use
- **Built-in features**: HTTPS, load balancing, scaling included
- **Container-native**: Works with your existing Dockerfiles

---

## Prerequisites

### 1. Azure CLI

Install the Azure CLI to manage Azure from your terminal.

**macOS:**
```bash
brew install azure-cli
```

**Windows:**
```powershell
winget install Microsoft.AzureCLI
```

**Verify:**
```bash
az --version
```

### 2. Docker

Install Docker to build images locally: [docker.com/get-docker](https://docker.com/get-docker)

### 3. Azure Subscription

You need an Azure subscription. Ask your IT department for access or create a free trial at [azure.microsoft.com/free](https://azure.microsoft.com/free).

---

## Step 1: Azure Setup

### 1.1 Login to Azure

```bash
az login
```

Your browser opens for authentication. After signing in, you're connected.

### 1.2 Set Your Subscription (if you have multiple)

```bash
# List subscriptions
az account list --output table

# Set the one you want
az account set --subscription "Your Subscription Name"
```

### 1.3 Install Required Extensions

```bash
az extension add --name containerapp --upgrade
```

### 1.4 Register Providers

Azure requires registering services before first use (one-time setup):

```bash
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights

# Wait until both show "Registered"
az provider show --namespace Microsoft.App --query "registrationState"
```

---

## Step 2: Create Resource Group

A **Resource Group** is a container for all your Azure resources. Delete the group = delete everything inside.

```bash
# Choose a location close to your users
LOCATION="westeurope"  # Options: westeurope, northeurope, eastus, westus2

# Create the resource group
az group create --name rg-rosetta --location $LOCATION
```

---

## Step 3: Create Container Registry

**Azure Container Registry (ACR)** stores your Docker images privately.

### 3.1 Create the Registry

```bash
# Name must be globally unique, alphanumeric only
ACR_NAME="rosettaacr"  # Change this to something unique

az acr create \
  --resource-group rg-rosetta \
  --name $ACR_NAME \
  --sku Basic \
  --location $LOCATION
```

**SKU Options:**
- `Basic`: ~$5/month, 10 GB - good for starting
- `Standard`: ~$20/month, 100 GB - for production

### 3.2 Enable Admin Access

This is the simplest way to authenticate (for production, use managed identities):

```bash
az acr update --name $ACR_NAME --admin-enabled true
```

### 3.3 Get Registry Credentials

```bash
# Login server (you'll need this)
az acr show --name $ACR_NAME --query loginServer --output tsv
# Output: rosettaacr.azurecr.io

# Get username and password
az acr credential show --name $ACR_NAME --query username --output tsv
az acr credential show --name $ACR_NAME --query "passwords[0].value" --output tsv
```

**Save these values** - you'll need them later.

---

## Step 4: Create Databases

### 4.1 PostgreSQL

```bash
# Generate a password (save this!)
PG_PASSWORD=$(openssl rand -base64 16)
echo "PostgreSQL Password: $PG_PASSWORD"

# Create the server
az postgres flexible-server create \
  --resource-group rg-rosetta \
  --name psql-rosetta \
  --location $LOCATION \
  --admin-user rosettaadmin \
  --admin-password "$PG_PASSWORD" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 15 \
  --yes

# Create the database
az postgres flexible-server db create \
  --resource-group rg-rosetta \
  --server-name psql-rosetta \
  --database-name rosetta

# Allow Azure services to connect
az postgres flexible-server firewall-rule create \
  --resource-group rg-rosetta \
  --name psql-rosetta \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

**Get connection string:**
```bash
echo "postgresql://rosettaadmin:${PG_PASSWORD}@psql-rosetta.postgres.database.azure.com:5432/rosetta?sslmode=require"
```

### 4.2 Cosmos DB (MongoDB)

```bash
az cosmosdb create \
  --resource-group rg-rosetta \
  --name cosmos-rosetta \
  --kind MongoDB \
  --server-version 7.0 \
  --default-consistency-level Session \
  --locations regionName=$LOCATION failoverPriority=0 \
  --capabilities EnableServerless

# Create database
az cosmosdb mongodb database create \
  --resource-group rg-rosetta \
  --account-name cosmos-rosetta \
  --name rosetta-editor
```

**Get connection string:**
```bash
az cosmosdb keys list \
  --resource-group rg-rosetta \
  --name cosmos-rosetta \
  --type connection-strings \
  --query "connectionStrings[0].connectionString" \
  --output tsv
```

### 4.3 Redis Cache

```bash
az redis create \
  --resource-group rg-rosetta \
  --name redis-rosetta \
  --location $LOCATION \
  --sku Basic \
  --vm-size c0
```

**Note:** Redis takes 15-20 minutes to create. Continue with other steps.

---

## Step 5: Create Container Apps Environment

### 5.1 Create Log Analytics Workspace

```bash
az monitor log-analytics workspace create \
  --resource-group rg-rosetta \
  --workspace-name log-rosetta \
  --location $LOCATION
```

### 5.2 Create the Environment

```bash
# Get workspace credentials
LOG_ID=$(az monitor log-analytics workspace show \
  --resource-group rg-rosetta \
  --workspace-name log-rosetta \
  --query customerId --output tsv)

LOG_KEY=$(az monitor log-analytics workspace get-shared-keys \
  --resource-group rg-rosetta \
  --workspace-name log-rosetta \
  --query primarySharedKey --output tsv)

# Create environment
az containerapp env create \
  --resource-group rg-rosetta \
  --name cae-rosetta \
  --location $LOCATION \
  --logs-workspace-id $LOG_ID \
  --logs-workspace-key $LOG_KEY
```

---

## Step 6: Deploy Container Apps

### 6.1 Build and Push Images

```bash
# Login to ACR
az acr login --name $ACR_NAME

REGISTRY="$ACR_NAME.azurecr.io"

# From your project root directory:
docker build -t $REGISTRY/rosetta/frontend:v1 ./apps/frontend
docker build -t $REGISTRY/rosetta/frontend-editor:v1 ./apps/frontend-editor
docker build -t $REGISTRY/rosetta/backend:v1 ./services/backend
docker build -t $REGISTRY/rosetta/backend-editor:v1 ./services/backend-editor
docker build -t $REGISTRY/rosetta/auth-service:v1 ./services/auth-service
docker build -f docker/nginx/Dockerfile.azure -t $REGISTRY/nginx:v1 docker/nginx

# Push all
docker push $REGISTRY/rosetta/frontend:v1
docker push $REGISTRY/rosetta/frontend-editor:v1
docker push $REGISTRY/rosetta/backend:v1
docker push $REGISTRY/rosetta/backend-editor:v1
docker push $REGISTRY/rosetta/auth-service:v1
docker push $REGISTRY/nginx:v1
```

### 6.2 Set Variables

```bash
# Registry credentials
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username --output tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" --output tsv)
REGISTRY="$ACR_NAME.azurecr.io"

# Your Azure AD credentials (from your .env file)
CLIENT_ID="your-client-id"
CLIENT_SECRET="your-client-secret"
TENANT_ID="your-tenant-id"

# Database connection strings (from previous steps)
PG_CONNECTION="postgresql://rosettaadmin:PASSWORD@psql-rosetta.postgres.database.azure.com:5432/rosetta?sslmode=require"
MONGODB_URI="your-cosmos-connection-string"

# Nginx domain (set after deploying nginx in step 6.6)
NGINX_DOMAIN="nginx.purplebay-xxx.westeurope.azurecontainerapps.io"
```

### 6.3 Deploy Backend Services (Internal)

These are only accessible within the Container Apps environment:

```bash
# Backend (Go)
az containerapp create \
  --resource-group rg-rosetta \
  --name backend \
  --environment cae-rosetta \
  --image $REGISTRY/rosetta/backend:v1 \
  --registry-server $REGISTRY \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD \
  --target-port 8080 \
  --ingress internal \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.5 --memory 1Gi \
  --env-vars \
    "RUNNING_IN_DOCKER=true" \
    "CLIENT_ID=$CLIENT_ID" \
    "TENANT_ID=$TENANT_ID" \
    "PG_DB_URL=$PG_CONNECTION"

# Backend Editor (Node.js)
az containerapp create \
  --resource-group rg-rosetta \
  --name backend-editor \
  --environment cae-rosetta \
  --image $REGISTRY/rosetta/backend-editor:v1 \
  --registry-server $REGISTRY \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD \
  --target-port 3001 \
  --ingress internal \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.5 --memory 1Gi \
  --env-vars \
    "MONGODB_URI=$MONGODB_URI" \
    "CLIENT_ID=$CLIENT_ID" \
    "TENANT_ID=$TENANT_ID"

# Auth Service (Go)
# Note: OIDC_REDIRECT_URI must point to the nginx domain (update after step 6.6)
az containerapp create \
  --resource-group rg-rosetta \
  --name auth-service \
  --environment cae-rosetta \
  --image $REGISTRY/rosetta/auth-service:v1 \
  --registry-server $REGISTRY \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD \
  --target-port 3002 \
  --ingress internal \
  --min-replicas 1 \
  --max-replicas 2 \
  --cpu 0.25 --memory 0.5Gi \
  --env-vars \
    "OIDC_CLIENT_ID=$CLIENT_ID" \
    "OIDC_CLIENT_SECRET=$CLIENT_SECRET" \
    "OIDC_ISSUER=$TENANT_ID" \
    "OIDC_REDIRECT_URI=https://$NGINX_DOMAIN/auth/callback"

# Enable HTTP traffic from nginx (required for internal ingress)
az containerapp ingress update --name backend --resource-group rg-rosetta --allow-insecure
az containerapp ingress update --name backend-editor --resource-group rg-rosetta --allow-insecure
az containerapp ingress update --name auth-service --resource-group rg-rosetta --allow-insecure
```

See [ADR-002: Internal Ingress](./adr/ADR-002-internal-ingress.md) for details on why `--allow-insecure` is required.

### 6.4 Deploy Frontend Services (Internal)

Frontend services are also internal - only nginx is exposed to the internet:

```bash
# Frontend
az containerapp create \
  --resource-group rg-rosetta \
  --name frontend \
  --environment cae-rosetta \
  --image $REGISTRY/rosetta/frontend:v1 \
  --registry-server $REGISTRY \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD \
  --target-port 80 \
  --ingress internal \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.25 --memory 0.5Gi

# Frontend Editor
az containerapp create \
  --resource-group rg-rosetta \
  --name frontend-editor \
  --environment cae-rosetta \
  --image $REGISTRY/rosetta/frontend-editor:v1 \
  --registry-server $REGISTRY \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD \
  --target-port 80 \
  --ingress internal \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.25 --memory 0.5Gi

# Enable HTTP traffic from nginx
az containerapp ingress update --name frontend --resource-group rg-rosetta --allow-insecure
az containerapp ingress update --name frontend-editor --resource-group rg-rosetta --allow-insecure
```

### 6.5 Deploy Nginx Reverse Proxy (External)

Nginx is the **only service with external ingress** - it routes all traffic to internal services.

```bash
az containerapp create \
  --resource-group rg-rosetta \
  --name nginx \
  --environment cae-rosetta \
  --image $REGISTRY/nginx:v1 \
  --registry-server $REGISTRY \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD \
  --target-port 80 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.25 --memory 0.5Gi
```

### 6.6 Get Your App URL

```bash
# Get the nginx domain - this is the only public URL
az containerapp show --name nginx --resource-group rg-rosetta \
  --query "properties.configuration.ingress.fqdn" --output tsv
```

**Save this domain** - you need it for:
1. Microsoft Entra ID callback URL: `https://<nginx-domain>/auth/callback`
2. Environment variables (`ROSETTA_FE`, `OIDC_REDIRECT_URI`)

### 6.7 Update Environment Variables

After getting the nginx domain, update services with the correct URLs:

```bash
NGINX_DOMAIN="nginx.purplebay-xxx.westeurope.azurecontainerapps.io"  # Replace with actual

# Update backend CORS configuration
az containerapp update --name backend --resource-group rg-rosetta \
  --set-env-vars "ROSETTA_FE=https://$NGINX_DOMAIN"

# Update auth-service redirect URI
az containerapp update --name auth-service --resource-group rg-rosetta \
  --set-env-vars "OIDC_REDIRECT_URI=https://$NGINX_DOMAIN/auth/callback"
```

### 6.8 Configure Microsoft Entra ID

Register the callback URL in Microsoft Entra ID:

1. Go to **Azure Portal** → **Microsoft Entra ID** → **App registrations**
2. Select your app
3. Go to **Authentication** → **Web** → **Redirect URIs**
4. Add: `https://<nginx-domain>/auth/callback`
5. Save

Your app is now live at `https://<nginx-domain>/`

---

## Step 7: Configure Azure DevOps Pipeline

### 7.1 Create Service Connections

In Azure DevOps:

1. Go to **Project Settings** → **Service connections**
2. Create **Azure Resource Manager** connection:
   - Type: Service principal (automatic)
   - Subscription: Your subscription
   - Resource group: `rg-rosetta`
   - Name: `azure-rosetta-connection`

3. Create **Docker Registry** connection:
   - Type: Azure Container Registry
   - Registry: Your ACR
   - Name: `acr-rosetta-connection`

### 7.2 Create Variable Group

In **Pipelines** → **Library**:

1. Create variable group: `rosetta-variables`
2. Add these variables:

| Name | Value | Secret |
|------|-------|--------|
| acrLoginServer | rosettaacr.azurecr.io | No |
| resourceGroup | rg-rosetta | No |
| clientId | your-client-id | Yes |
| clientSecret | your-client-secret | Yes |
| tenantId | your-tenant-id | Yes |
| pgConnectionString | postgresql://... | Yes |
| mongodbUri | mongodb://... | Yes |

### 7.3 Pipeline Configuration

Update `azure-pipelines.yml`:

```yaml
trigger:
  branches:
    include:
      - main

variables:
  - group: rosetta-variables
  - name: imageTag
    value: '$(Build.BuildId)'

stages:
  # BUILD & TEST
  - stage: Build
    jobs:
      - job: Test
        pool:
          vmImage: 'ubuntu-latest'
        steps:
          - task: GoTool@0
            inputs:
              version: '1.21'
          - script: |
              cd services/backend && go test ./...
              cd ../auth-service && go test ./...
            displayName: 'Test Go'

          - task: NodeTool@0
            inputs:
              versionSpec: '20.x'
          - script: |
              cd services/backend-editor && npm ci && npm run build
            displayName: 'Build Node'

  # BUILD DOCKER IMAGES
  - stage: Docker
    dependsOn: Build
    condition: eq(variables['Build.SourceBranch'], 'refs/heads/main')
    jobs:
      - job: BuildPush
        pool:
          vmImage: 'ubuntu-latest'
        steps:
          - task: Docker@2
            displayName: 'frontend'
            inputs:
              containerRegistry: 'acr-rosetta-connection'
              repository: 'rosetta/frontend'
              command: 'buildAndPush'
              Dockerfile: 'apps/frontend/Dockerfile'
              buildContext: 'apps/frontend'
              tags: '$(imageTag)'

          - task: Docker@2
            displayName: 'frontend-editor'
            inputs:
              containerRegistry: 'acr-rosetta-connection'
              repository: 'rosetta/frontend-editor'
              command: 'buildAndPush'
              Dockerfile: 'apps/frontend-editor/Dockerfile'
              buildContext: 'apps/frontend-editor'
              tags: '$(imageTag)'

          - task: Docker@2
            displayName: 'backend'
            inputs:
              containerRegistry: 'acr-rosetta-connection'
              repository: 'rosetta/backend'
              command: 'buildAndPush'
              Dockerfile: 'services/backend/Dockerfile'
              buildContext: 'services/backend'
              tags: '$(imageTag)'

          - task: Docker@2
            displayName: 'backend-editor'
            inputs:
              containerRegistry: 'acr-rosetta-connection'
              repository: 'rosetta/backend-editor'
              command: 'buildAndPush'
              Dockerfile: 'services/backend-editor/Dockerfile'
              buildContext: 'services/backend-editor'
              tags: '$(imageTag)'

          - task: Docker@2
            displayName: 'auth-service'
            inputs:
              containerRegistry: 'acr-rosetta-connection'
              repository: 'rosetta/auth-service'
              command: 'buildAndPush'
              Dockerfile: 'services/auth-service/Dockerfile'
              buildContext: 'services/auth-service'
              tags: '$(imageTag)'

  # DEPLOY
  - stage: Deploy
    dependsOn: Docker
    jobs:
      - deployment: Deploy
        pool:
          vmImage: 'ubuntu-latest'
        environment: 'rosetta-prod'
        strategy:
          runOnce:
            deploy:
              steps:
                - task: AzureCLI@2
                  displayName: 'Deploy apps'
                  inputs:
                    azureSubscription: 'azure-rosetta-connection'
                    scriptType: 'bash'
                    scriptLocation: 'inlineScript'
                    inlineScript: |
                      for app in frontend frontend-editor backend backend-editor auth-service; do
                        echo "Deploying $app..."
                        az containerapp update \
                          --resource-group $(resourceGroup) \
                          --name $app \
                          --image $(acrLoginServer)/rosetta/$app:$(imageTag)
                      done
```

---

## Troubleshooting

### View Logs

```bash
# Live logs
az containerapp logs show --name backend --resource-group rg-rosetta --follow

# Recent logs
az containerapp logs show --name backend --resource-group rg-rosetta --tail 100

# Nginx logs (check routing issues)
az containerapp logs show --name nginx --resource-group rg-rosetta --tail 100
```

### Check Status

```bash
az containerapp show --name backend --resource-group rg-rosetta --output table

# Check ingress configuration for all services
for app in frontend frontend-editor backend backend-editor auth-service nginx; do
  echo "=== $app ==="
  az containerapp ingress show --name $app --resource-group rg-rosetta \
    --query "{type:type, allowInsecure:allowInsecure}" -o table
done
```

### Common Issues

| Problem | Solution |
|---------|----------|
| App won't start | Check logs, verify env vars |
| 502 error | App starting up, or wrong port |
| Can't connect to DB | Check firewall rules, connection string |
| Image not found | Verify ACR name and image tag |
| **426 Upgrade Required** | Run `az containerapp ingress update --name <app> --allow-insecure` |
| **400 Bad Request: Header Too Large** | Add large header buffers to nginx config (see ADR-003) |
| **403 CORS Error on POST** | Update `ROSETTA_FE` env var to nginx domain |
| **301 Redirect to internal URL** | Enable `--allow-insecure` on the service |

### 426 Upgrade Required Error

This happens when nginx tries to proxy HTTP to a service with `allowInsecure: false`:

```bash
# Fix: Enable HTTP traffic
az containerapp ingress update --name <service> --resource-group rg-rosetta --allow-insecure
```

### 400 Bad Request: Header Too Large

Microsoft OAuth tokens are large (~2-4KB). Add to nginx configs:

```nginx
client_header_buffer_size 4k;
large_client_header_buffers 8 64k;
```

See [ADR-003: Cookie-Based Authentication](./adr/ADR-003-cookie-authentication.md).

### Restart App

```bash
az containerapp revision restart --name backend --resource-group rg-rosetta
```

---

## Cost Management

### Estimated Monthly Costs

| Resource | Cost |
|----------|------|
| Container Apps (6 apps including nginx) | ~$40-60 |
| PostgreSQL (B1ms) | ~$12 |
| Cosmos DB (Serverless) | ~$5-15 |
| Redis (Basic) | ~$16 |
| Container Registry | ~$5 |
| **Total** | **~$80-110** |

### Cost-Saving Tips

1. Set `--min-replicas 0` to scale to zero when idle
2. Use Burstable database tiers
3. Use Serverless Cosmos DB
4. Delete unused resources

### Set Up Budget Alerts

```bash
# Create a budget with email alerts
az consumption budget create \
  --budget-name "rosetta-monthly" \
  --resource-group rg-rosetta \
  --amount 100 \
  --time-grain Monthly \
  --category Cost \
  --start-date "2025-01-01" \
  --end-date "2026-12-31" \
  --notification-key "Alert80" \
  --notification-enabled true \
  --notification-operator GreaterThan \
  --notification-threshold 80 \
  --notification-contact-emails "your-email@example.com"
```

View costs in the Azure Portal: **Cost Management + Billing** → **Cost analysis**

---

## Quick Reference

```bash
# List apps
az containerapp list --resource-group rg-rosetta --output table

# Update image
az containerapp update --name <app> --resource-group rg-rosetta --image <new-image>

# View public URL (nginx only)
az containerapp show --name nginx --resource-group rg-rosetta --query "properties.configuration.ingress.fqdn"

# Stream logs
az containerapp logs show --name <app> --resource-group rg-rosetta --follow

# Rebuild and deploy nginx
docker build -f docker/nginx/Dockerfile.azure -t rosettaacr.azurecr.io/nginx:v2 docker/nginx
docker push rosettaacr.azurecr.io/nginx:v2
az containerapp update --name nginx --resource-group rg-rosetta --image rosettaacr.azurecr.io/nginx:v2

# Delete everything
az group delete --name rg-rosetta --yes
```

---

## Related Documentation

- [ADR-001: Nginx Reverse Proxy](./adr/ADR-001-nginx-reverse-proxy.md) - Why we use nginx for single-domain routing
- [ADR-002: Internal Ingress](./adr/ADR-002-internal-ingress.md) - Internal vs external ingress configuration
- [ADR-003: Cookie Authentication](./adr/ADR-003-cookie-authentication.md) - OAuth cookie handling and large header buffers
- [Deployment Concepts](./Deployment-Concepts.md) - Azure Container Apps architecture concepts
