// ─── WebSocket Load Test — Real-time Chat & Presence Simulation ──────────────
// Simulates 3,000–5,000 concurrent WebSocket connections with realistic behavior
// Uses k6 with k6/ws module

import ws from 'k6/ws';
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import {
    API, WS_URL, THRESHOLDS,
    randomMessage, randomUUID, jsonHeaders,
} from '../config.js';

// ─── Custom Metrics ──────────────────────────────────────────────────────────

const wsConnectTime = new Trend('ws_connect_time', true);
const wsMsgRoundTrip = new Trend('ws_msg_roundtrip', true);
const wsTypingLatency = new Trend('ws_typing_latency', true);
const wsErrors = new Counter('ws_errors');
const wsDisconnects = new Counter('ws_disconnects');
const wsReconnects = new Counter('ws_reconnects');
const wsMsgsSent = new Counter('ws_messages_sent');
const wsMsgsReceived = new Counter('ws_messages_received');
const wsConnectionSuccess = new Rate('ws_connection_success');

// ─── Options ─────────────────────────────────────────────────────────────────

const scenario = __ENV.WS_SCENARIO || 'ws_normal';

export const options = {
    scenarios: {
        ws_normal: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '1m', target: 500 },
                { duration: '3m', target: 3000 },
                { duration: '5m', target: 3000 },
                { duration: '2m', target: 0 },
            ],
            exec: 'websocketScenario',
        },
        ws_peak: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '2m', target: 1000 },
                { duration: '3m', target: 5000 },
                { duration: '5m', target: 5000 },
                { duration: '2m', target: 0 },
            ],
            exec: 'websocketScenario',
        },
        ws_stress: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '2m', target: 2000 },
                { duration: '3m', target: 5000 },
                { duration: '3m', target: 8000 },
                { duration: '3m', target: 10000 },
                { duration: '2m', target: 0 },
            ],
            exec: 'websocketScenario',
        },
    },
    thresholds: {
        ws_connect_time: ['p(95)<2000'],           // Connect < 2s
        ws_msg_roundtrip: ['p(95)<500'],           // Msg RTT < 500ms
        ws_connection_success: ['rate>0.95'],      // 95% connect success
        ws_errors: ['count<100'],
    },
};

// ─── Helper: Login to get JWT ────────────────────────────────────────────────

function getToken(vuId) {
    const email = `loadtest_user_${vuId}@loadtest.wafaa.app`;
    const res = http.post(`${API}/auth/login`, JSON.stringify({
        email,
        password: 'LoadT3st!Pass',
    }), jsonHeaders());

    if (res.status !== 200) return null;

    try {
        const body = JSON.parse(res.body);
        return body.data?.accessToken || null;
    } catch {
        return null;
    }
}

// ─── Main WebSocket Scenario ─────────────────────────────────────────────────

export function websocketScenario() {
    const vuId = __VU;
    const token = getToken(vuId);

    if (!token) {
        wsErrors.add(1);
        wsConnectionSuccess.add(false);
        sleep(2);
        return;
    }

    // Build Socket.IO compatible URL
    // Socket.IO uses Engine.IO under the hood with polling upgrade to websocket
    const wsUrl = `${WS_URL}/socket.io/?EIO=4&transport=websocket`;

    const connectStart = Date.now();

    const res = ws.connect(wsUrl, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    }, function (socket) {
        const connectDuration = Date.now() - connectStart;
        wsConnectTime.add(connectDuration);
        wsConnectionSuccess.add(true);

        let authenticated = false;
        let conversationId = null;
        let msgTimestamps = {};

        // ── Socket.IO handshake ──────────────────────────────────
        // Engine.IO protocol: send "40" to initiate Socket.IO connection
        socket.send('40');

        // ── Handle incoming messages ─────────────────────────────
        socket.on('message', function (data) {
            // Socket.IO protocol parsing
            if (typeof data !== 'string') return;

            // "40" = Socket.IO connect ack
            if (data.startsWith('40')) {
                authenticated = true;
                // Send auth with token (Socket.IO auth object)
                socket.send(`42["authenticate",{"token":"${token}"}]`);
            }

            // "42" = Socket.IO event
            if (data.startsWith('42')) {
                try {
                    const payload = JSON.parse(data.substring(2));
                    const eventName = payload[0];
                    const eventData = payload[1];

                    switch (eventName) {
                        case 'newMessage':
                            wsMsgsReceived.add(1);
                            // Calculate round-trip if we sent this message
                            if (eventData?.id && msgTimestamps[eventData.id]) {
                                const rtt = Date.now() - msgTimestamps[eventData.id];
                                wsMsgRoundTrip.add(rtt);
                                delete msgTimestamps[eventData.id];
                            }
                            break;

                        case 'typing':
                            wsTypingLatency.add(Date.now() - connectStart);
                            break;

                        case 'userOnline':
                        case 'userOffline':
                        case 'messagesRead':
                        case 'messagesDelivered':
                            // Presence/status events received
                            break;

                        case 'error':
                            wsErrors.add(1);
                            break;
                    }
                } catch {}
            }

            // "2" = Engine.IO ping
            if (data === '2') {
                socket.send('3'); // pong
            }
        });

        socket.on('error', function (e) {
            wsErrors.add(1);
        });

        socket.on('close', function () {
            wsDisconnects.add(1);
        });

        // ── Simulate user behavior over connection lifetime ──────

        // Wait for auth
        sleep(1);

        // Determine user behavior for this session
        const behaviorRoll = Math.random();

        if (behaviorRoll < 0.50) {
            // 50% — Active chatter
            simulateActiveChatting(socket, vuId, msgTimestamps);
        } else if (behaviorRoll < 0.80) {
            // 30% — Passive listener (joins rooms, reads messages)
            simulatePassiveListening(socket, vuId);
        } else {
            // 20% — Idle presence (just stays connected)
            simulateIdlePresence(socket);
        }

        // Graceful close
        socket.close();
    });

    check(res, {
        'ws: status 101 (upgrade)': (r) => r && r.status === 101,
    });
}

// ─── Active Chatter Simulation ───────────────────────────────────────────────

function simulateActiveChatting(socket, vuId, msgTimestamps) {
    // Use a fake conversation ID (in real test, fetch from REST API first)
    const convId = `conv_${vuId}_${Math.floor(Math.random() * 10)}`;

    // Join conversation
    socket.send(`42["joinConversation",{"conversationId":"${convId}"}]`);
    sleep(0.5);

    // Send messages with think time
    const msgCount = 3 + Math.floor(Math.random() * 8); // 3-10 messages
    for (let i = 0; i < msgCount; i++) {
        // Typing indicator
        socket.send(`42["typing",{"conversationId":"${convId}"}]`);
        sleep(1 + Math.random() * 3); // Typing delay 1-4s

        // Stop typing
        socket.send(`42["stopTyping",{"conversationId":"${convId}"}]`);

        // Send message
        const tempId = randomUUID();
        msgTimestamps[tempId] = Date.now();
        const msg = randomMessage();
        socket.send(`42["sendMessage",{"conversationId":"${convId}","content":"${msg}","tempId":"${tempId}"}]`);
        wsMsgsSent.add(1);

        sleep(2 + Math.random() * 5); // Wait 2-7s between messages
    }

    // Mark as read
    socket.send(`42["markRead",{"conversationId":"${convId}"}]`);
    sleep(1);

    // Leave conversation
    socket.send(`42["leaveConversation",{"conversationId":"${convId}"}]`);
    sleep(1);
}

// ─── Passive Listener Simulation ─────────────────────────────────────────────

function simulatePassiveListening(socket, vuId) {
    const convId = `conv_${vuId}_${Math.floor(Math.random() * 5)}`;

    // Join conversation
    socket.send(`42["joinConversation",{"conversationId":"${convId}"}]`);
    sleep(1);

    // Mark as delivered
    socket.send(`42["markDelivered",{"conversationId":"${convId}"}]`);
    sleep(2);

    // Just listen for 15-30 seconds
    sleep(15 + Math.random() * 15);

    // Mark as read before leaving
    socket.send(`42["markRead",{"conversationId":"${convId}"}]`);
    sleep(0.5);

    // Check online status of some users
    for (let i = 0; i < 3; i++) {
        socket.send(`42["checkOnline",{"userId":"${randomUUID()}"}]`);
        sleep(1);
    }

    socket.send(`42["leaveConversation",{"conversationId":"${convId}"}]`);
    sleep(1);
}

// ─── Idle Presence Simulation ────────────────────────────────────────────────

function simulateIdlePresence(socket) {
    // Stay connected for 30-60 seconds, just handling pings
    const idleDuration = 30 + Math.random() * 30;
    const intervals = Math.floor(idleDuration / 10);

    for (let i = 0; i < intervals; i++) {
        // Occasional online check
        if (Math.random() < 0.3) {
            socket.send(`42["checkOnline",{"userId":"${randomUUID()}"}]`);
        }
        sleep(10);
    }
}

// ─── Report ──────────────────────────────────────────────────────────────────

export function handleSummary(data) {
    const now = new Date().toISOString().replace(/[:.]/g, '-');
    return {
        [`load-tests/reports/websocket-${scenario}-${now}.json`]: JSON.stringify(data, null, 2),
        stdout: generateWSReport(data),
    };
}

function generateWSReport(data) {
    const m = data.metrics;
    const sep = '═'.repeat(70);

    return `
${sep}
  WAFAA BACKEND — WEBSOCKET LOAD TEST REPORT
  Scenario: ${scenario.toUpperCase()}
  Date: ${new Date().toISOString()}
${sep}

🔌 CONNECTION METRICS
  Connection Success Rate:  ${((m.ws_connection_success?.values?.rate || 0) * 100).toFixed(1)}%
  Connect Time P95:         ${(m.ws_connect_time?.values?.['p(95)'] || 0).toFixed(1)}ms
  Connect Time P99:         ${(m.ws_connect_time?.values?.['p(99)'] || 0).toFixed(1)}ms
  Total Disconnects:        ${m.ws_disconnects?.values?.count || 0}
  Total Reconnects:         ${m.ws_reconnects?.values?.count || 0}
  Total WS Errors:          ${m.ws_errors?.values?.count || 0}

💬 MESSAGE METRICS
  Messages Sent:            ${m.ws_messages_sent?.values?.count || 0}
  Messages Received:        ${m.ws_messages_received?.values?.count || 0}
  Msg Round-Trip P95:       ${(m.ws_msg_roundtrip?.values?.['p(95)'] || 0).toFixed(1)}ms
  Msg Round-Trip P99:       ${(m.ws_msg_roundtrip?.values?.['p(99)'] || 0).toFixed(1)}ms
  Msg Round-Trip Avg:       ${(m.ws_msg_roundtrip?.values?.avg || 0).toFixed(1)}ms

⌨️  TYPING INDICATOR
  Typing Latency P95:       ${(m.ws_typing_latency?.values?.['p(95)'] || 0).toFixed(1)}ms

📡 HTTP METRICS (Auth calls)
  HTTP Requests:            ${m.http_reqs?.values?.count || 0}
  HTTP Error Rate:          ${((m.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%
${sep}
`;
}
