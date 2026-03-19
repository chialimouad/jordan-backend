# Wafaa Backend — Bottleneck Analysis & Optimization Report

> **Based on static codebase analysis of all controllers, services, entities, and infrastructure config.**  
> Target: 10,000 concurrent users with realistic behavior simulation.

---

## 1. Executive Summary

The Wafaa backend is a well-structured NestJS monolith with PostgreSQL, Redis (ioredis), and Socket.IO (with Redis adapter). The codebase has good foundations — JWT auth with token rotation, rate limiting, Redis caching for suggestions/search, and indexed entities. However, **several critical bottlenecks** will prevent scaling to 10,000+ users without optimization.

**Estimated current capacity: ~1,000–2,000 concurrent users before degradation.**

---

## 2. Critical Bottlenecks Found

### 🔴 CRITICAL — N+1 Query Problem in `MatchesService`

**Files:** `src/modules/matches/matches.service.ts` lines 51-71, 119-138, 173-188  
**Impact:** Exponential DB load under scale

The `getMatches()`, `getNearbyUsers()`, `getNewUsers()`, and `getSuggestions()` methods all fetch photos **individually per user** inside a `Promise.all(map(...))`:

```typescript
// matches.service.ts:55-57 — CALLED PER MATCH
const photo = await this.photoRepository.findOne({
    where: { userId: otherUserId, isMain: true },
});
```

With 20 suggestions × 5,000 users browsing = **100,000 individual photo queries** hitting the DB simultaneously.

**Fix:**
```typescript
// Batch fetch all photos in one query (like search.service.ts already does!)
const userIds = results.entities.map(p => p.userId);
const photos = await this.photoRepository
    .createQueryBuilder('photo')
    .where('photo.userId IN (:...userIds)', { userIds })
    .andWhere('photo.isMain = :isMain', { isMain: true })
    .getMany();
const photoMap = new Map(photos.map(p => [p.userId, p.url]));
```

> ✅ Note: `SearchService.search()` already does batch photo fetching correctly (lines 151-160). The fix is to replicate that pattern in `MatchesService`.

---

### 🔴 CRITICAL — `getExcludeIds()` Makes 3 Separate DB Queries

**File:** `src/modules/matches/matches.service.ts` lines 281-301  
**Impact:** Called on EVERY suggestion/nearby/discovery request

```typescript
private async getExcludeIds(userId: string): Promise<string[]> {
    const blockedUsers = await this.blockedUserRepository.find(...);  // Query 1
    const swipedLikes = await this.likeRepository.find(...);          // Query 2
    const matches = await this.matchRepository.find(...);             // Query 3
    // ...
}
```

This runs **3 sequential DB queries** for every browsing request. With 4,000 browsing users (40%), that's **12,000 queries** per iteration.

**Fix:**
```typescript
// Combine into a single query using UNION or Promise.all
const [blockedUsers, swipedLikes, matches] = await Promise.all([
    this.blockedUserRepository.find(...),
    this.likeRepository.find({ where: { likerId: userId }, select: ['likedId'] }),
    this.matchRepository.find(...),
]);
```

Even better — cache the exclude list in Redis for 60 seconds:
```typescript
const cacheKey = `excludeIds:${userId}`;
const cached = await this.redisService.getJson<string[]>(cacheKey);
if (cached) return cached;
// ... compute ...
await this.redisService.setJson(cacheKey, excludeIds, 60);
```

---

### 🔴 CRITICAL — `getDiscoveryCategories()` Triggers 3× Full Pipelines

**File:** `src/modules/matches/matches.service.ts` lines 145-157  
**Impact:** Extreme DB load multiplier

```typescript
async getDiscoveryCategories(userId: string) {
    const [nearby, compatible, newUsers] = await Promise.all([
        this.getNearbyUsers(userId, 30, 10),    // getExcludeIds + geo query + N+1 photos
        this.getSuggestions(userId, 10),          // getExcludeIds + filter query + N+1 photos
        this.getNewUsers(userId, 10),             // getExcludeIds + date query + N+1 photos
    ]);
}
```

Each sub-call independently runs `getExcludeIds()` (3 queries) + main query + N photo queries.  
**Total per request: ~9 DB queries (exclude IDs) + 3 main queries + up to 30 photo queries = ~42 queries per single `/matches/discover` call.**

**Fix:**
1. Compute `excludeIds` once and pass it to all three functions.
2. Cache the entire discovery response in Redis for 5 minutes.
3. Batch all photo fetches.

---

### 🔴 CRITICAL — `getTotalUnreadCount()` Fetches ALL Conversations

**File:** `src/modules/chat/chat.service.ts` lines 182-194  
**Impact:** Full table scan for every heartbeat

```typescript
async getTotalUnreadCount(userId: string): Promise<number> {
    const conversations = await this.conversationRepository.find({
        where: [
            { user1Id: userId, isActive: true },
            { user2Id: userId, isActive: true },
        ],
    });
    return conversations.reduce((total, conv) => { ... }, 0);
}
```

This fetches **ALL conversations** from the DB, loads them into memory, then sums in JS. With idle users polling every 10-15s, this is a constant DB drain.

**Fix:**
```typescript
// Use SQL SUM instead of loading all rows
const result = await this.conversationRepository
    .createQueryBuilder('c')
    .select('SUM(CASE WHEN c.user1Id = :userId THEN c.user1UnreadCount ELSE c.user2UnreadCount END)', 'total')
    .where('(c.user1Id = :userId OR c.user2Id = :userId)')
    .andWhere('c.isActive = true')
    .setParameter('userId', userId)
    .getRawOne();
return parseInt(result?.total || '0', 10);
```

Or cache it in Redis (updated on message send/read).

---

### 🟡 WARNING — Haversine Distance in SQL Without Spatial Index

**Files:** `matches.service.ts` lines 100-115, 236-240; `search.service.ts` lines 131-134  
**Impact:** Full table scan for geo queries

The Haversine formula is computed in raw SQL for every row:
```sql
6371 * acos(cos(radians(:lat)) * cos(radians(profile.latitude)) * ...
```

Without a spatial index, PostgreSQL must compute this for **every profile** in the table, then filter by distance. With 100K+ profiles, this becomes a bottleneck.

**Fix:**
1. Add a `geography` column using PostGIS:
```sql
ALTER TABLE profiles ADD COLUMN location geography(Point, 4326);
CREATE INDEX idx_profiles_location ON profiles USING GIST(location);
-- Query: ST_DWithin(location, ST_MakePoint(:lng, :lat)::geography, :radiusMeters)
```

2. Or at minimum, add a **bounding box pre-filter** before Haversine:
```sql
WHERE profile.latitude BETWEEN :lat - :delta AND :lat + :delta
AND profile.longitude BETWEEN :lng - :delta AND :lng + :delta
```

---

### 🟡 WARNING — bcrypt on Every Login (CPU-Bound)

**File:** `src/modules/auth/auth.service.ts` lines 63, 286, 434, 472, 590-591  
**Impact:** CPU saturation under high auth load

bcrypt with salt rounds 10-12 takes ~100-250ms per hash. With 1,000 concurrent logins (10% of 10k), that's **100-250 seconds of CPU time** per cycle.

Additionally, `updateRefreshToken()` hashes the refresh token on every login AND every token refresh:
```typescript
private async updateRefreshToken(...) {
    const salt = await bcrypt.genSalt(10);
    const hashedRefreshToken = await bcrypt.hash(refreshToken, salt);  // ~100ms
}
```

**Fix:**
1. Reduce bcrypt rounds to 10 (from 12 for registration) — this halves hash time.
2. Cache validated sessions in Redis to avoid bcrypt comparison on every request.
3. Consider Argon2id which is more parallelizable.
4. For refresh token storage, use SHA-256 instead of bcrypt (refresh tokens are already high-entropy random strings).

---

### 🟡 WARNING — No Database Connection Pool Tuning for Scale

**File:** `src/database/database.module.ts` lines 45-51

```typescript
extra: {
    max: isProduction ? 50 : 10,     // Max pool connections
    min: isProduction ? 5 : 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000,
}
```

At 50 max connections with 10,000 users, each connection serves ~200 users. Under heavy DB load (N+1 queries, complex search), pool exhaustion is almost guaranteed.

**Fix:**
- Increase `max` to 100-150 for 10k users (depends on Postgres max_connections).
- Use PgBouncer as a connection pooler in front of PostgreSQL.
- Reduce `connectionTimeoutMillis` to 5000 and add queue management.

---

### 🟡 WARNING — Redis Single-Point Without Pipeline/Batch

**File:** `src/modules/redis/redis.service.ts`  
**Impact:** High RTT for multiple Redis operations

`isUserOnline()` is called per-match in `getMatches()` enrichment (line 58 of matches.service.ts), resulting in N individual Redis calls.

**Fix:**
Add batch online check:
```typescript
async areUsersOnline(userIds: string[]): Promise<Map<string, boolean>> {
    if (!this.isConnected || userIds.length === 0) return new Map();
    const pipeline = this.client.pipeline();
    for (const id of userIds) {
        pipeline.sismember('online_users', id);
    }
    const results = await pipeline.exec();
    const map = new Map<string, boolean>();
    userIds.forEach((id, i) => map.set(id, results?.[i]?.[1] === 1));
    return map;
}
```

---

### 🟡 WARNING — `interests` Stored as `simple-array` (Comma-Separated Text)

**File:** `src/database/entities/profile.entity.ts` line 262  
**Impact:** LIKE queries for interest filtering are non-indexable

```typescript
@Column({ type: 'simple-array', nullable: true })
interests: string[];
```

This stores as `"reading,hiking,cooking"` — a comma-separated string. The search filter uses:
```sql
profile.interests LIKE '%reading%'
```

This is a full table scan for every interest filter.

**Fix:**
- Use `jsonb` column type with GIN index:
```sql
ALTER TABLE profiles ALTER COLUMN interests TYPE jsonb USING to_jsonb(string_to_array(interests, ','));
CREATE INDEX idx_profiles_interests ON profiles USING GIN(interests);
-- Query: interests @> '["reading"]'::jsonb
```

---

### 🟡 WARNING — WebSocket Gateway Has No Message Queue

**File:** `src/modules/chat/chat.gateway.ts`  
**Impact:** Message loss under high throughput

The `sendMessage` handler directly saves to DB and emits. If the DB write fails or is slow, the message is lost:
```typescript
const message = await this.chatService.sendMessage(userId, conversationId, content);
this.server.to(conversationId).emit('newMessage', message);
```

**Fix:**
- Add a message queue (Redis list or Bull queue) as a buffer.
- Acknowledge receipt to sender immediately, process write asynchronously.
- Add retry logic for failed DB writes.

---

### 🟢 GOOD — Already Implemented Well

| Feature | Location | Notes |
|---------|----------|-------|
| JWT token rotation & family tracking | `auth.service.ts` | Excellent security pattern |
| Redis rate limiting with in-memory fallback | `redis.service.ts` | Graceful degradation |
| Batch photo fetch in search | `search.service.ts:151-160` | Avoids N+1 for search |
| Redis caching for suggestions | `matches.service.ts:194-196` | 10min TTL |
| Redis caching for search results | `search.service.ts:24-26` | 5min TTL |
| Socket.IO Redis adapter | `chat.gateway.ts` | Horizontal scaling ready |
| Indexed entity columns | Entity files | Good use of `@Index()` |
| Connection pool config | `database.module.ts` | Present but needs tuning |
| Throttler module | `app.module.ts:40-43` | Global rate limiting |
| Audit logging via Redis | `redis.service.ts:265-282` | Capped lists |

---

## 3. Missing Database Indexes

Based on query patterns in services, these indexes are missing:

```sql
-- For getMatches() OR queries
CREATE INDEX idx_matches_user1_status ON matches (user1_id, status);
CREATE INDEX idx_matches_user2_status ON matches (user2_id, status);

-- For conversations OR queries (getConversations, getTotalUnreadCount)
CREATE INDEX idx_conversations_user1_active ON conversations (user1_id, is_active);
CREATE INDEX idx_conversations_user2_active ON conversations (user2_id, is_active);

-- For messages pagination
CREATE INDEX idx_messages_conv_created ON messages (conversation_id, created_at DESC);

-- For notifications pagination
CREATE INDEX idx_notifications_user_read ON notifications (user_id, is_read, created_at DESC);

-- For likes mutual check (swipe matching)
CREATE INDEX idx_likes_liked_liker ON likes (liked_id, liker_id, is_like);

-- For profile search/suggestions
CREATE INDEX idx_profiles_complete_gender ON profiles (is_complete, gender) WHERE is_complete = true;
CREATE INDEX idx_profiles_activity ON profiles (activity_score DESC, created_at DESC);

-- For photo lookups
CREATE INDEX idx_photos_user_main ON photos (user_id, is_main) WHERE is_main = true;
```

---

## 4. Optimization Priorities (by Impact)

| Priority | Issue | Impact | Effort | Est. Improvement |
|----------|-------|--------|--------|------------------|
| **P0** | Fix N+1 photo queries in MatchesService | 🔴 Critical | Low | 10-50× fewer DB queries |
| **P0** | Parallelize `getExcludeIds()` + cache result | 🔴 Critical | Low | 3× fewer queries per browse |
| **P0** | SQL SUM for `getTotalUnreadCount()` | 🔴 Critical | Low | 100× less data transferred |
| **P0** | Cache `getDiscoveryCategories()` in Redis | 🔴 Critical | Low | 40+ queries → 1 Redis read |
| **P1** | Add missing composite indexes | 🟡 High | Medium | 2-10× faster queries |
| **P1** | Add bounding box pre-filter for geo queries | 🟡 High | Medium | 5-20× faster nearby |
| **P1** | Redis pipeline for batch online checks | 🟡 Medium | Low | N RTTs → 1 RTT |
| **P1** | Increase DB pool to 100+ | 🟡 Medium | Low | Prevents pool exhaustion |
| **P2** | Convert interests to JSONB + GIN index | 🟡 Medium | Medium | Index-backed filtering |
| **P2** | SHA-256 for refresh token storage | 🟡 Medium | Low | 50× faster token refresh |
| **P2** | Add PostGIS for spatial queries | 🟡 Medium | High | True geo-indexing |
| **P3** | Message queue for chat writes | 🟢 Low | High | Reliability + throughput |
| **P3** | PgBouncer connection pooling | 🟢 Low | Medium | Better pool management |

---

## 5. Scalability Architecture Recommendations

### For 10,000+ Users:
1. **Fix all P0 issues** — these alone should bring capacity from ~2k to ~5-8k users.
2. **Add composite indexes** — reduces query time for most endpoints by 2-10×.
3. **Increase DB pool + add PgBouncer** — prevents connection starvation.
4. **Add Redis pipeline batching** — reduces Redis RTT by N× for list operations.

### For 50,000+ Users:
1. **Horizontal scaling** — run 3-5 NestJS instances behind a load balancer.
2. **Read replicas** — route read-heavy queries (search, suggestions, matches) to read replicas.
3. **PostGIS** — replace Haversine SQL with proper spatial indexing.
4. **Message queue** (BullMQ/Redis Streams) — decouple chat writes from real-time delivery.
5. **CDN for photos** — Cloudinary already used, ensure URL caching.

### For 100,000+ Users:
1. **Microservice extraction** — chat, notifications, and matching as separate services.
2. **Elasticsearch** — for profile search (replace LIKE queries).
3. **Redis Cluster** — for cache distribution.
4. **Database sharding** — partition messages by conversation.

---

## 6. Pre-Load Test Scoring (Static Analysis)

| Category | Score | Notes |
|----------|-------|-------|
| Code Quality | 85/100 | Clean, well-organized NestJS modules |
| Security | 90/100 | Token rotation, rate limiting, bcrypt, OTP |
| Caching Strategy | 60/100 | Present but inconsistent (search cached, matches N+1) |
| Database Design | 70/100 | Good indexes on PKs/FKs, missing composite indexes |
| Query Efficiency | 40/100 | N+1 problems, full table scans, no spatial index |
| WebSocket Design | 75/100 | Redis adapter good, needs message queue |
| Connection Pooling | 55/100 | Present but pool too small for 10k |
| Horizontal Scaling | 70/100 | Redis adapter enables WS scaling, stateless JWT |

**Overall Static Score: 68/100 — NEEDS OPTIMIZATION**

**Verdict: The backend is well-architected but has critical N+1 query patterns and missing indexes that will cause severe degradation above ~2,000 concurrent users. With P0 fixes applied, it should handle 5,000-8,000 users. Full optimization is needed for 10,000+.**

---

## 7. Quick Wins (< 1 Hour Each)

1. **Batch photo fetch in MatchesService** — copy pattern from SearchService (~15 min)
2. **`Promise.all` in `getExcludeIds()`** — 1-line change (~5 min)
3. **Cache `getDiscoveryCategories()` in Redis** — wrap existing code (~15 min)
4. **SQL SUM for unread count** — replace JS reduce with query (~10 min)
5. **Add composite indexes** — migration file (~20 min)
6. **Increase DB pool to 100** — config change (~2 min)
