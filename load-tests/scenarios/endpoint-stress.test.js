// ─── Individual Endpoint Stress Test ─────────────────────────────────────────
// Hammers specific endpoints to find per-endpoint breaking points
// Usage: k6 run -e SCENARIO=normal -e BASE_URL=http://localhost:3000 endpoint-stress.test.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { API, SCENARIOS, jsonHeaders, authHeaders, randomUUID, randomSwipeAction } from '../config.js';

// ─── Metrics per endpoint ────────────────────────────────────────────────────

const endpoints = {};
function track(name, res) {
    if (!endpoints[name]) {
        endpoints[name] = {
            latency: new Trend(`endpoint_${name}_latency`, true),
            errors: new Counter(`endpoint_${name}_errors`),
            success: new Rate(`endpoint_${name}_success`),
        };
    }
    endpoints[name].latency.add(res.timings.duration);
    const ok = res.status >= 200 && res.status < 400;
    endpoints[name].success.add(ok);
    if (!ok) endpoints[name].errors.add(1);
    return ok;
}

// ─── Options ─────────────────────────────────────────────────────────────────

const scenario = __ENV.SCENARIO || 'normal';

export const options = {
    scenarios: {
        endpoint_stress: {
            ...SCENARIOS[scenario],
            exec: 'default',
        },
    },
    thresholds: {
        http_req_duration: ['p(95)<1000', 'p(99)<3000'],
        http_req_failed: ['rate<0.10'],
    },
};

// ─── Token cache ─────────────────────────────────────────────────────────────

let cachedTokens = {};

function getToken(vuId) {
    if (cachedTokens[vuId]) return cachedTokens[vuId];

    const email = `loadtest_user_${vuId}@loadtest.wafaa.app`;
    const res = http.post(`${API}/auth/login`, JSON.stringify({
        email,
        password: 'LoadT3st!Pass',
    }), jsonHeaders());

    track('auth_login', res);

    if (res.status === 200) {
        try {
            const token = JSON.parse(res.body).data?.accessToken;
            if (token) cachedTokens[vuId] = token;
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

    // Round-robin through all critical endpoints
    const iteration = __ITER;
    const endpointIndex = iteration % 14;

    switch (endpointIndex) {
        case 0: { // GET /users/me
            const r = http.get(`${API}/users/me`, headers);
            track('users_me', r);
            check(r, { 'users/me ok': (r) => r.status === 200 });
            break;
        }
        case 1: { // GET /profiles/me
            const r = http.get(`${API}/profiles/me`, headers);
            track('profiles_me', r);
            check(r, { 'profiles/me ok': (r) => r.status === 200 });
            break;
        }
        case 2: { // GET /matches/suggestions
            const r = http.get(`${API}/matches/suggestions?limit=20`, headers);
            track('matches_suggestions', r);
            check(r, { 'suggestions ok': (r) => r.status === 200 });
            break;
        }
        case 3: { // GET /matches/discover
            const r = http.get(`${API}/matches/discover`, headers);
            track('matches_discover', r);
            check(r, { 'discover ok': (r) => r.status === 200 });
            break;
        }
        case 4: { // GET /matches/nearby
            const r = http.get(`${API}/matches/nearby?radius=50&limit=30`, headers);
            track('matches_nearby', r);
            check(r, { 'nearby ok': (r) => r.status === 200 });
            break;
        }
        case 5: { // GET /matches
            const r = http.get(`${API}/matches?page=1&limit=20`, headers);
            track('matches_list', r);
            check(r, { 'matches ok': (r) => r.status === 200 });
            break;
        }
        case 6: { // POST /swipes
            const r = http.post(`${API}/swipes`, JSON.stringify({
                targetUserId: randomUUID(),
                action: randomSwipeAction(),
            }), headers);
            track('swipes_create', r);
            check(r, { 'swipe ok': (r) => r.status === 200 || r.status === 201 });
            break;
        }
        case 7: { // GET /swipes/who-liked-me
            const r = http.get(`${API}/swipes/who-liked-me`, headers);
            track('swipes_who_liked', r);
            check(r, { 'who-liked ok': (r) => r.status === 200 });
            break;
        }
        case 8: { // GET /chat/conversations
            const r = http.get(`${API}/chat/conversations?page=1&limit=20`, headers);
            track('chat_conversations', r);
            check(r, { 'convs ok': (r) => r.status === 200 });
            break;
        }
        case 9: { // GET /chat/unread
            const r = http.get(`${API}/chat/unread`, headers);
            track('chat_unread', r);
            check(r, { 'unread ok': (r) => r.status === 200 });
            break;
        }
        case 10: { // GET /notifications
            const r = http.get(`${API}/notifications?page=1&limit=10`, headers);
            track('notifications_list', r);
            check(r, { 'notifs ok': (r) => r.status === 200 });
            break;
        }
        case 11: { // GET /notifications/unread-count
            const r = http.get(`${API}/notifications/unread-count`, headers);
            track('notifications_unread', r);
            check(r, { 'unread-count ok': (r) => r.status === 200 });
            break;
        }
        case 12: { // GET /search
            const r = http.get(`${API}/search?minAge=18&maxAge=40&limit=20`, headers);
            track('search', r);
            check(r, { 'search ok': (r) => r.status === 200 });
            break;
        }
        case 13: { // GET /monetization/status
            const r = http.get(`${API}/monetization/status`, headers);
            track('monetization_status', r);
            check(r, { 'monet ok': (r) => r.status === 200 });
            break;
        }
    }

    sleep(0.1 + Math.random() * 0.5); // Minimal think time for stress
}

// ─── Report ──────────────────────────────────────────────────────────────────

export function handleSummary(data) {
    const now = new Date().toISOString().replace(/[:.]/g, '-');
    return {
        [`load-tests/reports/endpoint-stress-${scenario}-${now}.json`]: JSON.stringify(data, null, 2),
        stdout: generateEndpointReport(data),
    };
}

function generateEndpointReport(data) {
    const m = data.metrics;
    const sep = '═'.repeat(80);
    const line = '─'.repeat(80);

    let report = `
${sep}
  WAFAA BACKEND — ENDPOINT STRESS TEST REPORT
  Scenario: ${scenario.toUpperCase()}
  Date: ${new Date().toISOString()}
${sep}

📊 OVERALL
  Total Requests:     ${m.http_reqs?.values?.count || 0}
  Throughput:          ${(m.http_reqs?.values?.rate || 0).toFixed(1)} req/s
  Error Rate:          ${((m.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%
  P95 Latency:         ${(m.http_req_duration?.values?.['p(95)'] || 0).toFixed(1)}ms
  P99 Latency:         ${(m.http_req_duration?.values?.['p(99)'] || 0).toFixed(1)}ms

${line}
  ENDPOINT BREAKDOWN (sorted by P95 latency)
${line}
`;

    // Collect endpoint metrics
    const endpointNames = [
        'auth_login', 'users_me', 'profiles_me',
        'matches_suggestions', 'matches_discover', 'matches_nearby', 'matches_list',
        'swipes_create', 'swipes_who_liked',
        'chat_conversations', 'chat_unread',
        'notifications_list', 'notifications_unread',
        'search', 'monetization_status',
    ];

    const rows = [];
    for (const name of endpointNames) {
        const latency = m[`endpoint_${name}_latency`];
        const errors = m[`endpoint_${name}_errors`];
        const success = m[`endpoint_${name}_success`];

        if (latency) {
            rows.push({
                name,
                avg: latency.values?.avg || 0,
                p95: latency.values?.['p(95)'] || 0,
                p99: latency.values?.['p(99)'] || 0,
                max: latency.values?.max || 0,
                errors: errors?.values?.count || 0,
                successRate: ((success?.values?.rate || 0) * 100).toFixed(1),
            });
        }
    }

    // Sort by P95 descending (slowest first)
    rows.sort((a, b) => b.p95 - a.p95);

    report += `  ${'Endpoint'.padEnd(28)} ${'Avg'.padStart(8)} ${'P95'.padStart(8)} ${'P99'.padStart(8)} ${'Max'.padStart(8)} ${'Err'.padStart(6)} ${'OK%'.padStart(7)}\n`;
    report += `  ${'─'.repeat(28)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(6)} ${'─'.repeat(7)}\n`;

    for (const r of rows) {
        const flag = r.p95 > 500 ? '🔴' : r.p95 > 200 ? '🟡' : '🟢';
        report += `  ${flag} ${r.name.padEnd(26)} ${r.avg.toFixed(0).padStart(6)}ms ${r.p95.toFixed(0).padStart(6)}ms ${r.p99.toFixed(0).padStart(6)}ms ${r.max.toFixed(0).padStart(6)}ms ${String(r.errors).padStart(5)} ${r.successRate.padStart(6)}%\n`;
    }

    report += `\n${line}\n  🟢 < 200ms   🟡 200-500ms   🔴 > 500ms (P95)\n${sep}\n`;

    return report;
}
