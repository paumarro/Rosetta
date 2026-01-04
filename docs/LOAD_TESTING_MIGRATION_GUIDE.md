# Load Testing CI/CD Migration Guide

## Current vs. Improved Implementation

### Current Implementation Issues

```yaml
# ❌ Current: Mixed in BuildAndTest stage
- stage: BuildAndTest
  jobs:
    - BuildBackend
    - BuildFrontend
    - LoadTesting  # Blocks fast feedback!
```

**Problems:**
- No isolation (all on same VM)
- Fragile process management
- 15-minute wait for load tests before seeing build results
- Not representative of production

### Improved Implementation

```yaml
# ✅ Improved: Separate stage with Docker Compose
- stage: BuildAndTest      # Fast feedback (2-3 min)
- stage: PerformanceTests  # Isolated tests (parallel)
- stage: BuildDockerImages # Only after tests pass
- stage: Deploy            # Conditional
```

**Benefits:**
- ✅ Full container isolation
- ✅ Production parity
- ✅ Fast feedback on build/unit tests
- ✅ Parallel load test execution
- ✅ Reliable cleanup

## Migration Steps

### Phase 1: Create Docker Compose Setup (30 minutes)

#### 1.1 Create docker-compose.loadtest.yml

Already created at: `/docker-compose.loadtest.yml`

#### 1.2 Create Dockerfile for load tests

Already created at: `/scripts/load-test/Dockerfile`

#### 1.3 Create development Dockerfile for frontend

Already created at: `/apps/frontend-editor/Dockerfile.dev`

#### 1.4 Test locally

```bash
# Build containers
docker-compose -f docker-compose.loadtest.yml build

# Run load test
docker-compose -f docker-compose.loadtest.yml up --abort-on-container-exit

# Cleanup
docker-compose -f docker-compose.loadtest.yml down -v
```

### Phase 2: Update Azure Pipeline (15 minutes)

#### 2.1 Option A: Replace existing pipeline (Recommended)

```bash
# Backup current pipeline
cp azure-pipelines.yml azure-pipelines.old.yml

# Use improved pipeline
cp azure-pipelines.improved.yml azure-pipelines.yml

# Commit changes
git add azure-pipelines.yml docker-compose.loadtest.yml scripts/load-test/Dockerfile apps/frontend-editor/Dockerfile.dev
git commit -m "feat(ci): improve load testing with Docker Compose isolation"
```

#### 2.2 Option B: Gradual migration (Lower risk)

Keep existing pipeline, add new stage:

```yaml
# In azure-pipelines.yml, add after BuildAndTest stage:

  - stage: PerformanceTests_New
    displayName: 'Performance Tests (Docker Compose)'
    dependsOn: BuildAndTest
    condition: eq(variables['Build.SourceBranch'], 'refs/heads/main')

    jobs:
      - job: LoadTestMedium
        pool:
          vmImage: 'ubuntu-latest'

        steps:
          - checkout: self

          - script: docker-compose -f docker-compose.loadtest.yml build
            displayName: 'Build test environment'

          - script: |
              docker-compose -f docker-compose.loadtest.yml up \
                --abort-on-container-exit \
                --exit-code-from loadtest
            displayName: 'Run load test'

          - script: docker-compose -f docker-compose.loadtest.yml down -v
            displayName: 'Cleanup'
            condition: always()
```

Run both implementations in parallel, compare results, then switch.

### Phase 3: Validate (10 minutes)

#### 3.1 Trigger pipeline and verify

```bash
# Push to trigger pipeline
git push origin main

# Monitor in Azure DevOps:
# 1. BuildAndTest stage should complete in 2-3 minutes
# 2. PerformanceTests stage should run in parallel jobs
# 3. Check artifacts for test results
```

#### 3.2 Verify isolation

In Azure DevOps pipeline logs, verify:
- ✅ Each service starts in its own container
- ✅ Health checks pass before tests run
- ✅ Containers cleaned up after test
- ✅ No orphaned processes

#### 3.3 Compare metrics

Download artifacts from both pipelines and compare:
- FPS should be more consistent (less variance)
- Memory usage should be more predictable
- Connection reliability should improve

### Phase 4: Optimize (Optional)

#### 4.1 Add performance budgets

```yaml
# In docker-compose.loadtest.yml
loadtest:
  environment:
    - MIN_FPS=30
    - MAX_MEMORY_MB=500
    - MAX_LATENCY_MS=100
```

#### 4.2 Enable matrix testing

```yaml
strategy:
  matrix:
    quick:
      BOT_COUNT: 5
      TEST_DURATION: 30
    medium:
      BOT_COUNT: 20
      TEST_DURATION: 60
```

#### 4.3 Add historical tracking

```bash
# Save metrics to database
- script: |
    python scripts/save-metrics.py \
      --file test-results/metrics.json \
      --build $(Build.BuildId) \
      --branch $(Build.SourceBranch)
```

## Comparison: Before vs. After

### Timeline Comparison

**Before:**
```
0:00 ─┬─ Start Pipeline
      │
0:30 ─┼─ Build Backend (wait)
      │
1:00 ─┼─ Build Frontend (wait)
      │
1:30 ─┼─ Load Test starts (wait 15 min!)
      │
16:30─┼─ Build Docker Images
      │
17:00─┴─ Done (17 minutes total)
```

**After:**
```
0:00 ─┬─ Start Pipeline
      │
      ├─ Build Backend ───────┐
0:30 ─┤                        ├─ 2:00 BuildAndTest Done
      ├─ Build Frontend ──────┘
      │
2:00 ─┼─ Performance Tests (parallel, non-blocking)
      │   ├─ Quick (5 bots)
      │   ├─ Medium (20 bots)
      │   └─ Heavy (manual)
      │
2:30 ─┼─ Build Docker Images (doesn't wait for perf tests!)
      │
3:00 ─┴─ Done (3 minutes for build, perf tests run in parallel)
```

**Improvement:** 14 minutes faster for main build path!

### Resource Isolation Comparison

**Before:**
```
┌─────────────────────────────┐
│    Ubuntu VM (Shared)       │
│  Backend + Frontend + Bots  │
│  All competing for:         │
│  • CPU                      │
│  • Memory                   │
│  • Network ports            │
└─────────────────────────────┘
```

**After:**
```
┌────────────┐  ┌────────────┐  ┌────────────┐
│ Backend    │  │ Frontend   │  │ Bots       │
│ Container  │  │ Container  │  │ Container  │
│            │  │            │  │            │
│ Isolated   │  │ Isolated   │  │ Isolated   │
└────────────┘  └────────────┘  └────────────┘
      │              │                │
      └──────────────┴────────────────┘
           Docker Network (isolated)
```

## Rollback Plan

If issues occur, rollback is simple:

```bash
# Restore old pipeline
cp azure-pipelines.old.yml azure-pipelines.yml

git add azure-pipelines.yml
git commit -m "revert: rollback load testing changes"
git push origin main
```

## Troubleshooting

### Issue: Docker Compose build fails

```bash
# Debug locally
docker-compose -f docker-compose.loadtest.yml build --no-cache

# Check Dockerfile syntax
docker build -f scripts/load-test/Dockerfile .
```

### Issue: Services don't become healthy

```bash
# Check health check logs
docker-compose -f docker-compose.loadtest.yml up
docker-compose -f docker-compose.loadtest.yml ps

# Inspect service logs
docker-compose -f docker-compose.loadtest.yml logs backend-editor
```

### Issue: Tests fail but worked before

Likely due to proper isolation now catching real issues:
1. Check if test needs more resources (increase docker limits)
2. Verify network connectivity between services
3. Check environment variables are set correctly

## Success Criteria

After migration, you should see:

✅ Build stage completes in < 5 minutes
✅ Load tests run in separate stage
✅ No orphaned processes after tests
✅ Consistent, reproducible metrics
✅ Container logs available for debugging
✅ Easy to run tests locally with same setup

## Next Steps

After successful migration:

1. **Add more test scenarios**
   - Stress tests (100+ bots)
   - Endurance tests (long duration)
   - Chaos tests (random failures)

2. **Integrate monitoring**
   - Prometheus metrics
   - Grafana dashboards
   - Alerting on performance regressions

3. **Historical tracking**
   - Store metrics in database
   - Trend analysis
   - Performance budgets enforcement

## Questions?

See detailed analysis in: `/docs/CICD_LOAD_TESTING_ANALYSIS.md`
