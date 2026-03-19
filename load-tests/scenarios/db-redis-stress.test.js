// ─── Database & Redis Stress Test ────────────────────────────────────────────
// Specifically targets DB-heavy and Redis-heavy endpoints to find
// connection pool saturation, slow queries, and cache eviction issues

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { API, SCENARIOS, jsonHeaders, authHeaders, randomUUID } from '../config.js';

// ─── Metrics ─────────────────────────────────────────────────────────────────

const dbHeavyLatency = new Trend('db_heavy_latency', true);
const redisHeavyLatency = new Trend('redis_heavy_latency', true);
const searchQueryLatency = new Trend('search_query_latency', true);
const suggestionLatency = new Trend('suggestion_query_latency', true);
const nearbyLatency = new Trend('nearby_query_latency', true);
const connectionErrors = new Counter('connection_errors');
const timeouts = new Counter('timeouts');
const overallSuccess = new Rate('db_redis_success');

// ─── Options ─────────────────────────────────────────────────────────────────

const scenario = __ENV.SCENARIO || 'normal';

export const options = {
    scenarios: {
        db_stress: {
            ...SCENARIOS[scenario],
            exec: 'default',
        },
    },
    thresholds: {
        db_heavy_latency: ['p(95)<1000', 'p(99)<3000'],
        redis_heavy_latency: ['p(95)<200', 'p(99)<500'],
        search_query_latency: ['p(95)<1500'],
        suggestion_query_latency: ['p(95)<2000'],
        nearby_query_latency: ['p(95)<2000'],
        http_req_failed: ['rate<0.10'],
    },
};

// ─── Token helper ────────────────────────────────────────────────────────────

let tokenCache = {};

function getToken(vuId) {
    if (tokenCache[vuId]) return tokenCache[vuId];

    const res = http.post(`${API}/auth/login`, JSON.stringify({
        email: `loadtest_user_${vuId}@loadtest.wafaa.app`,
        password: 'LoadT3st!Pass',
    }), jsonHeaders());

    if (res.status === 200) {
        try {
            const token = JSON.parse(res.body).data?.accessToken;
            if (token) tokenCache[vuId] = token;
            return token;
        } catch {}
    }
    return null;
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function () {
    const vuId = __VU;
    const token = getToken(vuId);
    if (!token) { sleep(1); return; }

    const headers = authHeaders(token);
    const testGroup = __ITER % 6;

    switch (testGroup) {
        // ── DB-Heavy: Complex search with multiple filters ──────
        case 0:
            group('DB: Complex Search', () => {
                const filters = [
                    'minAge=20&maxAge=30&gender=female&verifiedOnly=true&limit=50',
                    'minAge=25&maxAge=40&city=Riyadh&limit=50',
                    'minAge=18&maxAge=45&maxDistance=100&limit=50',
                    'minAge=22&maxAge=35&maritalStatus=single&limit=50',
                ];
                const f = filters[Math.floor(Math.random() * filters.length)];

                const res = http.get(`${API}/search?${f}`, headers);
                searchQueryLatency.add(res.timings.duration);
                dbHeavyLatency.add(res.timings.duration);

                const ok = check(res, { 'search ok': (r) => r.status === 200 });
                overallSuccess.add(ok);
                if (!ok) connectionErrors.add(1);
                if (res.timings.duration > 5000) timeouts.add(1);
            });
            break;

        // ── DB-Heavy: Suggestions (complex matching algorithm) ──
        case 1:
            group('DB: Suggestions', () => {
                const res = http.get(`${API}/matches/suggestions?limit=20`, headers);
                suggestionLatency.add(res.timings.duration);
                dbHeavyLatency.add(res.timings.duration);

                const ok = check(res, { 'suggestions ok': (r) => r.status === 200 });
                overallSuccess.add(ok);
                if (!ok) connectionErrors.add(1);
                if (res.timings.duration > 5000) timeouts.add(1);
            });
            break;

        // ── DB-Heavy: Nearby users (geo-spatial query) ──────────
        case 2:
            group('DB: Nearby Users', () => {
                const radii = [10, 25, 50, 100, 200];
                const radius = radii[Math.floor(Math.random() * radii.length)];

                const res = http.get(`${API}/matches/nearby?radius=${radius}&limit=30`, headers);
                nearbyLatency.add(res.timings.duration);
                dbHeavyLatency.add(res.timings.duration);

                const ok = check(res, { 'nearby ok': (r) => r.status === 200 });
                overallSuccess.add(ok);
                if (!ok) connectionErrors.add(1);
                if (res.timings.duration > 5000) timeouts.add(1);
            });
            break;

        // ── DB-Heavy: Discovery categories (multiple queries) ───
        case 3:
            group('DB: Discovery Categories', () => {
                const res = http.get(`${API}/matches/discover`, headers);
                dbHeavyLatency.add(res.timings.duration);

                const ok = check(res, { 'discover ok': (r) => r.status === 200 });
                overallSuccess.add(ok);
                if (!ok) connectionErrors.add(1);
            });
            break;

        // ── Redis-Heavy: Monetization checks (rate limits, cache) ─
        case 4:
            group('Redis: Monetization Checks', () => {
                // These all hit Redis for rate limits, subscription cache, etc.
                const endpoints = [
                    '/monetization/status',
                    '/monetization/remaining-likes',
                    '/monetization/boost',
                    '/monetization/invisible',
                    '/monetization/limits',
                    '/monetization/compliments',
                    '/monetization/rewind',
                ];

                for (const ep of endpoints) {
                    const res = http.get(`${API}${ep}`, headers);
                    redisHeavyLatency.add(res.timings.duration);

                    const ok = check(res, { [`${ep} ok`]: (r) => r.status === 200 });
                    overallSuccess.add(ok);
                    if (!ok) connectionErrors.add(1);
                }
            });
            break;

        // ── Redis-Heavy: Rapid auth + rate limit bombardment ────
        case 5:
            group('Redis: Auth Rate Limit Stress', () => {
                // Rapidly hit login (triggers rate limiting in Redis)
                for (let i = 0; i < 5; i++) {
                    const res = http.post(`${API}/auth/login`, JSON.stringify({
                        email: `loadtest_user_${vuId}@loadtest.wafaa.app`,
                        password: 'LoadT3st!Pass',
                    }), jsonHeaders());

                    redisHeavyLatency.add(res.timings.duration);
                    // 200 = success, 429 = rate limited (both are valid)
                    const ok = check(res, {
                        'auth ok or rate-limited': (r) => r.status === 200 || r.status === 429,
                    });
                    overallSuccess.add(ok);
                    if (!ok) connectionErrors.add(1);

                    sleep(0.1); // Minimal delay to stress rate limiter
                }

                // Also hit notification unread count (Redis-cached)
                const notifRes = http.get(`${API}/notifications/unread-count`, headers);
                redisHeavyLatency.add(notifRes.timings.duration);
                overallSuccess.add(check(notifRes, { 'notif-unread ok': (r) => r.status === 200 }));

                // Chat unread (Redis-cached)
                const chatRes = http.get(`${API}/chat/unread`, headers);
                redisHeavyLatency.add(chatRes.timings.duration);
                overallSuccess.add(check(chatRes, { 'chat-unread ok': (r) => r.status === 200 }));
            });
            break;
    }

    sleep(0.2 + Math.random() * 0.5);
}

// ─── Report ──────────────────────────────────────────────────────────────────

export function handleSummary(data) {
    const now = new Date().toISOString().replace(/[:.]/g, '-');
    return {
        [`load-tests/reports/db-redis-stress-${scenario}-${now}.json`]: JSON.stringify(data, null, 2),
        stdout: generateReport(data),
    };
}

function generateReport(data) {
    const m = data.metrics;
    const sep = '═'.repeat(70);

    return `
${sep}
  WAFAA BACKEND — DATABASE & REDIS STRESS TEST REPORT
  Scenario: ${scenario.toUpperCase()}
  Date: ${new Date().toISOString()}
${sep}

📊 OVERALL
  Total Requests:      ${m.http_reqs?.values?.count || 0}
  Throughput:           ${(m.http_reqs?.values?.rate || 0).toFixed(1)} req/s
  Error Rate:           ${((m.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%
  Success Rate:         ${((m.db_redis_success?.values?.rate || 0) * 100).toFixed(1)}%
  Connection Errors:    ${m.connection_errors?.values?.count || 0}
  Timeouts (>5s):       ${m.timeouts?.values?.count || 0}

🗄️  DATABASE (PostgreSQL) METRICS
  DB-Heavy Avg:         ${(m.db_heavy_latency?.values?.avg || 0).toFixed(1)}ms
  DB-Heavy P95:         ${(m.db_heavy_latency?.values?.['p(95)'] || 0).toFixed(1)}ms
  DB-Heavy P99:         ${(m.db_heavy_latency?.values?.['p(99)'] || 0).toFixed(1)}ms
  DB-Heavy Max:         ${(m.db_heavy_latency?.values?.max || 0).toFixed(1)}ms

  Search Query P95:     ${(m.search_query_latency?.values?.['p(95)'] || 0).toFixed(1)}ms
  Suggestion P95:       ${(m.suggestion_query_latency?.values?.['p(95)'] || 0).toFixed(1)}ms
  Nearby Query P95:     ${(m.nearby_query_latency?.values?.['p(95)'] || 0).toFixed(1)}ms

⚡ REDIS METRICS
  Redis-Heavy Avg:      ${(m.redis_heavy_latency?.values?.avg || 0).toFixed(1)}ms
  Redis-Heavy P95:      ${(m.redis_heavy_latency?.values?.['p(95)'] || 0).toFixed(1)}ms
  Redis-Heavy P99:      ${(m.redis_heavy_latency?.values?.['p(99)'] || 0).toFixed(1)}ms
  Redis-Heavy Max:      ${(m.redis_heavy_latency?.values?.max || 0).toFixed(1)}ms

🔍 BOTTLENECK INDICATORS
  DB queries > 1s:      ${m.db_heavy_latency?.values?.['p(95)'] > 1000 ? '🔴 CRITICAL' : m.db_heavy_latency?.values?.['p(95)'] > 500 ? '🟡 WARNING' : '🟢 OK'}
  Redis ops > 200ms:    ${m.redis_heavy_latency?.values?.['p(95)'] > 200 ? '🔴 CRITICAL' : m.redis_heavy_latency?.values?.['p(95)'] > 100 ? '🟡 WARNING' : '🟢 OK'}
  Search > 1.5s:        ${m.search_query_latency?.values?.['p(95)'] > 1500 ? '🔴 CRITICAL' : m.search_query_latency?.values?.['p(95)'] > 800 ? '🟡 WARNING' : '🟢 OK'}
  Suggestions > 2s:     ${m.suggestion_query_latency?.values?.['p(95)'] > 2000 ? '🔴 CRITICAL' : m.suggestion_query_latency?.values?.['p(95)'] > 1000 ? '🟡 WARNING' : '🟢 OK'}
  Nearby > 2s:          ${m.nearby_query_latency?.values?.['p(95)'] > 2000 ? '🔴 CRITICAL' : m.nearby_query_latency?.values?.['p(95)'] > 1000 ? '🟡 WARNING' : '🟢 OK'}
  Timeout count:        ${(m.timeouts?.values?.count || 0) > 10 ? '🔴 CRITICAL' : (m.timeouts?.values?.count || 0) > 0 ? '🟡 WARNING' : '🟢 OK'}
${sep}
`;
}
