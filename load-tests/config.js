// ─── Load Test Configuration ─────────────────────────────────────────────────
// Central config for all k6 load test scripts
// Target: Wafaa Backend (NestJS + PostgreSQL + Redis + WebSockets)

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
export const API_PREFIX = __ENV.API_PREFIX || 'api/v1';
export const WS_URL = __ENV.WS_URL || 'ws://localhost:3000';

export const API = `${BASE_URL}/${API_PREFIX}`;

// ─── Thresholds (SLA) ───────────────────────────────────────────────────────
export const THRESHOLDS = {
    http_req_duration: ['p(95)<500', 'p(99)<1500'],   // 95th < 500ms, 99th < 1.5s
    http_req_failed: ['rate<0.05'],                     // Error rate < 5%
    http_reqs: ['rate>100'],                            // Throughput > 100 req/s
    ws_connecting: ['p(95)<1000'],                      // WS connect < 1s
    ws_msgs_sent: ['rate>50'],                          // WS msg throughput
    iteration_duration: ['p(95)<5000'],                 // Full scenario < 5s
};

// ─── Load Scenarios ──────────────────────────────────────────────────────────

export const SCENARIOS = {
    // 1) Normal Load — 1,000 users
    normal: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
            { duration: '2m', target: 200 },   // Ramp up
            { duration: '5m', target: 1000 },   // Hold at 1k
            { duration: '3m', target: 1000 },   // Sustain
            { duration: '2m', target: 0 },       // Ramp down
        ],
        gracefulRampDown: '30s',
    },

    // 2) High Load — 5,000 users
    high: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
            { duration: '3m', target: 1000 },
            { duration: '5m', target: 5000 },
            { duration: '5m', target: 5000 },
            { duration: '3m', target: 0 },
        ],
        gracefulRampDown: '30s',
    },

    // 3) Peak Load — 10,000 users
    peak: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
            { duration: '3m', target: 2000 },
            { duration: '5m', target: 10000 },
            { duration: '5m', target: 10000 },
            { duration: '3m', target: 0 },
        ],
        gracefulRampDown: '60s',
    },

    // 4) Stress Test — Increase until break
    stress: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
            { duration: '2m', target: 2000 },
            { duration: '3m', target: 5000 },
            { duration: '3m', target: 8000 },
            { duration: '3m', target: 12000 },
            { duration: '3m', target: 15000 },
            { duration: '3m', target: 20000 },  // Push to 20k
            { duration: '2m', target: 0 },
        ],
        gracefulRampDown: '60s',
    },

    // 5) Spike Test — Jump from 1k → 10k instantly
    spike: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
            { duration: '2m', target: 1000 },   // Warm up at 1k
            { duration: '3m', target: 1000 },   // Hold 1k
            { duration: '10s', target: 10000 },  // SPIKE to 10k
            { duration: '5m', target: 10000 },   // Hold 10k
            { duration: '2m', target: 1000 },    // Drop back
            { duration: '2m', target: 0 },
        ],
        gracefulRampDown: '30s',
    },
};

// ─── User Behavior Distribution ──────────────────────────────────────────────
// 40% browsing, 25% chatting, 15% profile update, 10% auth, 10% idle
export const USER_BEHAVIOR = {
    BROWSING: 0.40,
    CHATTING: 0.25,
    PROFILE_UPDATE: 0.15,
    AUTH_FLOW: 0.10,
    IDLE_PRESENCE: 0.10,
};

// ─── Test Data Generators ────────────────────────────────────────────────────

export function randomEmail() {
    const id = `loadtest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return `${id}@loadtest.wafaa.app`;
}

export function randomUsername() {
    return `lt_${Math.random().toString(36).slice(2, 10)}`;
}

export function randomName() {
    const firstNames = ['Ahmed', 'Omar', 'Fatima', 'Aisha', 'Youssef', 'Maryam', 'Ali', 'Sara', 'Hassan', 'Nour'];
    const lastNames = ['Al-Rashid', 'El-Amin', 'Khoury', 'Mansour', 'Hakim', 'Saleh', 'Nasser', 'Fadel'];
    return {
        firstName: firstNames[Math.floor(Math.random() * firstNames.length)],
        lastName: lastNames[Math.floor(Math.random() * lastNames.length)],
    };
}

export function randomSwipeAction() {
    const r = Math.random();
    if (r < 0.45) return 'like';
    if (r < 0.85) return 'pass';
    if (r < 0.95) return 'super_like';
    return 'compliment';
}

export function randomMessage() {
    const messages = [
        'Assalamu Alaikum! How are you?',
        'MashAllah, nice profile!',
        'What are your hobbies?',
        'Where are you from?',
        'SubhanAllah, we have similar interests!',
        'Have you prayed Fajr today?',
        'What do you do for work?',
        'How do you spend your weekends?',
        'Do you enjoy reading?',
        'What are you looking for in a partner?',
        'Your bio is really interesting!',
        'JazakAllah Khair for connecting!',
    ];
    return messages[Math.floor(Math.random() * messages.length)];
}

export function randomUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

// ─── HTTP Helpers ────────────────────────────────────────────────────────────

export function authHeaders(token) {
    return {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
    };
}

export function jsonHeaders() {
    return {
        headers: {
            'Content-Type': 'application/json',
        },
    };
}
