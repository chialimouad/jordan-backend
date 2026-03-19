# Wafaa Backend — Load Test & Stress Test Suite

> Full load testing framework for the Wafaa matchmaking backend (NestJS + PostgreSQL + Redis + WebSockets).  
> Target: **10,000 concurrent users** with realistic behavior simulation.

---

## Prerequisites

### 1. Install k6

```bash
# Windows (Chocolatey)
choco install k6

# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Docker
docker pull grafana/k6
```

### 2. Ensure Backend is Running

```bash
npm run start:dev
# or for production-like testing:
npm run build && npm run start:prod
```

### 3. Seed Test Users

```bash
node load-tests/seed-test-users.js 500 http://localhost:3000
```

Then verify users in DB (required since registration needs OTP):
```sql
UPDATE users SET "emailVerified" = true
WHERE email LIKE 'loadtest_%@loadtest.wafaa.app';
```

---

## Quick Start

```powershell
# Run normal load test (1,000 users)
.\load-tests\run-tests.ps1 -Scenario normal -BaseUrl http://localhost:3000

# Run with user seeding
.\load-tests\run-tests.ps1 -Scenario normal -SeedUsers -SeedCount 500

# Run peak load (10,000 users)
.\load-tests\run-tests.ps1 -Scenario peak

# Run all scenarios sequentially
.\load-tests\run-tests.ps1 -Scenario all

# Combined REST + WebSocket test
.\load-tests\run-tests.ps1 -Scenario peak -Combined
```

---

## Test Scenarios

### 1. REST API Test (`rest-api.test.js`)
Simulates realistic user behavior with weighted distribution:

| Behavior        | Weight | Actions                                        |
|-----------------|--------|------------------------------------------------|
| **Browsing**    | 40%    | Suggestions, search, swipe, matches, nearby    |
| **Chatting**    | 25%    | Conversations, messages, read/delivered, notifs |
| **Profile**     | 15%    | Get/update profile, preferences, privacy       |
| **Auth**        | 10%    | Register, login, token refresh                 |
| **Idle**        | 10%    | Heartbeat (unread, notifications, presence)    |

```bash
k6 run -e SCENARIO=normal -e BASE_URL=http://localhost:3000 load-tests/scenarios/rest-api.test.js
k6 run -e SCENARIO=peak load-tests/scenarios/rest-api.test.js
k6 run -e SCENARIO=stress load-tests/scenarios/rest-api.test.js
k6 run -e SCENARIO=spike load-tests/scenarios/rest-api.test.js
```

### 2. WebSocket Test (`websocket.test.js`)
Simulates 3,000–5,000 concurrent Socket.IO connections:

| Behavior           | Weight | Actions                                  |
|--------------------|--------|------------------------------------------|
| **Active Chatter** | 50%    | Join room, typing, send 3-10 msgs, read  |
| **Passive**        | 30%    | Join room, mark delivered, listen 15-30s |
| **Idle Presence**  | 20%    | Stay connected 30-60s, occasional checks |

```bash
k6 run -e WS_SCENARIO=ws_normal load-tests/scenarios/websocket.test.js
k6 run -e WS_SCENARIO=ws_peak load-tests/scenarios/websocket.test.js
k6 run -e WS_SCENARIO=ws_stress load-tests/scenarios/websocket.test.js
```

### 3. Combined Test (`combined.test.js`)
Runs REST + WebSocket simultaneously (most realistic):

```bash
k6 run -e SCENARIO=normal load-tests/scenarios/combined.test.js
k6 run -e SCENARIO=peak load-tests/scenarios/combined.test.js
k6 run -e SCENARIO=stress load-tests/scenarios/combined.test.js
```

### 4. Endpoint Stress Test (`endpoint-stress.test.js`)
Round-robin hammers all 14 critical endpoints to find per-endpoint bottlenecks:

```bash
k6 run -e SCENARIO=normal load-tests/scenarios/endpoint-stress.test.js
k6 run -e SCENARIO=stress load-tests/scenarios/endpoint-stress.test.js
```

### 5. DB & Redis Stress Test (`db-redis-stress.test.js`)
Targets database-heavy (search, suggestions, nearby) and Redis-heavy (monetization, rate limiting) endpoints:

```bash
k6 run -e SCENARIO=normal load-tests/scenarios/db-redis-stress.test.js
k6 run -e SCENARIO=stress load-tests/scenarios/db-redis-stress.test.js
```

---

## Load Profiles

| Scenario   | VUs    | Duration | Purpose                           |
|------------|--------|----------|-----------------------------------|
| `normal`   | 1,000  | ~12 min  | Baseline performance              |
| `high`     | 5,000  | ~16 min  | Expected peak traffic             |
| `peak`     | 10,000 | ~16 min  | Maximum target capacity           |
| `stress`   | 20,000 | ~19 min  | Find breaking point               |
| `spike`    | 1k→10k | ~14 min  | Sudden traffic surge resilience   |

---

## Server-Side Monitoring

### Enable Metrics Middleware

Add to `main.ts` during load testing:

```typescript
import { MetricsMiddleware } from '../load-tests/monitoring/metrics-middleware';

// After app creation, before listen:
app.use(MetricsMiddleware);
```

### Live Dashboard

Run alongside k6 tests:

```bash
node load-tests/monitoring/live-dashboard.js http://localhost:3000 3000
```

Shows real-time:
- CPU / Memory / Heap usage
- Requests per second / error rate
- Per-endpoint P95 latency with color-coded indicators
- Active HTTP and WebSocket connections

### Metrics Endpoint

```bash
# Get current metrics
curl http://localhost:3000/_metrics

# Reset metrics
curl http://localhost:3000/_metrics/reset

# Health check
curl http://localhost:3000/_metrics/health
```

---

## SLA Thresholds

| Metric              | Target        | Critical      |
|---------------------|---------------|---------------|
| HTTP P95 latency    | < 500ms       | > 1500ms      |
| HTTP P99 latency    | < 1500ms      | > 3000ms      |
| Error rate          | < 5%          | > 10%         |
| Throughput          | > 100 req/s   | < 50 req/s    |
| WS connect time     | < 1000ms      | > 2000ms      |
| WS message RTT      | < 500ms       | > 1000ms      |
| DB query P95        | < 1000ms      | > 3000ms      |
| Redis op P95        | < 200ms       | > 500ms       |

---

## Reports

Reports are saved to `load-tests/reports/` in JSON format:
- `rest-api-{scenario}-{timestamp}.json`
- `websocket-{scenario}-{timestamp}.json`
- `combined-{scenario}-{timestamp}.json`
- `endpoint-stress-{scenario}-{timestamp}.json`
- `db-redis-stress-{scenario}-{timestamp}.json`

Console output includes formatted summary with all key metrics.

---

## Environment Variables

| Variable      | Default                  | Description              |
|---------------|--------------------------|--------------------------|
| `BASE_URL`    | `http://localhost:3000`  | Backend HTTP URL         |
| `WS_URL`      | `ws://localhost:3000`    | Backend WebSocket URL    |
| `API_PREFIX`  | `api/v1`                 | API route prefix         |
| `SCENARIO`    | `normal`                 | Load scenario to run     |
| `WS_SCENARIO` | `ws_normal`              | WS scenario to run       |

---

## Cleanup

After load testing, remove test data:

```sql
DELETE FROM users WHERE email LIKE 'loadtest_%@loadtest.wafaa.app';
```
