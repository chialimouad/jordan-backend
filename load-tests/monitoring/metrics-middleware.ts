// ─── Server-Side Metrics Middleware for Load Testing ──────────────────────────
// Add this middleware to your NestJS app during load tests to collect
// real-time server-side metrics (CPU, memory, DB pool, Redis, request latency)
//
// Usage in main.ts:
//   import { MetricsMiddleware, MetricsController } from './load-tests/monitoring/metrics-middleware';
//   app.use(MetricsMiddleware);
//   // Register MetricsController in a module or mount manually

import { Injectable, NestMiddleware, Controller, Get } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as os from 'os';

// ─── In-memory metrics store ─────────────────────────────────────────────────

interface EndpointMetrics {
    count: number;
    totalLatency: number;
    maxLatency: number;
    errors: number;
    latencies: number[]; // Last N latencies for percentile calc
}

class MetricsStore {
    private static instance: MetricsStore;
    private endpoints: Map<string, EndpointMetrics> = new Map();
    private startTime = Date.now();
    private totalRequests = 0;
    private totalErrors = 0;
    private activeConnections = 0;
    private wsConnections = 0;
    private readonly MAX_LATENCIES = 1000; // Keep last 1000 per endpoint

    static getInstance(): MetricsStore {
        if (!MetricsStore.instance) {
            MetricsStore.instance = new MetricsStore();
        }
        return MetricsStore.instance;
    }

    recordRequest(method: string, path: string, statusCode: number, latencyMs: number) {
        this.totalRequests++;
        if (statusCode >= 400) this.totalErrors++;

        const key = `${method} ${this.normalizePath(path)}`;
        let metrics = this.endpoints.get(key);
        if (!metrics) {
            metrics = { count: 0, totalLatency: 0, maxLatency: 0, errors: 0, latencies: [] };
            this.endpoints.set(key, metrics);
        }

        metrics.count++;
        metrics.totalLatency += latencyMs;
        metrics.maxLatency = Math.max(metrics.maxLatency, latencyMs);
        if (statusCode >= 400) metrics.errors++;

        metrics.latencies.push(latencyMs);
        if (metrics.latencies.length > this.MAX_LATENCIES) {
            metrics.latencies.shift();
        }
    }

    incrementActiveConnections() { this.activeConnections++; }
    decrementActiveConnections() { this.activeConnections--; }
    setWsConnections(count: number) { this.wsConnections = count; }

    getSnapshot() {
        const uptimeSeconds = (Date.now() - this.startTime) / 1000;
        const cpus = os.cpus();
        const cpuUsage = cpus.map(cpu => {
            const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
            const idle = cpu.times.idle;
            return ((total - idle) / total * 100);
        });
        const avgCpuUsage = cpuUsage.reduce((a, b) => a + b, 0) / cpuUsage.length;

        const memUsage = process.memoryUsage();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();

        // Build endpoint breakdown
        const endpointBreakdown: any[] = [];
        for (const [key, metrics] of this.endpoints) {
            const sorted = [...metrics.latencies].sort((a, b) => a - b);
            endpointBreakdown.push({
                endpoint: key,
                requests: metrics.count,
                avgLatencyMs: Math.round(metrics.totalLatency / metrics.count),
                p50LatencyMs: percentile(sorted, 50),
                p95LatencyMs: percentile(sorted, 95),
                p99LatencyMs: percentile(sorted, 99),
                maxLatencyMs: Math.round(metrics.maxLatency),
                errorCount: metrics.errors,
                errorRate: `${(metrics.errors / metrics.count * 100).toFixed(2)}%`,
            });
        }

        // Sort by P95 descending
        endpointBreakdown.sort((a, b) => b.p95LatencyMs - a.p95LatencyMs);

        return {
            timestamp: new Date().toISOString(),
            uptime: `${Math.floor(uptimeSeconds)}s`,

            // System
            system: {
                cpuUsagePercent: Math.round(avgCpuUsage * 100) / 100,
                cpuCores: cpus.length,
                totalMemoryMB: Math.round(totalMem / 1024 / 1024),
                freeMemoryMB: Math.round(freeMem / 1024 / 1024),
                usedMemoryPercent: Math.round((1 - freeMem / totalMem) * 10000) / 100,
            },

            // Process
            process: {
                heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
                heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
                rssMB: Math.round(memUsage.rss / 1024 / 1024),
                externalMB: Math.round(memUsage.external / 1024 / 1024),
            },

            // Request stats
            requests: {
                total: this.totalRequests,
                errors: this.totalErrors,
                errorRate: `${(this.totalErrors / Math.max(this.totalRequests, 1) * 100).toFixed(2)}%`,
                requestsPerSecond: Math.round(this.totalRequests / uptimeSeconds * 100) / 100,
                activeConnections: this.activeConnections,
                wsConnections: this.wsConnections,
            },

            // Endpoint breakdown
            slowestEndpoints: endpointBreakdown.slice(0, 15),
            allEndpoints: endpointBreakdown,
        };
    }

    reset() {
        this.endpoints.clear();
        this.totalRequests = 0;
        this.totalErrors = 0;
        this.startTime = Date.now();
    }

    private normalizePath(path: string): string {
        // Replace UUIDs with :id
        return path
            .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
            .replace(/\/\d+/g, '/:num')
            .split('?')[0]; // Remove query params
    }
}

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return Math.round(sorted[Math.max(0, index)]);
}

// ─── Express Middleware ──────────────────────────────────────────────────────

export function MetricsMiddleware(req: Request, res: Response, next: NextFunction) {
    // Skip metrics endpoint itself
    if (req.path === '/_metrics' || req.path === '/_metrics/reset') {
        return next();
    }

    const store = MetricsStore.getInstance();
    store.incrementActiveConnections();
    const start = process.hrtime.bigint();

    const originalEnd = res.end;
    res.end = function (...args: any[]) {
        const elapsed = Number(process.hrtime.bigint() - start) / 1_000_000; // ms
        store.recordRequest(req.method, req.path, res.statusCode, elapsed);
        store.decrementActiveConnections();
        return originalEnd.apply(this, args);
    } as any;

    next();
}

// ─── Metrics Controller (NestJS) ─────────────────────────────────────────────

@Controller('_metrics')
export class MetricsController {
    @Get()
    getMetrics() {
        return MetricsStore.getInstance().getSnapshot();
    }

    @Get('reset')
    resetMetrics() {
        MetricsStore.getInstance().reset();
        return { message: 'Metrics reset', timestamp: new Date().toISOString() };
    }

    @Get('health')
    health() {
        const mem = process.memoryUsage();
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
            uptimeSeconds: Math.round(process.uptime()),
        };
    }
}

// ─── Export store for WebSocket tracking ──────────────────────────────────────

export const metricsStore = MetricsStore.getInstance();
