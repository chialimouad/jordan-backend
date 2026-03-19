// ─── Combined Load Test — REST + WebSocket Simultaneous ──────────────────────
// Runs both REST API calls and WebSocket connections in parallel
// This is the most realistic simulation of actual app usage

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import {
    API, WS_URL, THRESHOLDS,
    randomMessage, randomUUID, randomSwipeAction,
    authHeaders, jsonHeaders,
} from '../config.js';

// ─── Custom Metrics ──────────────────────────────────────────────────────────

const authLatency = new Trend('auth_latency', true);
const restLatency = new Trend('rest_latency', true);
const wsConnectTime = new Trend('ws_connect_time', true);
const wsMsgRoundTrip = new Trend('ws_msg_roundtrip', true);
const totalErrors = new Counter('total_errors');
const overallSuccess = new Rate('overall_success_rate');

// ─── Options ─────────────────────────────────────────────────────────────────

const scenario = __ENV.SCENARIO || 'normal';

const scenarioConfigs = {
    normal: {
        rest_users: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '2m', target: 400 },
                { duration: '5m', target: 700 },
                { duration: '3m', target: 700 },
                { duration: '2m', target: 0 },
            ],
            exec: 'restScenario',
        },
        ws_users: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '2m', target: 100 },
                { duration: '5m', target: 300 },
                { duration: '3m', target: 300 },
                { duration: '2m', target: 0 },
            ],
            exec: 'wsScenario',
        },
    },
    peak: {
        rest_users: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '3m', target: 2000 },
                { duration: '5m', target: 7000 },
                { duration: '5m', target: 7000 },
                { duration: '3m', target: 0 },
            ],
            exec: 'restScenario',
        },
        ws_users: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '3m', target: 500 },
                { duration: '5m', target: 3000 },
                { duration: '5m', target: 3000 },
                { duration: '3m', target: 0 },
            ],
            exec: 'wsScenario',
        },
    },
    stress: {
        rest_users: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '2m', target: 3000 },
                { duration: '3m', target: 7000 },
                { duration: '3m', target: 10000 },
                { duration: '3m', target: 15000 },
                { duration: '2m', target: 0 },
            ],
            exec: 'restScenario',
        },
        ws_users: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '2m', target: 1000 },
                { duration: '3m', target: 3000 },
                { duration: '3m', target: 5000 },
                { duration: '3m', target: 8000 },
                { duration: '2m', target: 0 },
            ],
            exec: 'wsScenario',
        },
    },
};

export const options = {
    scenarios: scenarioConfigs[scenario] || scenarioConfigs.normal,
    thresholds: {
        ...THRESHOLDS,
        ws_connect_time: ['p(95)<2000'],
        ws_msg_roundtrip: ['p(95)<500'],
        overall_success_rate: ['rate>0.90'],
    },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loginAndGetToken(vuId) {
    const email = `loadtest_user_${vuId}@loadtest.wafaa.app`;
    const res = http.post(`${API}/auth/login`, JSON.stringify({
        email,
        password: 'LoadT3st!Pass',
    }), jsonHeaders());

    authLatency.add(res.timings.duration);

    if (res.status !== 200) {
        totalErrors.add(1);
        overallSuccess.add(false);
        return null;
    }
    overallSuccess.add(true);

    try {
        return JSON.parse(res.body).data?.accessToken || null;
    } catch {
        return null;
    }
}

// ─── REST Scenario (70% of total users) ──────────────────────────────────────

export function restScenario() {
    const vuId = __VU;
    const token = loginAndGetToken(vuId);
    if (!token) { sleep(2); return; }

    const headers = authHeaders(token);
    const roll = Math.random();

    if (roll < 0.50) {
        // Browsing: suggestions + swipes
        group('REST: Browse & Swipe', () => {
            const sugRes = http.get(`${API}/matches/suggestions?limit=10`, headers);
            restLatency.add(sugRes.timings.duration);
            overallSuccess.add(check(sugRes, { 'suggestions ok': (r) => r.status === 200 }));

            sleep(1 + Math.random());

            // Swipe on a few
            for (let i = 0; i < 3; i++) {
                const swRes = http.post(`${API}/swipes`, JSON.stringify({
                    targetUserId: randomUUID(),
                    action: randomSwipeAction(),
                }), headers);
                restLatency.add(swRes.timings.duration);
                overallSuccess.add(check(swRes, {
                    'swipe ok': (r) => r.status === 200 || r.status === 201,
                }));
                sleep(1 + Math.random() * 2);
            }

            // Check matches
            const matchRes = http.get(`${API}/matches?page=1&limit=10`, headers);
            restLatency.add(matchRes.timings.duration);
            overallSuccess.add(check(matchRes, { 'matches ok': (r) => r.status === 200 }));
        });

    } else if (roll < 0.75) {
        // Chat REST: conversations + messages
        group('REST: Chat', () => {
            const convRes = http.get(`${API}/chat/conversations?page=1&limit=10`, headers);
            restLatency.add(convRes.timings.duration);
            overallSuccess.add(check(convRes, { 'convs ok': (r) => r.status === 200 }));

            sleep(0.5);

            const unreadRes = http.get(`${API}/chat/unread`, headers);
            restLatency.add(unreadRes.timings.duration);
            overallSuccess.add(check(unreadRes, { 'unread ok': (r) => r.status === 200 }));

            sleep(1);

            const notifRes = http.get(`${API}/notifications?page=1&limit=10`, headers);
            restLatency.add(notifRes.timings.duration);
            overallSuccess.add(check(notifRes, { 'notifs ok': (r) => r.status === 200 }));
        });

    } else if (roll < 0.90) {
        // Profile update
        group('REST: Profile', () => {
            const profRes = http.get(`${API}/profiles/me`, headers);
            restLatency.add(profRes.timings.duration);
            overallSuccess.add(check(profRes, { 'profile ok': (r) => r.status === 200 }));

            sleep(0.5);

            const updateRes = http.post(`${API}/profiles`, JSON.stringify({
                bio: `Load test update ${Date.now()}`,
                interests: ['reading', 'travel'],
            }), headers);
            restLatency.add(updateRes.timings.duration);
            overallSuccess.add(check(updateRes, {
                'update ok': (r) => r.status === 200 || r.status === 201,
            }));

            sleep(0.5);

            const statusRes = http.get(`${API}/monetization/status`, headers);
            restLatency.add(statusRes.timings.duration);
            overallSuccess.add(check(statusRes, { 'monet ok': (r) => r.status === 200 }));
        });

    } else {
        // Idle heartbeat
        group('REST: Heartbeat', () => {
            const meRes = http.get(`${API}/users/me`, headers);
            restLatency.add(meRes.timings.duration);
            overallSuccess.add(check(meRes, { 'me ok': (r) => r.status === 200 }));

            sleep(5 + Math.random() * 10);

            const unreadRes = http.get(`${API}/notifications/unread-count`, headers);
            restLatency.add(unreadRes.timings.duration);
            overallSuccess.add(check(unreadRes, { 'notif-count ok': (r) => r.status === 200 }));
        });
    }

    sleep(1 + Math.random() * 2);
}

// ─── WebSocket Scenario (30% of total users) ────────────────────────────────

export function wsScenario() {
    const vuId = __VU + 100000; // Offset to avoid collision with REST VU IDs
    const token = loginAndGetToken(vuId);
    if (!token) { sleep(2); return; }

    const wsUrl = `${WS_URL}/socket.io/?EIO=4&transport=websocket`;
    const connectStart = Date.now();

    const res = ws.connect(wsUrl, {
        headers: { 'Authorization': `Bearer ${token}` },
    }, function (socket) {
        wsConnectTime.add(Date.now() - connectStart);
        overallSuccess.add(true);

        let msgTimestamps = {};

        // Socket.IO handshake
        socket.send('40');

        socket.on('message', function (data) {
            if (typeof data !== 'string') return;

            if (data.startsWith('40')) {
                socket.send(`42["authenticate",{"token":"${token}"}]`);
            }

            if (data.startsWith('42')) {
                try {
                    const payload = JSON.parse(data.substring(2));
                    if (payload[0] === 'newMessage' && payload[1]?.tempId) {
                        const ts = msgTimestamps[payload[1].tempId];
                        if (ts) {
                            wsMsgRoundTrip.add(Date.now() - ts);
                            delete msgTimestamps[payload[1].tempId];
                        }
                    }
                } catch {}
            }

            if (data === '2') socket.send('3'); // pong
        });

        socket.on('error', () => { totalErrors.add(1); });

        // Simulate activity
        sleep(1);

        const convId = `conv_combined_${vuId}`;
        socket.send(`42["joinConversation",{"conversationId":"${convId}"}]`);
        sleep(0.5);

        // Send 2-5 messages
        const msgCount = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < msgCount; i++) {
            socket.send(`42["typing",{"conversationId":"${convId}"}]`);
            sleep(1 + Math.random() * 2);

            socket.send(`42["stopTyping",{"conversationId":"${convId}"}]`);

            const tempId = randomUUID();
            msgTimestamps[tempId] = Date.now();
            socket.send(`42["sendMessage",{"conversationId":"${convId}","content":"${randomMessage()}","tempId":"${tempId}"}]`);
            sleep(2 + Math.random() * 4);
        }

        socket.send(`42["markRead",{"conversationId":"${convId}"}]`);
        sleep(1);
        socket.send(`42["leaveConversation",{"conversationId":"${convId}"}]`);
        sleep(1);

        socket.close();
    });

    check(res, { 'ws upgrade 101': (r) => r && r.status === 101 });
}

// ─── Report ──────────────────────────────────────────────────────────────────

export function handleSummary(data) {
    const now = new Date().toISOString().replace(/[:.]/g, '-');
    return {
        [`load-tests/reports/combined-${scenario}-${now}.json`]: JSON.stringify(data, null, 2),
        stdout: generateCombinedReport(data),
    };
}

function generateCombinedReport(data) {
    const m = data.metrics;
    const sep = '═'.repeat(70);

    return `
${sep}
  WAFAA BACKEND — COMBINED LOAD TEST REPORT
  Scenario: ${scenario.toUpperCase()} (REST + WebSocket)
  Date: ${new Date().toISOString()}
${sep}

📊 OVERALL
  Total HTTP Requests:      ${m.http_reqs?.values?.count || 0}
  HTTP Throughput:           ${(m.http_reqs?.values?.rate || 0).toFixed(1)} req/s
  HTTP Error Rate:           ${((m.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%
  Overall Success Rate:      ${((m.overall_success_rate?.values?.rate || 0) * 100).toFixed(1)}%
  Total Errors:              ${m.total_errors?.values?.count || 0}

⏱️  REST API LATENCY
  Average:                   ${(m.rest_latency?.values?.avg || 0).toFixed(1)}ms
  P95:                       ${(m.rest_latency?.values?.['p(95)'] || 0).toFixed(1)}ms
  P99:                       ${(m.rest_latency?.values?.['p(99)'] || 0).toFixed(1)}ms

🔐 AUTH LATENCY
  Average:                   ${(m.auth_latency?.values?.avg || 0).toFixed(1)}ms
  P95:                       ${(m.auth_latency?.values?.['p(95)'] || 0).toFixed(1)}ms

🔌 WEBSOCKET
  Connect Time P95:          ${(m.ws_connect_time?.values?.['p(95)'] || 0).toFixed(1)}ms
  Msg Round-Trip P95:        ${(m.ws_msg_roundtrip?.values?.['p(95)'] || 0).toFixed(1)}ms
  Msg Round-Trip Avg:        ${(m.ws_msg_roundtrip?.values?.avg || 0).toFixed(1)}ms

📈 HTTP RESPONSE TIMES
  Average:                   ${(m.http_req_duration?.values?.avg || 0).toFixed(1)}ms
  P95:                       ${(m.http_req_duration?.values?.['p(95)'] || 0).toFixed(1)}ms
  P99:                       ${(m.http_req_duration?.values?.['p(99)'] || 0).toFixed(1)}ms
  Max:                       ${(m.http_req_duration?.values?.max || 0).toFixed(1)}ms
${sep}
`;
}
