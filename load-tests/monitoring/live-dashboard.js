// ─── Live Dashboard — Poll Server Metrics During Load Test ───────────────────
// Run alongside k6 tests to see real-time server-side metrics
// Usage: node load-tests/monitoring/live-dashboard.js [baseUrl] [intervalMs]

const http = require('http');
const https = require('https');

const BASE_URL = process.argv[2] || process.env.BASE_URL || 'http://localhost:3000';
const INTERVAL = parseInt(process.argv[3] || '3000', 10);
const METRICS_URL = `${BASE_URL}/_metrics`;

let iteration = 0;
let previousSnapshot = null;

function fetch(url) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? https : http;
        lib.get(url, { rejectUnauthorized: false, timeout: 5000 }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { resolve(null); }
            });
        }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
    });
}

function colorize(text, color) {
    const codes = { red: '31', green: '32', yellow: '33', blue: '34', magenta: '35', cyan: '36', white: '37', gray: '90' };
    return `\x1b[${codes[color] || '37'}m${text}\x1b[0m`;
}

function bar(value, max, width = 30) {
    const filled = Math.round((value / max) * width);
    const empty = width - filled;
    const color = value / max > 0.8 ? '31' : value / max > 0.5 ? '33' : '32';
    return `\x1b[${color}m${'█'.repeat(filled)}\x1b[90m${'░'.repeat(empty)}\x1b[0m`;
}

function formatMs(ms) {
    if (ms < 1) return colorize('<1ms', 'green');
    if (ms < 100) return colorize(`${ms}ms`, 'green');
    if (ms < 500) return colorize(`${ms}ms`, 'yellow');
    return colorize(`${ms}ms`, 'red');
}

async function pollAndDisplay() {
    iteration++;
    try {
        const snap = await fetch(METRICS_URL);
        if (!snap) {
            console.log(colorize(`[${new Date().toLocaleTimeString()}] No response from ${METRICS_URL}`, 'yellow'));
            return;
        }

        // Calculate delta
        let reqDelta = 0;
        let errDelta = 0;
        if (previousSnapshot) {
            reqDelta = snap.requests.total - previousSnapshot.requests.total;
            errDelta = snap.requests.errors - previousSnapshot.requests.errors;
        }
        previousSnapshot = snap;

        // Clear screen every 10 iterations
        if (iteration % 10 === 1) {
            process.stdout.write('\x1b[2J\x1b[H');
        }

        const sep = '═'.repeat(75);
        const line = '─'.repeat(75);

        let output = `
${colorize(sep, 'cyan')}
${colorize('  WAFAA BACKEND — LIVE METRICS DASHBOARD', 'cyan')}
${colorize(`  ${snap.timestamp}  |  Uptime: ${snap.uptime}  |  Poll #${iteration}`, 'gray')}
${colorize(sep, 'cyan')}

${colorize('  CPU', 'magenta')} ${bar(snap.system.cpuUsagePercent, 100)} ${snap.system.cpuUsagePercent.toFixed(1)}% (${snap.system.cpuCores} cores)
${colorize('  MEM', 'magenta')} ${bar(snap.system.usedMemoryPercent, 100)} ${snap.system.usedMemoryPercent.toFixed(1)}% (${snap.system.freeMemoryMB}MB free / ${snap.system.totalMemoryMB}MB)
${colorize('  HEAP', 'magenta')} ${bar(snap.process.heapUsedMB, snap.process.heapTotalMB)} ${snap.process.heapUsedMB}MB / ${snap.process.heapTotalMB}MB
${colorize('  RSS', 'magenta')} ${snap.process.rssMB}MB

${colorize(line, 'gray')}
${colorize('  REQUESTS', 'blue')}
  Total:       ${colorize(String(snap.requests.total), 'white')}   (+${reqDelta} since last poll)
  Throughput:  ${colorize(snap.requests.requestsPerSecond + ' req/s', 'cyan')}
  Errors:      ${snap.requests.errors > 0 ? colorize(String(snap.requests.errors), 'red') : colorize('0', 'green')} (${snap.requests.errorRate})  (+${errDelta})
  Active:      ${colorize(String(snap.requests.activeConnections), 'yellow')} HTTP  |  ${colorize(String(snap.requests.wsConnections), 'yellow')} WebSocket

${colorize(line, 'gray')}
${colorize('  SLOWEST ENDPOINTS (P95)', 'blue')}
`;

        if (snap.slowestEndpoints && snap.slowestEndpoints.length > 0) {
            output += `  ${'Endpoint'.padEnd(35)} ${'Avg'.padStart(7)} ${'P95'.padStart(7)} ${'P99'.padStart(7)} ${'Reqs'.padStart(7)} ${'Err%'.padStart(7)}\n`;
            output += `  ${'─'.repeat(35)} ${'─'.repeat(7)} ${'─'.repeat(7)} ${'─'.repeat(7)} ${'─'.repeat(7)} ${'─'.repeat(7)}\n`;

            const top = snap.slowestEndpoints.slice(0, 10);
            for (const ep of top) {
                const indicator = ep.p95LatencyMs > 500 ? '🔴' : ep.p95LatencyMs > 200 ? '🟡' : '🟢';
                output += `  ${indicator} ${ep.endpoint.padEnd(33)} ${formatMs(ep.avgLatencyMs).padStart(16)} ${formatMs(ep.p95LatencyMs).padStart(16)} ${formatMs(ep.p99LatencyMs).padStart(16)} ${String(ep.requests).padStart(7)} ${ep.errorRate.padStart(7)}\n`;
            }
        } else {
            output += `  ${colorize('No requests recorded yet...', 'gray')}\n`;
        }

        output += `\n${colorize(sep, 'cyan')}\n`;

        // Print
        process.stdout.write('\x1b[H'); // Move cursor to top
        console.log(output);

    } catch (err) {
        console.log(colorize(`[${new Date().toLocaleTimeString()}] Error: ${err.message}`, 'red'));
    }
}

// ─── Main Loop ───────────────────────────────────────────────────────────────

console.log(`\nStarting live dashboard — polling ${METRICS_URL} every ${INTERVAL}ms`);
console.log('Press Ctrl+C to stop\n');

// Clear screen
process.stdout.write('\x1b[2J\x1b[H');

setInterval(pollAndDisplay, INTERVAL);
pollAndDisplay();
