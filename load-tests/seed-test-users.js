// ─── Seed Test Users for Load Testing ────────────────────────────────────────
// Run this BEFORE load tests to create test user accounts in the database
// Usage: node load-tests/seed-test-users.js [count] [baseUrl]

const http = require('http');
const https = require('https');

const BASE_URL = process.argv[3] || process.env.BASE_URL || 'http://localhost:3000';
const API_PREFIX = process.env.API_PREFIX || 'api/v1';
const USER_COUNT = parseInt(process.argv[2] || '500', 10);
const PASSWORD = 'LoadT3st!Pass';
const CONCURRENCY = 10; // Parallel registration requests

console.log(`
═══════════════════════════════════════════════════════════════
  WAFAA LOAD TEST — USER SEEDER
  Target:     ${BASE_URL}/${API_PREFIX}
  Users:      ${USER_COUNT}
  Password:   ${PASSWORD}
  Concurrency: ${CONCURRENCY}
═══════════════════════════════════════════════════════════════
`);

function makeRequest(method, path, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${BASE_URL}/${API_PREFIX}${path}`);
        const isHttps = url.protocol === 'https:';
        const lib = isHttps ? https : http;

        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
            method,
            headers: {
                'Content-Type': 'application/json',
            },
            rejectUnauthorized: false,
        };

        const req = lib.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function seedUser(index) {
    const email = `loadtest_user_${index}@loadtest.wafaa.app`;
    const firstName = ['Ahmed', 'Omar', 'Fatima', 'Aisha', 'Youssef', 'Maryam', 'Ali', 'Sara'][index % 8];
    const lastName = ['Al-Rashid', 'El-Amin', 'Khoury', 'Mansour', 'Hakim', 'Saleh'][index % 6];
    const username = `lt_user_${index}`;

    try {
        const res = await makeRequest('POST', '/auth/register', {
            email,
            password: PASSWORD,
            confirmPassword: PASSWORD,
            firstName,
            lastName,
            username,
        });

        if (res.status === 201) {
            return { index, status: 'created', email };
        } else if (res.status === 409) {
            return { index, status: 'exists', email };
        } else {
            return { index, status: 'error', email, code: res.status, msg: JSON.stringify(res.body).slice(0, 100) };
        }
    } catch (err) {
        return { index, status: 'failed', email, error: err.message };
    }
}

async function seedBatch(startIndex, count) {
    const promises = [];
    for (let i = startIndex; i < startIndex + count; i++) {
        promises.push(seedUser(i));
    }
    return Promise.all(promises);
}

async function main() {
    let created = 0;
    let exists = 0;
    let errors = 0;
    const startTime = Date.now();

    for (let batch = 0; batch < USER_COUNT; batch += CONCURRENCY) {
        const batchSize = Math.min(CONCURRENCY, USER_COUNT - batch);
        const results = await seedBatch(batch, batchSize);

        for (const r of results) {
            if (r.status === 'created') created++;
            else if (r.status === 'exists') exists++;
            else {
                errors++;
                if (errors <= 10) console.log(`  ⚠ Error: user ${r.index} — ${r.msg || r.error}`);
            }
        }

        const progress = Math.min(100, ((batch + batchSize) / USER_COUNT * 100)).toFixed(0);
        process.stdout.write(`\r  Progress: ${progress}% | Created: ${created} | Exists: ${exists} | Errors: ${errors}`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n
═══════════════════════════════════════════════════════════════
  SEEDING COMPLETE
  Created:    ${created}
  Existing:   ${exists}
  Errors:     ${errors}
  Time:       ${elapsed}s
  Rate:       ${(USER_COUNT / parseFloat(elapsed)).toFixed(1)} users/s
═══════════════════════════════════════════════════════════════

NOTE: Users created via register endpoint require OTP verification.
For load testing, you may need to either:
  1. Bypass OTP in test environment (set OTP_BYPASS=true)
  2. Auto-verify users via direct DB update:
     UPDATE users SET "emailVerified" = true
     WHERE email LIKE 'loadtest_%@loadtest.wafaa.app';
`);
}

main().catch(console.error);
