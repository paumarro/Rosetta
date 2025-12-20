# Azure Deployment Concepts Guide

A deep dive into the concepts behind deploying applications to Microsoft Azure. This guide explains the "why" behind each step in the [Deployment Guide](./Deployment.md).

---

## Table of Contents

1. [Cloud Computing Fundamentals](#1-cloud-computing-fundamentals)
2. [Resource Groups](#2-resource-groups)
3. [Containers](#3-containers)
4. [Container Registry](#4-container-registry)
5. [Container Apps](#5-container-apps)
6. [Ingress & Networking](#6-ingress--networking)
7. [Managed Databases](#7-managed-databases)
8. [CI/CD Pipelines](#8-cicd-pipelines)
9. [Authentication & Security](#9-authentication--security)
10. [Monitoring & Logging](#10-monitoring--logging)
11. [Cost Management](#11-cost-management)

---

## 1. Cloud Computing Fundamentals

### What is Cloud Computing?

**Traditional (On-Premise):**
```
Your Office
┌─────────────────────────────────────┐
│  Server Room                        │
│  ┌─────┐ ┌─────┐ ┌─────┐           │
│  │ DB  │ │ App │ │ Web │           │
│  └─────┘ └─────┘ └─────┘           │
│                                     │
│  You maintain: hardware, power,     │
│  cooling, security, networking...   │
└─────────────────────────────────────┘
```

**Cloud Computing:**
```
Microsoft's Data Center (Azure)
┌─────────────────────────────────────┐
│  Managed by Microsoft               │
│  ┌─────┐ ┌─────┐ ┌─────┐           │
│  │ DB  │ │ App │ │ Web │           │
│  └─────┘ └─────┘ └─────┘           │
│                                     │
│  Microsoft handles: hardware,       │
│  power, security, scaling...        │
│                                     │
│  You pay for what you use           │
└─────────────────────────────────────┘
```

**Key Benefits:**
- **No upfront costs**: Pay monthly instead of buying servers
- **Scalability**: Add capacity in minutes, not months
- **Reliability**: Microsoft's infrastructure has 99.9%+ uptime
- **Global reach**: Deploy to data centers worldwide
- **Managed services**: Less operational burden on your team

### Azure's Organizational Hierarchy

Azure organizes resources in a hierarchy. Understanding this helps you navigate the Azure Portal and CLI.

```
┌───────────────────────────────────────────────────────────-──┐
│                     Azure AD Tenant                          │
│  (Your organization's identity: users, groups, apps)         │
│                                                              │
│  ┌────────────────────────────────-───────────────────────┐  │
│  │                    Subscription                        │  │
│  │  (Billing boundary - like a credit card)               │  │
│  │                                                        │  │
│  │  ┌─────────────────────┐  ┌─────────────────────┐      │  │
│  │  │   Resource Group    │  │   Resource Group    │      │  │
│  │  │   (rg-rosetta)      │  │   (rg-other-app)    │      │  │
│  │  │                     │  │                     │      │  │
│  │  │  ┌────┐ ┌────┐      │  │  ┌────┐ ┌────┐      │      │  │
│  │  │  │ DB │ │App │      │  │  │... │ │... │      │      │  │
│  │  │  └────┘ └────┘      │  │  └────┘ └────       │      │  │
│  │  └─────────────────────┘  └─────────────────────┘      │  │
│  └────────────────────────────────────────────────────-───┘  │
└────────────────────────────────────────────────────────-─────┘
```

| Level | What It Is | Analogy |
|-------|------------|---------|
| **Tenant** | Your organization in Azure AD | Your company |
| **Subscription** | Billing and access boundary | A company credit card |
| **Resource Group** | Container for related resources | A project folder |
| **Resource** | Actual service (database, app, etc.) | A file in the folder |

### Why Azure?

For this project, Azure is a natural fit because:
- **Microsoft ecosystem**: Integrates with Azure AD (your company's identity)
- **Azure DevOps**: Native CI/CD integration
- **Enterprise features**: Compliance, security, support

Other clouds (AWS, GCP) offer similar capabilities but require different identity integration.

---

## 2. Resource Groups

### What is a Resource Group?

A **Resource Group** is a logical container that holds related Azure resources. It's like a folder for your project.

```
rg-rosetta (Resource Group)
├── psql-rosetta (PostgreSQL)
├── cosmos-rosetta (Cosmos DB)
├── redis-rosetta (Redis Cache)
├── cae-rosetta (Container Apps Environment)
├── frontend (Container App)
├── backend (Container App)
└── acr-rosetta (Container Registry)
```

### Why Do Resource Groups Matter?

**1. Lifecycle Management**
```
Delete resource group = Delete everything inside
```
This is incredibly useful for:
- Tearing down test environments
- Cleaning up after experiments
- Ensuring nothing is left behind

**2. Access Control**
You can grant permissions at the resource group level:
```
"Developer A can deploy to rg-rosetta-dev"
"Developer B can only view rg-rosetta-prod"
```

**3. Cost Tracking**
Azure bills show costs grouped by resource group. This helps you:
- See how much each project costs
- Identify expensive resources
- Allocate costs to teams/projects

**4. Organization**
When you have dozens of resources, grouping keeps things manageable:
```
rg-rosetta-dev     → Development environment
rg-rosetta-staging → Staging environment
rg-rosetta-prod    → Production environment
```

### Naming Conventions

A good naming convention makes resources easy to identify:

```
{resource-type}-{project}-{environment}-{region}

Examples:
rg-rosetta-prod           (resource group)
psql-rosetta-prod-weu     (PostgreSQL, West Europe)
ca-rosetta-backend-dev    (Container App)
```

Common prefixes:
| Prefix | Resource Type |
|--------|---------------|
| `rg-` | Resource Group |
| `ca-` | Container App |
| `cae-` | Container Apps Environment |
| `psql-` | PostgreSQL |
| `redis-` | Redis Cache |
| `acr` | Container Registry (no hyphen, must be alphanumeric) |

---

## 3. Containers

### What is a Container?

A container is a lightweight, standalone package that includes everything needed to run your application: code, runtime, libraries, and settings.

**Analogy: Shipping Containers**
```
Physical World:
┌─────────────────┐    ┌─────────────────┐
│  Ship Container │    │  Ship Container │
│  ┌───────────┐  │    │  ┌───────────┐  │
│  │ Furniture │  │    │  │Electronics│  │
│  │           │  │    │  │           │  │
│  └───────────┘  │    │  └───────────┘  │
│  Standard size  │    │  Standard size  │
│  Works on any   │    │  Works on any   │
│  ship/truck     │    │  ship/truck     │
└─────────────────┘    └─────────────────┘

Software World:
┌─────────────────┐    ┌─────────────────┐
│    Container    │    │    Container    │
│  ┌───────────┐  │    │  ┌───────────┐  │
│  │  Node.js  │  │    │  │    Go     │  │
│  │  + App    │  │    │  │  + App    │  │
│  └───────────┘  │    │  └───────────┘  │
│  Standard format│    │  Standard format│
│  Works on any   │    │  Works on any   │
│  container host │    │  container host │
└─────────────────┘    └─────────────────┘
```

### Containers vs Virtual Machines

```
Virtual Machines:                    Containers:
┌─────────────────────────┐         ┌─────────────────────────┐
│ ┌─────┐ ┌─────┐ ┌─────┐ │         │ ┌─────┐ ┌─────┐ ┌─────┐ │
│ │App A│ │App B│ │App C│ │         │ │App A│ │App B│ │App C│ │
│ ├─────┤ ├─────┤ ├─────┤ │         │ └──┬──┘ └──┬──┘ └──┬──┘ │
│ │Guest│ │Guest│ │Guest│ │         │    │       │       │    │
│ │ OS  │ │ OS  │ │ OS  │ │         │    └─────-─┼──────-┘    │
│ └─────┘ └─────┘ └─────┘ │         │     Container Runtime   │
│      Hypervisor         │         │     (Docker Engine)     │
│      Host OS            │         │      Host OS            │
│      Hardware           │         │      Hardware           │
└─────────────────────────┘         └─────────────────────────┘
  Heavy: Each VM has full OS          Light: Shared OS kernel
  Slow startup: Minutes               Fast startup: Seconds
  Large: GBs per VM                   Small: MBs per container
```

| Aspect | VMs | Containers |
|--------|-----|------------|
| Startup time | Minutes | Seconds |
| Size | Gigabytes | Megabytes |
| Isolation | Complete | Process-level |
| Resource usage | High | Low |
| Portability | Limited | Excellent |

### Docker Concepts

**Dockerfile** - Recipe for building an image:
```dockerfile
# Start from a base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Define the command to run
CMD ["npm", "start"]
```

**Image** - The built artifact (like a compiled program):
```
┌─────────────────────────────────┐
│         Docker Image            │
│  ┌───────────────────────────┐  │
│  │ Layer 4: Your app code    │  │
│  ├───────────────────────────┤  │
│  │ Layer 3: npm packages     │  │
│  ├───────────────────────────┤  │
│  │ Layer 2: Node.js runtime  │  │
│  ├───────────────────────────┤  │
│  │ Layer 1: Alpine Linux     │  │
│  └───────────────────────────┘  │
│                                 │
│  Read-only, immutable           │
│  Stored in registry             │
└─────────────────────────────────┘
```

**Container** - A running instance of an image:
```
Image (Blueprint)          Container (Running Instance)
┌─────────────────┐        ┌─────────────────┐
│   frontend:v1   │ ─────▶ │   Container 1   │ ← Running
└─────────────────┘   │    └─────────────────┘
                      │    ┌─────────────────┐
                      └──▶ │   Container 2   │ ← Running
                           └─────────────────┘
                           (Same image, two instances)
```

### Why Containers for Deployment?

1. **Consistency**: "Works on my machine" becomes "works everywhere"
2. **Isolation**: Apps don't interfere with each other
3. **Efficiency**: More apps per server than VMs
4. **Speed**: Start in seconds, not minutes
5. **Portability**: Run on any cloud or on-premise

---

## 4. Container Registry

### What is a Container Registry?

A container registry is a storage and distribution system for container images. Think of it as "GitHub for Docker images."

```
Developer Machine                    Container Registry                   Production
┌─────────────────┐                 ┌─────────────────┐                 ┌─────────────────┐
│                 │   docker push   │                 │   docker pull   │                 │
│  Build Image    │ ──────────────▶ │  Store Image    │ ──────────────▶ │  Run Container  │
│  frontend:v1    │                 │  frontend:v1    │                 │  frontend:v1    │
│                 │                 │  frontend:v2    │                 │                 │
└─────────────────┘                 │  backend:v1     │                 └─────────────────┘
                                    │  ...            │
                                    └─────────────────┘
```

### Azure Container Registry (ACR) vs Docker Hub

| Feature | Docker Hub | Azure Container Registry |
|---------|------------|-------------------------|
| Location | Public internet | Azure network (faster) |
| Default access | Public | Private |
| Integration | Generic | Native Azure integration |
| Authentication | Docker credentials | Azure AD, managed identity |
| Pricing | Free tier limited | Pay per storage/transfer |

**Why ACR for Azure deployments?**
- **Speed**: Images don't leave Azure's network
- **Security**: Private by default, Azure AD authentication
- **Integration**: Container Apps can pull without credentials (managed identity)
- **Compliance**: Data stays in your Azure region

### Image Tags

Tags identify different versions of an image:

```
rosettaacr.azurecr.io/rosetta/frontend:v1
└──────────┬─────────┘ └───┬───┘ └──┬──┘ └┬┘
      Registry         Repository  Image  Tag
```

**Tagging Strategies:**

| Tag | Use | Example |
|-----|-----|---------|
| `latest` | Most recent build (dev only) | `frontend:latest` |
| `v1.2.3` | Semantic version (releases) | `frontend:v1.2.3` |
| `abc123` | Git commit SHA (traceability) | `frontend:abc123` |
| `123` | Build number (CI/CD) | `frontend:123` |

**Best Practice**: Never use `latest` in production. Always use specific versions for reproducibility.

### Registry Tiers

| Tier | Storage | Features | Use Case |
|------|---------|----------|----------|
| Basic | 10 GB | Core features | Development |
| Standard | 100 GB | Webhooks, geo-replication | Production |
| Premium | 500 GB | Private endpoints, content trust | Enterprise |

Start with **Basic**, upgrade when needed.

---

## 5. Container Apps

### What is Azure Container Apps?

Azure Container Apps is a serverless platform for running containers. You provide container images; Azure handles the infrastructure.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Azure Container Apps                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    You Manage                              │  │
│  │  • Container images                                        │  │
│  │  • Environment variables                                   │  │
│  │  • Scaling rules                                           │  │
│  │  • Ingress configuration                                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   Azure Manages                            │  │
│  │  • Server hardware                                         │  │
│  │  • Operating system                                        │  │
│  │  • Kubernetes cluster                                      │  │
│  │  • Load balancing                                          │  │
│  │  • HTTPS certificates                                      │  │
│  │  • Scaling infrastructure                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Container Apps vs Other Azure Container Services

```
                    More Control
                         ▲
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         │      Azure Kubernetes         │
         │        Service (AKS)          │
         │    Full Kubernetes cluster    │
         │    You manage everything      │
         │                               │
         ├───────────────┼───────────────┤
         │               │               │
         │    Azure Container Apps       │  ◄── We use this
         │    Serverless containers      │
         │    Azure manages Kubernetes   │
         │                               │
         ├───────────────┼───────────────┤
         │               │               │
         │    Azure Container Instances  │
         │    Single containers          │
         │    No orchestration           │
         │                               │
         ├───────────────┼───────────────┤
         │               │               │
         │    Azure App Service          │
         │    Web apps (PaaS)            │
         │    Limited container support  │
         │               │               │
         └───────────────┼───────────────┘
                         │
                         ▼
                    Less Control
                  (More Managed)
```

| Service | Best For | Complexity |
|---------|----------|------------|
| **Container Apps** | Microservices, APIs, web apps | Low |
| **AKS** | Complex architectures, need full K8s | High |
| **Container Instances** | One-off tasks, simple workloads | Very Low |
| **App Service** | Traditional web apps | Low |

### Key Container Apps Concepts

**Environment**: Secure boundary for your apps
```
┌─────────────────────────────────────────────────────────────┐
│              Container Apps Environment                      │
│                   (cae-rosetta)                             │
│                                                              │
│  • Shared network - apps can talk to each other             │
│  • Shared logging - Log Analytics workspace                  │
│  • Isolation - separate from other environments             │
│                                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │frontend │  │ backend │  │be-editor│  │  auth   │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
└─────────────────────────────────────────────────────────────┘
```

**App**: Your container running with configuration
```
Container App: "backend"
├── Image: rosettaacr.azurecr.io/rosetta/backend:v1
├── Resources: 0.5 CPU, 1 GB RAM
├── Environment Variables:
│   ├── CLIENT_ID=xxx
│   ├── PG_DB_URL=xxx
│   └── ...
├── Ingress: Internal, port 8080
└── Scale: 1-3 replicas
```

**Revision**: Immutable snapshot of app configuration
```
backend (App)
├── backend--v1abc  (Revision 1) ← 0% traffic
├── backend--v2def  (Revision 2) ← 0% traffic
└── backend--v3ghi  (Revision 3) ← 100% traffic (active)
```

Every change creates a new revision. This enables:
- **Rollback**: Switch traffic to previous revision
- **Blue-green deploy**: Gradually shift traffic
- **A/B testing**: Split traffic between versions

**Replica**: Instance of your app
```
backend--v3ghi (Revision)
├── Replica 1 ─── Running on Node A
├── Replica 2 ─── Running on Node B
└── Replica 3 ─── Running on Node C
    (Load balanced automatically)
```

### Scaling

Container Apps can scale automatically based on various triggers:

```
Min Replicas: 1                    Max Replicas: 10
     │                                   │
     ▼                                   ▼
┌────┬────┬────┬────┬────┬────┬────┬────┬────┬────┐
│ R1 │    │    │    │    │    │    │    │    │    │
└────┴────┴────┴────┴────┴────┴────┴────┴────┴────┘
  ▲
  └── Low traffic: 1 replica

┌────┬────┬────┬────┬────┬────┬────┬────┬────┬────┐
│ R1 │ R2 │ R3 │ R4 │ R5 │    │    │    │    │    │
└────┴────┴────┴────┴────┴────┴────┴────┴────┴────┘
  ▲
  └── High traffic: 5 replicas (auto-scaled)
```

**Scale triggers:**
- HTTP traffic (requests per second)
- CPU/Memory utilization
- Custom metrics (queue length, etc.)

**Scale to zero**: Set `--min-replicas 0` to save costs when idle (cold start delay).

---

## 6. Ingress & Networking

### What is Ingress?

Ingress is the configuration that controls how traffic reaches your app from outside.

```
Internet
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                       Ingress                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  • HTTPS termination (TLS certificates)             │    │
│  │  • Load balancing across replicas                   │    │
│  │  • Domain/URL routing                               │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│              ┌───────────┼───────────┐                      │
│              ▼           ▼           ▼                      │
│          ┌──────┐   ┌──────┐   ┌──────┐                    │
│          │Rep 1 │   │Rep 2 │   │Rep 3 │                    │
│          └──────┘   └──────┘   └──────┘                    │
└─────────────────────────────────────────────────────────────┘
```

### Internal vs External Ingress

```
┌──────────────────────────────────────────────────────────────────┐
│                    Container Apps Environment                     │
│                                                                   │
│   External Ingress                    Internal Ingress            │
│   (Internet accessible)               (Environment only)          │
│                                                                   │
│   ┌─────────────┐                    ┌─────────────┐             │
│   │  frontend   │◄── Users access    │   backend   │             │
│   │             │    from internet   │             │             │
│   └──────┬──────┘                    └──────▲──────┘             │
│          │                                  │                     │
│          │         HTTP calls               │                     │
│          └──────────────────────────────────┘                     │
│                                                                   │
│   URL: frontend.xxx.azurecontainerapps.io                        │
│   URL: backend (internal hostname only)                           │
└──────────────────────────────────────────────────────────────────┘
```

| Type | Accessible From | Use For |
|------|-----------------|---------|
| **External** | Internet | Frontends, public APIs |
| **Internal** | Same environment only | Backends, internal services |

### Service-to-Service Communication

Apps in the same environment can communicate using simple hostnames:

```javascript
// frontend code calling backend
const response = await fetch('http://backend:8080/api/users');
//                            └──┬──┘ └─┬─┘
//                       App name   Port
```

No need for full URLs or service discovery configuration.

### HTTPS and TLS

Container Apps provides **free, automatic HTTPS**:

```
Internet                    Container Apps
    │                            │
    │  https://myapp.xxx...      │
    ▼                            ▼
┌─────────┐              ┌─────────────────┐
│ Browser │─── HTTPS ───▶│ TLS Termination │──── HTTP ────▶ Your App
│         │  (encrypted) │ (managed cert)  │ (internal)
└─────────┘              └─────────────────┘
```

- Certificates are automatically provisioned and renewed
- For custom domains, you can bring your own certificate or use Azure-managed

---

## 7. Managed Databases

### What Does "Managed" Mean?

**Self-managed database** (e.g., PostgreSQL in a container):
```
┌────────────────────────────────────────────┐
│  You are responsible for:                  │
│  • Installation and configuration          │
│  • Security patches and updates            │
│  • Backups and recovery                    │
│  • Scaling and performance tuning          │
│  • High availability setup                 │
│  • Monitoring and alerting                 │
│  • Disk space management                   │
│  • Connection pooling                      │
└────────────────────────────────────────────┘
```

**Managed database** (e.g., Azure Database for PostgreSQL):
```
┌────────────────────────────────────────────┐
│  Azure handles:                            │
│  ✓ Installation and configuration          │
│  ✓ Security patches and updates            │
│  ✓ Automated backups                       │
│  ✓ Scaling (one click)                     │
│  ✓ High availability options               │
│  ✓ Monitoring and alerting                 │
│  ✓ Disk space auto-grow                    │
│                                            │
│  You handle:                               │
│  • Connection string                       │
│  • Database schema                         │
│  • Application queries                     │
└────────────────────────────────────────────┘
```

### Why Not Run Databases in Containers?

While possible, it's generally not recommended for production:

| Concern | Container DB | Managed DB |
|---------|-------------|------------|
| Data persistence | Complex (volumes) | Built-in |
| Backups | Manual setup | Automatic |
| Scaling | Manual, risky | One-click |
| High availability | Complex | Built-in option |
| Updates | Risky, manual | Automatic, safe |
| Support | Community | Microsoft SLA |

**Exception**: For development/testing, containerized DBs are convenient.

### Database Tiers

**PostgreSQL Flexible Server Tiers:**

```
                    Performance
                         ▲
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
    │    Memory          │                    │
    │    Optimized       │                    │
    │   (E series)       │                    │
    │                    │                    │
    ├────────────────────┼────────────────────┤
    │                    │                    │
    │    General         │                    │
    │    Purpose         │                    │
    │   (D series)       │                    │
    │                    │                    │
    ├────────────────────┼────────────────────┤
    │                    │                    │
    │    Burstable       │  ◄── Start here   │
    │   (B series)       │                    │
    │                    │                    │
    └────────────────────┼────────────────────┘
                         │
                         ▼
                       Cost
```

| Tier | Best For | Pricing |
|------|----------|---------|
| **Burstable** | Dev/test, variable workloads | ~$12/month |
| **General Purpose** | Production workloads | ~$100+/month |
| **Memory Optimized** | High-performance needs | ~$200+/month |

### Connection Strings Explained

A connection string contains everything needed to connect to a database:

```
postgresql://rosettaadmin:MyPassword123@psql-rosetta.postgres.database.azure.com:5432/rosetta?sslmode=require
└────┬────┘  └─────┬─────┘ └────┬─────┘ └──────────────────┬───────────────────────┘ └─┬─┘ └──┬───┘ └─────┬─────┘
  Protocol    Username    Password                    Hostname                      Port  Database   Options
```

| Part | Example | Description |
|------|---------|-------------|
| Protocol | `postgresql://` | Database type |
| Username | `rosettaadmin` | Database user |
| Password | `MyPassword123` | User password |
| Hostname | `psql-rosetta.postgres...` | Server address |
| Port | `5432` | Database port |
| Database | `rosetta` | Database name |
| Options | `sslmode=require` | Connection options |

### Firewall Rules

Azure databases are protected by firewall by default:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Server                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                      Firewall                              │  │
│  │                                                            │  │
│  │   Allowed IPs:                                             │  │
│  │   ✓ 0.0.0.0 - 0.0.0.0  (Azure services)                   │  │
│  │   ✓ 203.0.113.50       (Your office IP)                   │  │
│  │   ✗ All other IPs      (Blocked)                          │  │
│  │                                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│   ┌─────────┐                                                   │
│   │ Database│                                                   │
│   └─────────┘                                                   │
└─────────────────────────────────────────────────────────────────┘
```

The special IP range `0.0.0.0 - 0.0.0.0` allows all Azure services (like Container Apps) to connect.

---

## 8. CI/CD Pipelines

### What is CI/CD?

**CI (Continuous Integration)**: Automatically build and test code when developers push changes.

**CD (Continuous Delivery/Deployment)**: Automatically deploy tested code to environments.

```
Developer         Azure DevOps                          Azure
   │                   │                                  │
   │  git push         │                                  │
   │ ─────────────────▶│                                  │
   │                   │                                  │
   │                   │  ┌────────────────────────────┐  │
   │                   │  │ CI: Build & Test           │  │
   │                   │  │ • Compile code             │  │
   │                   │  │ • Run unit tests           │  │
   │                   │  │ • Build Docker images      │  │
   │                   │  └────────────────────────────┘  │
   │                   │               │                  │
   │                   │               ▼                  │
   │                   │  ┌────────────────────────────┐  │
   │                   │  │ CD: Deploy                 │  │
   │                   │  │ • Push to registry         │──┼──▶ Container Registry
   │                   │  │ • Update Container Apps    │──┼──▶ Container Apps
   │                   │  └────────────────────────────┘  │
   │                   │                                  │
```

### Azure DevOps Components

```
Azure DevOps Project
├── Repos          ← Git repositories
├── Pipelines      ← CI/CD automation
│   ├── Pipelines  ← Build/deploy definitions
│   ├── Library    ← Variable groups, secure files
│   └── Environments ← Deployment targets with approvals
├── Boards         ← Work tracking (optional)
└── Artifacts      ← Package storage (optional)
```

### Pipeline Structure

```yaml
# azure-pipelines.yml

trigger:           # When does pipeline run?
  - main           # On push to main branch

stages:
  - stage: Build   # Stage 1: Build
    jobs:
      - job: BuildApp
        steps:
          - script: npm install
          - script: npm test
          - script: npm build

  - stage: Deploy  # Stage 2: Deploy (runs after Build)
    jobs:
      - deployment: DeployProd
        environment: 'production'  # Requires approval
        steps:
          - script: az containerapp update...
```

**Pipeline hierarchy:**
```
Pipeline
├── Stage (Build)
│   └── Job (BuildApp)
│       ├── Step (npm install)
│       ├── Step (npm test)
│       └── Step (npm build)
└── Stage (Deploy)
    └── Job (DeployProd)
        └── Step (az containerapp update)
```

### Service Connections

Service connections store credentials for external services:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Azure DevOps                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                 Service Connections                        │  │
│  │                                                            │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │ azure-rosetta-connection                           │   │  │
│  │  │ Type: Azure Resource Manager                       │   │  │
│  │  │ Stores: Service Principal credentials              │   │  │
│  │  │ Access: Azure subscription + resource group        │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  │                                                            │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │ acr-rosetta-connection                             │   │  │
│  │  │ Type: Docker Registry                              │   │  │
│  │  │ Stores: Registry credentials                       │   │  │
│  │  │ Access: Push/pull images                           │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Variable Groups

Variable groups store configuration that's shared across pipelines:

```
Variable Group: rosetta-variables
┌─────────────────────────────────────────┐
│  Variable              Value            │
├─────────────────────────────────────────┤
│  acrLoginServer        rosetta...       │  (plain text)
│  resourceGroup         rg-rosetta       │  (plain text)
│  clientId              ********         │  (secret - hidden)
│  clientSecret          ********         │  (secret - hidden)
│  pgConnectionString    ********         │  (secret - hidden)
└─────────────────────────────────────────┘
```

**Why use variable groups?**
- **Security**: Secrets are encrypted, not in code
- **Reusability**: Share across multiple pipelines
- **Maintainability**: Change in one place, applies everywhere

### Environments and Approvals

Environments represent deployment targets and can require approval:

```
                     Pipeline runs
                          │
                          ▼
              ┌───────────────────────┐
              │   Build & Test        │
              │   (Automatic)         │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   Deploy to Dev       │
              │   (Automatic)         │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   Waiting for         │
              │   Approval            │◄── Email sent to approvers
              └───────────┬───────────┘
                          │
                    Approved ✓
                          │
                          ▼
              ┌───────────────────────┐
              │   Deploy to Prod      │
              │   (After approval)    │
              └───────────────────────┘
```

---

## 9. Authentication & Security

### Service Principals

A **Service Principal** is an identity for applications (not humans) to access Azure resources.

```
Human Identity:                    Application Identity:
┌─────────────────────┐           ┌─────────────────────┐
│  User: john@co.com  │           │  Service Principal  │
│                     │           │                     │
│  Authenticates via: │           │  Authenticates via: │
│  • Password         │           │  • Client ID        │
│  • MFA              │           │  • Client Secret    │
│  • SSO              │           │  (or Certificate)   │
│                     │           │                     │
│  Used by: Humans    │           │  Used by: Apps      │
└─────────────────────┘           └─────────────────────┘
```

**When created automatically:**
- Azure DevOps service connections create their own service principal
- You don't manage the credentials

### Managed Identities

A **Managed Identity** is a special type of service principal where Azure manages the credentials automatically.

```
Without Managed Identity:           With Managed Identity:
┌──────────────────────┐           ┌──────────────────────┐
│    Container App     │           │    Container App     │
│                      │           │                      │
│  Environment vars:   │           │  No credentials!     │
│  • DB_PASSWORD=xxx   │           │                      │
│  • API_KEY=yyy       │           │  Azure handles       │
│                      │           │  authentication      │
│  (Secrets in config) │           │  automatically       │
└──────────────────────┘           └──────────────────────┘
         │                                   │
         ▼                                   ▼
    ┌─────────┐                        ┌─────────┐
    │ Database│                        │ Database│
    └─────────┘                        └─────────┘
```

**Benefits:**
- No credentials to manage or rotate
- No secrets that can be leaked
- Automatic credential rotation
- Audit trail of access

**Types:**
| Type | Scope | Use Case |
|------|-------|----------|
| System-assigned | One resource | Simple, tied to resource lifecycle |
| User-assigned | Multiple resources | Shared across apps |

### Secrets Management

**Option 1: Environment Variables** (Simple, less secure)
```bash
az containerapp create \
  --env-vars "DB_PASSWORD=secret123"  # Visible in config
```

**Option 2: Azure Key Vault** (Recommended for production)
```
┌─────────────────────────────────────────────────────────────────┐
│                      Azure Key Vault                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Secrets:                                                  │  │
│  │  • db-password = ********                                  │  │
│  │  • api-key = ********                                      │  │
│  │  • client-secret = ********                                │  │
│  │                                                            │  │
│  │  Access control:                                           │  │
│  │  • Container App managed identity: Read secrets            │  │
│  │  • Developer: No access                                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
             │
             │  Managed identity
             │  fetches secrets
             ▼
      ┌─────────────┐
      │Container App│
      └─────────────┘
```

---

## 10. Monitoring & Logging

### Log Analytics Workspace

A central place where Azure services send their logs:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Log Analytics Workspace                       │
│                                                                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │frontend │  │ backend │  │  auth   │  │ be-edit │            │
│  │  logs   │  │  logs   │  │  logs   │  │  logs   │            │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘            │
│       │            │            │            │                   │
│       └────────────┴─────┬──────┴────────────┘                  │
│                          │                                       │
│                          ▼                                       │
│                 ┌─────────────────┐                             │
│                 │  Query & Analyze │                             │
│                 │  (KQL queries)   │                             │
│                 └─────────────────┘                             │
│                          │                                       │
│              ┌───────────┼───────────┐                          │
│              ▼           ▼           ▼                          │
│         Dashboards    Alerts    Export to                       │
│                                 storage                          │
└─────────────────────────────────────────────────────────────────┘
```

### Viewing Container App Logs

**Azure CLI:**
```bash
# Stream live logs
az containerapp logs show --name backend --resource-group rg-rosetta --follow

# View recent logs
az containerapp logs show --name backend --resource-group rg-rosetta --tail 100
```

**Azure Portal:**
1. Navigate to your Container App
2. Click "Log stream" for live logs
3. Click "Logs" for querying historical logs

### Common Troubleshooting

```
Problem                          How to Diagnose
────────────────────────────────────────────────────────────────
App won't start                  Check logs for error messages
                                 Verify environment variables
                                 Ensure image exists in registry

502 Bad Gateway                  App might be starting (wait)
                                 Check if port matches --target-port
                                 Look for crash loops in logs

Can't connect to database        Verify connection string
                                 Check firewall rules
                                 Confirm database exists

Image pull error                 Verify ACR credentials
                                 Check image name and tag
                                 Confirm registry access
```

---

## 11. Cost Management

### How Azure Billing Works

Azure charges based on resource consumption:

```
Monthly Bill
├── Container Apps
│   ├── vCPU seconds used × $0.000024/second
│   ├── Memory GB-seconds × $0.000003/second
│   └── Requests × $0.40 per million
│
├── PostgreSQL Flexible Server
│   ├── Compute: B1ms × hours running
│   ├── Storage: GB × $0.115/month
│   └── Backup: (included up to 1x storage)
│
├── Cosmos DB (Serverless)
│   ├── Request Units consumed × $0.25 per million
│   └── Storage: GB × $0.25/month
│
├── Redis Cache
│   └── Basic C0: Fixed ~$16/month
│
└── Container Registry
    ├── Basic: Fixed ~$5/month
    └── Storage: Included up to tier limit
```

### Cost-Saving Strategies

**1. Right-size resources**
Start small, scale up when needed:
```
Development: Burstable tiers, minimal replicas
Production:  General Purpose tiers, more replicas
```

**2. Scale to zero**
For non-production, scale to zero when not in use:
```bash
az containerapp update --name frontend-dev --min-replicas 0
```

**3. Use Serverless where possible**
- Cosmos DB Serverless: Pay per request
- Container Apps Consumption: Pay per use

**4. Reserved capacity (production)**
Commit to 1-3 years for 30-50% discount on compute.

**5. Monitor and alert**
Set budget alerts to avoid surprises:
```
Azure Portal → Cost Management → Budgets → Create
```

### Estimated Costs Summary

| Resource | Dev Tier | Monthly Cost |
|----------|----------|--------------|
| Container Apps (5 apps) | Consumption | ~$30-50 |
| PostgreSQL | Burstable B1ms | ~$12 |
| Cosmos DB | Serverless | ~$5-15 |
| Redis | Basic C0 | ~$16 |
| Container Registry | Basic | ~$5 |
| Log Analytics | Pay-as-you-go | ~$5 |
| **Total** | | **~$75-100** |

---

## Further Reading

- [Azure Container Apps Documentation](https://learn.microsoft.com/azure/container-apps/)
- [Azure Database for PostgreSQL](https://learn.microsoft.com/azure/postgresql/)
- [Azure Cosmos DB](https://learn.microsoft.com/azure/cosmos-db/)
- [Azure DevOps Pipelines](https://learn.microsoft.com/azure/devops/pipelines/)
- [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/)
