

# Getting Started

## Local Development Setup

### Run service

```bash
cd FE
docker compose -f docker-compose.dev.yml up --build --watch
# Should start on http://localhost:3000
```

### Stopping Service:

FE
```bash
# Press Ctrl+C to stop the service and delete volume
docker compose -f docker-compose.dev.yml down -v
```