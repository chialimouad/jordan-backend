// ─── REST API Load Test — Realistic User Behavior Simulation ─────────────────
// Simulates 10,000 concurrent users with weighted behavior distribution
// Uses k6 (https://k6.io) — install: `choco install k6` or `brew install k6`

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import {
    API, THRESHOLDS, SCENARIOS, USER_BEHAVIOR,
    randomEmail, randomUsername, randomName, randomSwipeAction,
    randomMessage, randomUUID, authHeaders, jsonHeaders,
} from '../config.js';

// ─── Custom Metrics ──────────────────────────────────────────────────────────

const authLatency = new Trend('auth_latency', true);
const discoveryLatency = new Trend('discovery_latency', true);
const swipeLatency = new Trend('swipe_latency', true);
const chatLatency = new Trend('chat_latency', true);
const profileLatency = new Trend('profile_latency', true);
const notifLatency = new Trend('notification_latency', true);
const searchLatency = new Trend('search_latency', true);

const authErrors = new Counter('auth_errors');
const apiErrors = new Counter('api_errors');
const matchesFound = new Counter('matches_found');
const messagesDelivered = new Counter('messages_delivered');

const authSuccessRate = new Rate('auth_success_rate');
const apiSuccessRate = new Rate('api_success_rate');

// ─── k6 Options ──────────────────────────────────────────────────────────────

const scenario = __ENV.SCENARIO || 'normal';

export const options = {
    scenarios: {
        [scenario]: {
            ...SCENARIOS[scenario],
            exec: 'default',
        },
    },
    thresholds: THRESHOLDS,
    noConnectionReuse: false,
    userAgent: 'WafaaLoadTest/1.0 (k6)',
    insecureSkipTLSVerify: true,
};

// ─── Shared State ────────────────────────────────────────────────────────────
// Pre-created test user pool (seeded before test)
// Each VU gets a deterministic user based on VU ID

function getTestUserCredentials(vuId) {
    return {
        email: `loadtest_user_${vuId}@loadtest.wafaa.app`,
        password: 'LoadT3st!Pass',
    };
}

// ─── MAIN SCENARIO ───────────────────────────────────────────────────────────

export default function () {
    const vuId = __VU;
    const roll = Math.random();

    // Weighted behavior selection
    if (roll < USER_BEHAVIOR.AUTH_FLOW) {
        authFlowScenario();
    } else if (roll < USER_BEHAVIOR.AUTH_FLOW + USER_BEHAVIOR.BROWSING) {
        browsingScenario(vuId);
    } else if (roll < USER_BEHAVIOR.AUTH_FLOW + USER_BEHAVIOR.BROWSING + USER_BEHAVIOR.CHATTING) {
        chattingScenario(vuId);
    } else if (roll < USER_BEHAVIOR.AUTH_FLOW + USER_BEHAVIOR.BROWSING + USER_BEHAVIOR.CHATTING + USER_BEHAVIOR.PROFILE_UPDATE) {
        profileUpdateScenario(vuId);
    } else {
        idlePresenceScenario(vuId);
    }
}

// ─── AUTH FLOW (10%) — Register / Login / Refresh ────────────────────────────

function authFlowScenario() {
    group('Auth Flow', () => {
        const email = randomEmail();
        const { firstName, lastName } = randomName();
        const password = 'LoadT3st!Pass';

        // 1. Register
        group('Register', () => {
            const res = http.post(`${API}/auth/register`, JSON.stringify({
                email,
                password,
                confirmPassword: password,
                firstName,
                lastName,
                username: randomUsername(),
            }), jsonHeaders());

            authLatency.add(res.timings.duration);
            const ok = check(res, {
                'register: status 201': (r) => r.status === 201,
            });
            authSuccessRate.add(ok);
            if (!ok) authErrors.add(1);
        });

        sleep(1 + Math.random() * 2); // Think time

        // 2. Login (with existing test user since OTP verification needed for new users)
        group('Login', () => {
            const creds = getTestUserCredentials(__VU);
            const res = http.post(`${API}/auth/login`, JSON.stringify({
                email: creds.email,
                password: creds.password,
            }), jsonHeaders());

            authLatency.add(res.timings.duration);
            const ok = check(res, {
                'login: status 200': (r) => r.status === 200,
                'login: has accessToken': (r) => {
                    try { return !!JSON.parse(r.body).data?.accessToken; }
                    catch { return false; }
                },
            });
            authSuccessRate.add(ok);
            if (!ok) authErrors.add(1);

            if (ok) {
                try {
                    const body = JSON.parse(res.body);
                    const accessToken = body.data?.accessToken;
                    const refreshToken = body.data?.refreshToken;

                    // 3. Refresh token
                    if (refreshToken) {
                        sleep(0.5);
                        group('Refresh Token', () => {
                            const refreshRes = http.post(`${API}/auth/refresh`, JSON.stringify({
                                refreshToken,
                            }), jsonHeaders());

                            authLatency.add(refreshRes.timings.duration);
                            check(refreshRes, {
                                'refresh: status 200': (r) => r.status === 200,
                            });
                        });
                    }
                } catch {}
            }
        });

        sleep(1 + Math.random());
    });
}

// ─── BROWSING FLOW (40%) — Discovery / Suggestions / Swipes ─────────────────

function browsingScenario(vuId) {
    const token = loginAndGetToken(vuId);
    if (!token) return;

    group('Browsing Flow', () => {
        const headers = authHeaders(token);

        // 1. Get suggestions
        let suggestions = [];
        group('Get Suggestions', () => {
            const res = http.get(`${API}/matches/suggestions?limit=20`, headers);
            discoveryLatency.add(res.timings.duration);
            const ok = check(res, {
                'suggestions: status 200': (r) => r.status === 200,
            });
            apiSuccessRate.add(ok);
            if (!ok) apiErrors.add(1);

            try {
                const body = JSON.parse(res.body);
                suggestions = body.data || [];
            } catch {}
        });

        sleep(1 + Math.random() * 2);

        // 2. Get discovery categories
        group('Discovery Categories', () => {
            const res = http.get(`${API}/matches/discover`, headers);
            discoveryLatency.add(res.timings.duration);
            check(res, { 'discover: status 200': (r) => r.status === 200 });
        });

        sleep(0.5 + Math.random());

        // 3. Search with filters
        group('Search Profiles', () => {
            const filters = `minAge=18&maxAge=35&gender=female&limit=20&page=1`;
            const res = http.get(`${API}/search?${filters}`, headers);
            searchLatency.add(res.timings.duration);
            check(res, { 'search: status 200': (r) => r.status === 200 });
        });

        sleep(0.5 + Math.random());

        // 4. Swipe on users (simulate swiping through deck)
        const swipeCount = Math.min(suggestions.length, 5 + Math.floor(Math.random() * 10));
        for (let i = 0; i < swipeCount; i++) {
            group('Swipe', () => {
                const targetId = suggestions[i]?.id || randomUUID();
                const action = randomSwipeAction();

                const payload = { targetUserId: targetId, action };
                if (action === 'compliment') {
                    payload.complimentMessage = 'MashAllah, great profile!';
                }

                const res = http.post(`${API}/swipes`, JSON.stringify(payload), headers);
                swipeLatency.add(res.timings.duration);
                const ok = check(res, {
                    'swipe: status 200 or 201': (r) => r.status === 200 || r.status === 201,
                });
                apiSuccessRate.add(ok);
                if (!ok) apiErrors.add(1);

                // Check if it was a match
                try {
                    const body = JSON.parse(res.body);
                    if (body.data?.matched) matchesFound.add(1);
                } catch {}
            });

            sleep(1 + Math.random() * 3); // Realistic swipe delay
        }

        // 5. View "who liked me"
        group('Who Liked Me', () => {
            const res = http.get(`${API}/swipes/who-liked-me`, headers);
            discoveryLatency.add(res.timings.duration);
            check(res, { 'who-liked-me: status 200': (r) => r.status === 200 });
        });

        sleep(0.5);

        // 6. Get matches
        group('Get Matches', () => {
            const res = http.get(`${API}/matches?page=1&limit=20`, headers);
            discoveryLatency.add(res.timings.duration);
            check(res, { 'matches: status 200': (r) => r.status === 200 });
        });

        // 7. Check nearby users
        group('Nearby Users', () => {
            const res = http.get(`${API}/matches/nearby?radius=50&limit=30`, headers);
            discoveryLatency.add(res.timings.duration);
            check(res, { 'nearby: status 200': (r) => r.status === 200 });
        });

        sleep(1 + Math.random() * 2);
    });
}

// ─── CHATTING FLOW (25%) — Conversations / Messages ──────────────────────────

function chattingScenario(vuId) {
    const token = loginAndGetToken(vuId);
    if (!token) return;

    group('Chat Flow', () => {
        const headers = authHeaders(token);

        // 1. Get conversations list
        let conversations = [];
        group('Get Conversations', () => {
            const res = http.get(`${API}/chat/conversations?page=1&limit=20`, headers);
            chatLatency.add(res.timings.duration);
            const ok = check(res, {
                'conversations: status 200': (r) => r.status === 200,
            });
            apiSuccessRate.add(ok);
            if (!ok) apiErrors.add(1);

            try {
                const body = JSON.parse(res.body);
                conversations = body.data || [];
            } catch {}
        });

        sleep(0.5 + Math.random());

        // 2. Get unread count
        group('Unread Count', () => {
            const res = http.get(`${API}/chat/unread`, headers);
            chatLatency.add(res.timings.duration);
            check(res, { 'unread: status 200': (r) => r.status === 200 });
        });

        // 3. Open a conversation and load messages
        if (conversations.length > 0) {
            const conv = conversations[Math.floor(Math.random() * conversations.length)];
            const convId = conv.id || conv.conversationId;

            if (convId) {
                group('Load Messages', () => {
                    const res = http.get(
                        `${API}/chat/conversations/${convId}/messages?page=1&limit=30`,
                        headers,
                    );
                    chatLatency.add(res.timings.duration);
                    check(res, { 'messages: status 200': (r) => r.status === 200 });
                });

                sleep(1 + Math.random() * 2);

                // 4. Mark as read
                group('Mark Read', () => {
                    const res = http.patch(
                        `${API}/chat/conversations/${convId}/read`,
                        null,
                        headers,
                    );
                    chatLatency.add(res.timings.duration);
                    check(res, { 'mark-read: status 200': (r) => r.status === 200 });
                });

                // 5. Mark as delivered
                group('Mark Delivered', () => {
                    const res = http.patch(
                        `${API}/chat/conversations/${convId}/delivered`,
                        null,
                        headers,
                    );
                    chatLatency.add(res.timings.duration);
                    check(res, { 'mark-delivered: status 200': (r) => r.status === 200 });
                });

                sleep(0.5);
            }
        }

        // 6. Check notifications
        group('Get Notifications', () => {
            const res = http.get(`${API}/notifications?page=1&limit=10`, headers);
            notifLatency.add(res.timings.duration);
            check(res, { 'notifications: status 200': (r) => r.status === 200 });
        });

        group('Unread Notifications', () => {
            const res = http.get(`${API}/notifications/unread-count`, headers);
            notifLatency.add(res.timings.duration);
            check(res, { 'unread-notif: status 200': (r) => r.status === 200 });
        });

        sleep(1 + Math.random() * 3);
    });
}

// ─── PROFILE UPDATE FLOW (15%) — Profile / Preferences / Settings ────────────

function profileUpdateScenario(vuId) {
    const token = loginAndGetToken(vuId);
    if (!token) return;

    group('Profile Update Flow', () => {
        const headers = authHeaders(token);

        // 1. Get my profile
        group('Get My Profile', () => {
            const res = http.get(`${API}/profiles/me`, headers);
            profileLatency.add(res.timings.duration);
            check(res, { 'get-profile: status 200': (r) => r.status === 200 });
        });

        sleep(0.5 + Math.random());

        // 2. Get my user account
        group('Get My Account', () => {
            const res = http.get(`${API}/users/me`, headers);
            profileLatency.add(res.timings.duration);
            check(res, { 'get-user: status 200': (r) => r.status === 200 });
        });

        sleep(0.5);

        // 3. Update profile
        group('Update Profile', () => {
            const res = http.post(`${API}/profiles`, JSON.stringify({
                bio: `Updated bio at ${new Date().toISOString()} — love hiking and reading Quran.`,
                interests: ['reading', 'hiking', 'cooking', 'travel'],
                occupation: 'Software Engineer',
            }), headers);
            profileLatency.add(res.timings.duration);
            const ok = check(res, {
                'update-profile: status 200 or 201': (r) => r.status === 200 || r.status === 201,
            });
            apiSuccessRate.add(ok);
            if (!ok) apiErrors.add(1);
        });

        sleep(1 + Math.random());

        // 4. Update location
        group('Update Location', () => {
            const lat = 24.7 + Math.random() * 2;  // Saudi Arabia range
            const lng = 46.5 + Math.random() * 2;
            const res = http.patch(`${API}/profiles/location`, JSON.stringify({
                latitude: lat,
                longitude: lng,
            }), headers);
            profileLatency.add(res.timings.duration);
            check(res, { 'update-location: status 200': (r) => r.status === 200 });
        });

        sleep(0.5);

        // 5. Get preferences
        group('Get Preferences', () => {
            const res = http.get(`${API}/profiles/preferences`, headers);
            profileLatency.add(res.timings.duration);
            check(res, { 'get-prefs: status 200': (r) => r.status === 200 });
        });

        // 6. Update preferences
        group('Update Preferences', () => {
            const res = http.put(`${API}/profiles/preferences`, JSON.stringify({
                minAge: 22,
                maxAge: 35,
                maxDistance: 100,
            }), headers);
            profileLatency.add(res.timings.duration);
            check(res, { 'update-prefs: status 200': (r) => r.status === 200 });
        });

        sleep(0.5);

        // 7. Update privacy
        group('Update Privacy', () => {
            const res = http.patch(`${API}/profiles/privacy`, JSON.stringify({
                showOnlineStatus: Math.random() > 0.5,
                showDistance: true,
                showLastSeen: Math.random() > 0.3,
            }), headers);
            profileLatency.add(res.timings.duration);
            check(res, { 'update-privacy: status 200': (r) => r.status === 200 });
        });

        // 8. Get notification settings
        group('Notification Settings', () => {
            const res = http.get(`${API}/notifications/settings`, headers);
            notifLatency.add(res.timings.duration);
            check(res, { 'get-notif-settings: status 200': (r) => r.status === 200 });
        });

        // 9. Get subscription status
        group('Subscription Status', () => {
            const res = http.get(`${API}/monetization/status`, headers);
            profileLatency.add(res.timings.duration);
            check(res, { 'monetization-status: status 200': (r) => r.status === 200 });
        });

        // 10. Get remaining likes
        group('Remaining Likes', () => {
            const res = http.get(`${API}/monetization/remaining-likes`, headers);
            profileLatency.add(res.timings.duration);
            check(res, { 'remaining-likes: status 200': (r) => r.status === 200 });
        });

        sleep(1 + Math.random() * 2);
    });
}

// ─── IDLE/PRESENCE FLOW (10%) — Periodic heartbeats ──────────────────────────

function idlePresenceScenario(vuId) {
    const token = loginAndGetToken(vuId);
    if (!token) return;

    group('Idle Presence', () => {
        const headers = authHeaders(token);

        // Periodic checks while "idle"
        for (let i = 0; i < 3; i++) {
            // 1. Check unread messages
            group('Heartbeat: Unread', () => {
                const res = http.get(`${API}/chat/unread`, headers);
                chatLatency.add(res.timings.duration);
                check(res, { 'heartbeat-unread: status 200': (r) => r.status === 200 });
            });

            // 2. Check notifications
            group('Heartbeat: Notifications', () => {
                const res = http.get(`${API}/notifications/unread-count`, headers);
                notifLatency.add(res.timings.duration);
                check(res, { 'heartbeat-notif: status 200': (r) => r.status === 200 });
            });

            // 3. Get user profile (keep session alive)
            group('Heartbeat: Profile', () => {
                const res = http.get(`${API}/users/me`, headers);
                profileLatency.add(res.timings.duration);
                check(res, { 'heartbeat-profile: status 200': (r) => r.status === 200 });
            });

            sleep(5 + Math.random() * 10); // Idle wait 5-15s between heartbeats
        }
    });
}

// ─── Helper: Login and get token ─────────────────────────────────────────────

function loginAndGetToken(vuId) {
    const creds = getTestUserCredentials(vuId);
    const res = http.post(`${API}/auth/login`, JSON.stringify({
        email: creds.email,
        password: creds.password,
    }), jsonHeaders());

    authLatency.add(res.timings.duration);

    if (res.status !== 200) {
        authErrors.add(1);
        authSuccessRate.add(false);
        return null;
    }

    authSuccessRate.add(true);

    try {
        const body = JSON.parse(res.body);
        return body.data?.accessToken || null;
    } catch {
        return null;
    }
}

// ─── Lifecycle Hooks ─────────────────────────────────────────────────────────

export function handleSummary(data) {
    const now = new Date().toISOString().replace(/[:.]/g, '-');
    return {
        [`load-tests/reports/rest-api-${scenario}-${now}.json`]: JSON.stringify(data, null, 2),
        stdout: generateTextReport(data),
    };
}

function generateTextReport(data) {
    const metrics = data.metrics;
    const sep = '═'.repeat(70);

    let report = `
${sep}
  WAFAA BACKEND — REST API LOAD TEST REPORT
  Scenario: ${scenario.toUpperCase()}
  Date: ${new Date().toISOString()}
${sep}

📊 REQUEST METRICS
  Total Requests:    ${metrics.http_reqs?.values?.count || 0}
  Throughput:        ${(metrics.http_reqs?.values?.rate || 0).toFixed(1)} req/s
  Error Rate:        ${((metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%

⏱️  RESPONSE TIMES
  Average:           ${(metrics.http_req_duration?.values?.avg || 0).toFixed(1)}ms
  Median:            ${(metrics.http_req_duration?.values?.med || 0).toFixed(1)}ms
  P95:               ${(metrics.http_req_duration?.values['p(95)'] || 0).toFixed(1)}ms
  P99:               ${(metrics.http_req_duration?.values['p(99)'] || 0).toFixed(1)}ms
  Max:               ${(metrics.http_req_duration?.values?.max || 0).toFixed(1)}ms

🔐 AUTH METRICS
  Auth Latency P95:  ${(metrics.auth_latency?.values?.['p(95)'] || 0).toFixed(1)}ms
  Auth Success Rate: ${((metrics.auth_success_rate?.values?.rate || 0) * 100).toFixed(1)}%
  Auth Errors:       ${metrics.auth_errors?.values?.count || 0}

🔍 DISCOVERY METRICS
  Discovery P95:     ${(metrics.discovery_latency?.values?.['p(95)'] || 0).toFixed(1)}ms
  Search P95:        ${(metrics.search_latency?.values?.['p(95)'] || 0).toFixed(1)}ms

👆 SWIPE METRICS
  Swipe P95:         ${(metrics.swipe_latency?.values?.['p(95)'] || 0).toFixed(1)}ms
  Matches Found:     ${metrics.matches_found?.values?.count || 0}

💬 CHAT METRICS
  Chat P95:          ${(metrics.chat_latency?.values?.['p(95)'] || 0).toFixed(1)}ms

👤 PROFILE METRICS
  Profile P95:       ${(metrics.profile_latency?.values?.['p(95)'] || 0).toFixed(1)}ms

🔔 NOTIFICATION METRICS
  Notification P95:  ${(metrics.notification_latency?.values?.['p(95)'] || 0).toFixed(1)}ms

✅ API Success Rate: ${((metrics.api_success_rate?.values?.rate || 0) * 100).toFixed(1)}%
❌ Total API Errors: ${metrics.api_errors?.values?.count || 0}
${sep}
`;

    return report;
}
