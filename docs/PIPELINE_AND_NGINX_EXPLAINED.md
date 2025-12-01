# Azure Pipeline & Nginx Architecture - Complete Explanation

## Table of Contents
1. [Overview](#overview)
2. [The Big Picture](#the-big-picture)
3. [Azure Pipeline Deep Dive](#azure-pipeline-deep-dive)
4. [Nginx Reverse Proxy](#nginx-reverse-proxy)
5. [How They Work Together](#how-they-work-together)
6. [Development vs Production](#development-vs-production)

---

## Overview

Your Rosetta platform has **two separate but complementary systems**:

1. **Azure Pipeline** - Automates building, testing, and deploying code
2. **Nginx** - Routes incoming traffic to the right services

**They are NOT the same thing!** Here's the key difference:

| Aspect | Azure Pipeline | Nginx |
|--------|---------------|-------|
| **Purpose** | Build & Deploy automation | Traffic routing |
| **When it runs** | When you push code to Git | Always running in production |
| **Where it runs** | Azure DevOps cloud | Inside your infrastructure |
| **What it does** | Compile code → Create Docker images → Deploy | Route HTTP requests → Load balance → Security |

---

## The Big Picture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT WORKFLOW                          │
└─────────────────────────────────────────────────────────────────┘

1. Developer pushes code to Azure DevOps
                    ↓
2. Azure Pipeline AUTOMATICALLY triggers
                    ↓
   ┌────────────────────────────────────────────────┐
   │  STAGE 1: Build & Test (5-10 minutes)         │
   │  ✓ Compile Go services                        │
   │  ✓ Build React frontends                      │
   │  ✓ Run all tests                              │
   │  ✓ Check code quality                         │
   └────────────────────────────────────────────────┘
                    ↓
   ┌────────────────────────────────────────────────┐
   │  STAGE 2: Build Docker Images (10-15 minutes) │
   │  ✓ Create backend Docker image                │
   │  ✓ Create frontend Docker image               │
   │  ✓ Create auth-service Docker image           │
   │  ✓ Create be-editor Docker image              │
   │  ✓ Create fe-editor Docker image              │
   │  ✓ Push all images to Azure Container Registry│
   └────────────────────────────────────────────────┘
                    ↓
   ┌────────────────────────────────────────────────┐
   │  STAGE 3: Deploy to DEV (2-5 minutes)         │
   │  ✓ Pull Docker images                         │
   │  ✓ Start containers on Azure Web Apps         │
   │  ✓ Configure nginx routing                    │
   └────────────────────────────────────────────────┘
                    ↓
   ┌────────────────────────────────────────────────┐
   │  STAGE 4: Deploy to PROD (2-5 minutes)        │
   │  ⚠️  Requires manual approval!                 │
   │  ✓ Deploy to production servers               │
   └────────────────────────────────────────────────┘
                    ↓
3. Services are now running in Azure
                    ↓
4. Nginx routes traffic to those services

┌─────────────────────────────────────────────────────────────────┐
│                    PRODUCTION TRAFFIC FLOW                       │
└─────────────────────────────────────────────────────────────────┘

Internet User makes request → nginx → Your Services
```

---

## Azure Pipeline Deep Dive

### What is the Azure Pipeline?

The Azure Pipeline is a **CI/CD (Continuous Integration / Continuous Deployment) automation system**. Think of it as a robot that:
1. Watches your Git repository
2. When you push code, it automatically:
   - Builds your code
   - Runs tests
   - Creates Docker containers
   - Deploys to servers

### Pipeline Structure

Your pipeline has **4 stages** that run in sequence:

```yaml
┌──────────────────────────────────────────────────────────────────┐
│ STAGE 1: Build & Test (ALWAYS RUNS)                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Job 1: Build Backend (Go)                                      │
│  ├─ Install Go 1.21                                             │
│  ├─ Download dependencies (go mod download)                     │
│  ├─ Run tests (go test)                                         │
│  ├─ Build binary (go build)                                     │
│  └─ Publish test results & code coverage                        │
│                                                                  │
│  Job 2: Build Auth Service (Go)                                 │
│  ├─ Install Go 1.21                                             │
│  ├─ Download dependencies                                       │
│  ├─ Run tests                                                   │
│  └─ Build binary                                                │
│                                                                  │
│  Job 3: Build Backend Editor (Node.js)                          │
│  ├─ Install Node.js 20                                          │
│  ├─ Install dependencies (npm ci)                               │
│  ├─ Build TypeScript (npm run build)                            │
│  └─ Run tests (npm test)                                        │
│                                                                  │
│  Job 4: Build Frontend (React)                                  │
│  ├─ Install Node.js 20                                          │
│  ├─ Install dependencies (npm ci)                               │
│  ├─ Build React app (npm run build)                             │
│  ├─ Run linting (npm run lint)                                  │
│  └─ Publish build artifacts                                     │
│                                                                  │
│  Job 5: Build Frontend Editor (React)                           │
│  ├─ Install Node.js 20                                          │
│  ├─ Install dependencies                                        │
│  ├─ Build React app                                             │
│  └─ Publish build artifacts                                     │
│                                                                  │
│  ⏱️  Duration: ~5-10 minutes                                     │
│  🎯 Goal: Verify code compiles and tests pass                   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
                    (Only if all tests pass)
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ STAGE 2: Build Docker Images (ONLY ON 'main' BRANCH)            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ⚙️  Condition: Only runs if:                                    │
│     - Stage 1 succeeded                                          │
│     - Branch is 'main' (not develop or feature branches)         │
│                                                                  │
│  For EACH service:                                               │
│  1. Read Dockerfile                                              │
│  2. Build Docker image                                           │
│  3. Tag with build ID (e.g., "123") and "latest"                │
│  4. Push to Azure Container Registry                             │
│                                                                  │
│  Images created:                                                 │
│  ├─ yourregistry.azurecr.io/rosetta/backend:123                 │
│  ├─ yourregistry.azurecr.io/rosetta/auth-service:123            │
│  ├─ yourregistry.azurecr.io/rosetta/backend-editor:123          │
│  ├─ yourregistry.azurecr.io/rosetta/frontend:123                │
│  └─ yourregistry.azurecr.io/rosetta/frontend-editor:123         │
│                                                                  │
│  ⏱️  Duration: ~10-15 minutes                                    │
│  🎯 Goal: Package code into deployable containers               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
                    (Only if images built successfully)
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ STAGE 3: Deploy to DEV (ONLY ON 'main' BRANCH)                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ⚙️  Condition: Only runs if:                                    │
│     - Stage 2 succeeded                                          │
│     - Branch is 'main'                                           │
│                                                                  │
│  Environment: rosetta-dev                                        │
│                                                                  │
│  For EACH service:                                               │
│  1. Connect to Azure Web App                                     │
│  2. Pull Docker image from ACR                                   │
│  3. Stop old container                                           │
│  4. Start new container                                          │
│  5. Health check                                                 │
│                                                                  │
│  Azure Web Apps deployed:                                        │
│  ├─ rosetta-backend-dev                                          │
│  ├─ rosetta-auth-dev                                             │
│  ├─ rosetta-backend-editor-dev                                   │
│  ├─ rosetta-frontend-dev                                         │
│  └─ rosetta-editor-dev                                           │
│                                                                  │
│  ⏱️  Duration: ~2-5 minutes                                      │
│  🎯 Goal: Deploy to development for testing                     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
                    (Only if dev deployment succeeded)
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ STAGE 4: Deploy to PROD (REQUIRES MANUAL APPROVAL)              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ⚠️  IMPORTANT: Pipeline PAUSES here                             │
│     Waiting for approval from team lead                          │
│                                                                  │
│  ⚙️  Condition: Only runs if:                                    │
│     - Stage 3 succeeded                                          │
│     - Branch is 'main'                                           │
│     - A designated approver clicks "Approve"                     │
│                                                                  │
│  Environment: rosetta-prod (with approval gate)                  │
│                                                                  │
│  Same deployment process as DEV, but to production servers       │
│                                                                  │
│  Azure Web Apps deployed:                                        │
│  ├─ rosetta-backend-prod                                         │
│  ├─ rosetta-auth-prod                                            │
│  ├─ rosetta-backend-editor-prod                                  │
│  ├─ rosetta-frontend-prod                                        │
│  └─ rosetta-editor-prod                                          │
│                                                                  │
│  ⏱️  Duration: ~2-5 minutes (after approval)                     │
│  🎯 Goal: Deploy to production for end users                    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Pipeline Triggers

Your pipeline has **smart triggers** to avoid wasting resources:

```yaml
# Triggers on push to main or develop branch
trigger:
  branches:
    include:
      - main
      - develop
  paths:
    include:
      - services/*      # Only if service code changes
      - apps/*          # Only if app code changes
      - docker/*        # Only if Docker config changes

# Triggers on Pull Requests to main or develop
pr:
  branches:
    include:
      - main
      - develop
```

**What this means:**
- Push to `feature/new-login` → Pipeline does NOT run
- Push to `develop` → Pipeline runs Stages 1 only (build & test)
- Push to `main` → Pipeline runs ALL 4 stages (build, test, deploy dev, deploy prod)
- Change only README.md → Pipeline does NOT run (no code changed)

---

## Nginx Reverse Proxy

### What is Nginx?

**Nginx** is a web server that acts as a **"traffic cop"** for your application. When a user visits your website, nginx:

1. **Receives the HTTP request**
2. **Looks at the URL path**
3. **Routes it to the correct service**
4. **Returns the response to the user**

### Why Do You Need Nginx?

Without nginx, you'd have problems:

```
❌ WITHOUT NGINX:
User → backend:8080      (Have to remember port numbers)
User → auth:3002         (Services exposed directly)
User → frontend:3000     (No security layer)
User → editor:3001       (No load balancing)

✅ WITH NGINX:
User → nginx:80 → Automatically routes to correct service
                → Load balances across multiple backends
                → Adds security (rate limiting)
                → Single entry point
```

### Nginx Routing Rules

Your nginx configuration creates these routes:

```
┌─────────────────────────────────────────────────────────────────┐
│                     NGINX ROUTING TABLE                          │
├──────────────────┬───────────────────┬──────────────────────────┤
│ User requests    │ Nginx routes to   │ Purpose                  │
├──────────────────┼───────────────────┼──────────────────────────┤
│ /auth/login      │ auth-service:3002 │ OAuth login              │
│ /auth/callback   │ auth-service:3002 │ OAuth callback           │
│ /auth/validate   │ auth-service:3002 │ Token validation         │
│ /auth/logout     │ auth-service:3002 │ Logout                   │
├──────────────────┼───────────────────┼──────────────────────────┤
│ /api/*           │ backend:8080      │ Main API endpoints       │
│                  │ (load balanced)   │ Learning paths, users    │
├──────────────────┼───────────────────┼──────────────────────────┤
│ /editor/ws       │ be-editor:3001    │ WebSocket collaboration  │
│ /editor/*        │ be-editor:3001    │ Diagram CRUD operations  │
├──────────────────┼───────────────────┼──────────────────────────┤
│ /studio/*        │ fe-editor:80      │ Diagram editor UI        │
├──────────────────┼───────────────────┼──────────────────────────┤
│ /*               │ frontend:80       │ Main React app           │
│ (everything else)│                   │ (default/fallback)       │
└──────────────────┴───────────────────┴──────────────────────────┘
```

### Example Traffic Flow

Let's trace a real user request through nginx:

```
SCENARIO: User logs in to your platform

1. User clicks "Login" button in browser
   ↓
2. Browser sends: GET http://yourapp.com/auth/login
   ↓
3. Request hits nginx (port 80)
   ↓
4. Nginx reads request URL: "/auth/login"
   ↓
5. Nginx checks routing rules → Matches "/auth/login"
   ↓
6. Nginx forwards to: http://auth-service:3002/auth/login
   ↓
7. Auth service processes login
   ↓
8. Auth service returns: HTTP 302 Redirect to Microsoft OAuth
   ↓
9. Nginx forwards response back to user's browser
   ↓
10. User is redirected to Microsoft login page
```

### Nginx Load Balancing

Your backend has **3 replicas** for high availability:

```yaml
# In nginx config
upstream be {
    least_conn;  # Route to server with fewest connections

    server backend-1:8080 max_fails=3 fail_timeout=30s;
    server backend-2:8080 max_fails=3 fail_timeout=30s;
    server backend-3:8080 max_fails=3 fail_timeout=30s;
}
```

**How it works:**

```
Request 1: /api/learning-paths → nginx → backend-1 (least busy)
Request 2: /api/users          → nginx → backend-2 (least busy)
Request 3: /api/learning-paths → nginx → backend-3 (least busy)
Request 4: /api/users          → nginx → backend-1 (back to 1)

If backend-2 crashes:
  ↓
nginx detects failure (max_fails=3)
  ↓
nginx stops sending traffic to backend-2
  ↓
All requests go to backend-1 and backend-3
  ↓
When backend-2 recovers, nginx resumes sending traffic
```

### Nginx Security Features

Your nginx config includes **rate limiting** to prevent abuse:

```nginx
# Auth login - 10 requests per minute per IP
limit_req_zone $binary_remote_addr zone=auth_login:10m rate=10r/m;

# Auth validate - 60 requests per minute per IP
limit_req_zone $binary_remote_addr zone=auth_validate:10m rate=60r/m;

# API endpoints - 10 requests per second per IP
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

# Editor endpoints - 10 requests per second per IP
limit_req_zone $binary_remote_addr zone=editor_limit:10m rate=10r/s;
```

**What this prevents:**

```
❌ WITHOUT RATE LIMITING:
Attacker → /auth/login (1000 req/sec) → Server overloaded → Everyone affected

✅ WITH RATE LIMITING:
Attacker → /auth/login (1000 req/sec) → nginx blocks after 10/min
Normal User → /auth/login → Works fine
```

---

## How They Work Together

### Development Flow

```
┌────────────────────────────────────────────────────────────────┐
│                  LOCAL DEVELOPMENT                             │
└────────────────────────────────────────────────────────────────┘

1. Developer writes code locally
                ↓
2. Runs: docker-compose up
                ↓
   Docker starts:
   - All 5 services
   - Nginx container
   - PostgreSQL
   - MongoDB
                ↓
3. Nginx routes traffic locally:
   http://localhost/api/* → backend:8080
   http://localhost/auth/* → auth-service:3002
   etc.
                ↓
4. Developer tests in browser: http://localhost
                ↓
5. Everything works? Push to Git
                ↓

┌────────────────────────────────────────────────────────────────┐
│               AZURE PIPELINE (CI/CD)                           │
└────────────────────────────────────────────────────────────────┘

6. git push origin develop
                ↓
7. Azure Pipeline triggers automatically
                ↓
8. Stage 1: Build & Test (all services)
   If tests fail → Pipeline stops → Developer fixes
   If tests pass → Continue
                ↓
9. (On 'main' branch only)
   Stage 2: Build Docker images
                ↓
10. Stage 3: Deploy to DEV environment
                ↓
11. Stage 4: Deploy to PROD (with approval)

┌────────────────────────────────────────────────────────────────┐
│              PRODUCTION (AZURE CLOUD)                          │
└────────────────────────────────────────────────────────────────┘

12. Azure Web Apps running your Docker containers
                ↓
13. Azure Load Balancer (or nginx) routes traffic
                ↓
14. Users access: https://rosetta.yourcompany.com
```

### Local Development vs Production

| Aspect | Local (docker-compose) | Production (Azure) |
|--------|------------------------|-------------------|
| **Services** | All run on your laptop | Each service in separate Azure Web App |
| **Nginx** | Runs in Docker container | Could be Azure Load Balancer OR nginx container |
| **Database** | PostgreSQL & MongoDB in Docker | Azure Database for PostgreSQL + Cosmos DB |
| **URLs** | http://localhost | https://rosetta.yourcompany.com |
| **SSL** | No HTTPS | HTTPS with Azure certificates |
| **Load Balancing** | nginx (3 backend replicas) | Azure Load Balancer + nginx |
| **Pipeline** | NOT used | Triggered on git push |

---

## Development vs Production

### Scenario 1: Local Development

```bash
# You run this command
docker-compose up

# What happens:
1. Docker reads docker-compose.yml
2. Builds 5 services from Dockerfiles
3. Starts nginx container
4. Starts PostgreSQL & MongoDB
5. Nginx binds to port 80 on your laptop

# Access your app:
http://localhost         → frontend
http://localhost/api     → backend
http://localhost/auth    → auth-service
http://localhost/editor  → be-editor
http://localhost/studio  → fe-editor

# No Azure Pipeline involved!
# Everything runs locally
```

### Scenario 2: Deploy to Azure

```bash
# You run this command
git push origin main

# What happens:
1. Azure DevOps detects new commit
2. Pipeline Stage 1: Build & Test (5-10 min)
   - Compiles all code
   - Runs all tests
   - Fails if any test fails

3. Pipeline Stage 2: Build Docker Images (10-15 min)
   - Creates Docker images
   - Pushes to Azure Container Registry

4. Pipeline Stage 3: Deploy to DEV (2-5 min)
   - Pulls images from ACR
   - Updates Azure Web Apps
   - Services restart automatically

5. Pipeline Stage 4: Deploy to PROD (2-5 min)
   - Waits for manual approval
   - Same process as DEV

6. Users access:
   https://rosetta-dev.yourcompany.com  (DEV)
   https://rosetta.yourcompany.com      (PROD)
```

---

## Common Questions

### Q1: Does the pipeline run nginx?

**No!** The pipeline **builds and deploys** your services. Nginx is **one of those services** that gets deployed.

```
Pipeline builds:
  ├─ backend Docker image
  ├─ frontend Docker image
  ├─ nginx Docker image (with your config)
  └─ etc.

Then deploys them to Azure Web Apps
where they run 24/7
```

### Q2: Do I need nginx locally?

**Yes, for local development**. Your docker-compose.yml includes nginx so you can test the full routing locally.

### Q3: Can I test the pipeline locally?

**Partially**. You can:
- ✅ Run `go test` manually (simulates Stage 1 for Go services)
- ✅ Run `npm run build` manually (simulates Stage 1 for React)
- ✅ Build Docker images manually: `docker build -t myimage .`
- ❌ Cannot fully simulate Azure deployment stages

### Q4: What if the pipeline fails?

```
Build fails → Check build logs in Azure DevOps
              → Fix the error in code
              → Push again
              → Pipeline retries automatically

Tests fail  → Check test logs in Azure DevOps
              → Fix failing tests
              → Push again

Deploy fails → Check deployment logs
               → Usually means Azure config issue
               → Check service connection settings
```

### Q5: How do I see nginx logs?

**Local development:**
```bash
docker-compose logs nginx
```

**Production (Azure):**
```bash
# Access Azure Web App logs
az webapp log tail --name rosetta-frontend-prod --resource-group YourResourceGroup
```

### Q6: Can I change nginx config without redeploying everything?

**Local:** Yes! Just:
```bash
# Edit docker/nginx/nginx.docker.conf
docker-compose restart nginx
```

**Production:** You need to:
1. Edit `docker/nginx/nginx.docker.conf`
2. Commit and push to git
3. Pipeline will rebuild and redeploy nginx container

---

## Summary

### Azure Pipeline Purpose:
- **Automates** building, testing, and deploying your code
- **Runs** when you push to git
- **Creates** Docker images
- **Deploys** to Azure Web Apps

### Nginx Purpose:
- **Routes** HTTP traffic to correct services
- **Load balances** across multiple backend replicas
- **Secures** your app with rate limiting
- **Runs** 24/7 in your infrastructure

### They Work Together:
1. **Pipeline** builds nginx Docker image (with your config)
2. **Pipeline** deploys nginx to Azure
3. **Nginx** routes traffic to services deployed by pipeline
4. **Users** access app through nginx

---

## Next Steps

1. ✅ **Complete Azure Pipeline Setup** (follow the guide)
2. ✅ **Test pipeline** by making a small code change and pushing
3. ✅ **Monitor pipeline** execution in Azure DevOps
4. ✅ **Check nginx logs** after deployment to verify routing works

---

## Useful Commands Reference

```bash
# Local Development
docker-compose up                    # Start all services with nginx
docker-compose logs nginx            # View nginx logs
docker-compose logs backend-1        # View backend logs
curl http://localhost/health         # Test nginx health

# Test Routing Locally
curl http://localhost/api/health     # Should route to backend
curl http://localhost/auth/login     # Should route to auth-service

# Azure Pipeline
# View at: https://dev.azure.com/carbyte/Carbyte-Academy/_build

# View Running Services (Azure)
az webapp list --resource-group YourResourceGroup
az webapp log tail --name rosetta-frontend-prod
```
