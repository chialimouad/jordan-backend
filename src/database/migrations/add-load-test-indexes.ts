import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLoadTestIndexes1710100000000 implements MigrationInterface {
    name = 'AddLoadTestIndexes1710100000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ─── MATCHES: Composite indexes for OR queries in getMatches() ─────
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_matches_user1_status" ON "matches" ("user1Id", "status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_matches_user2_status" ON "matches" ("user2Id", "status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_matches_matched_at" ON "matches" ("matchedAt" DESC) WHERE "status" = 'active'`);

        // ─── CONVERSATIONS: Indexes for getConversations() & getTotalUnreadCount() ─
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_conversations_user1_active" ON "conversations" ("user1Id", "isActive")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_conversations_user2_active" ON "conversations" ("user2Id", "isActive")`);

        // ─── NOTIFICATIONS: Index for paginated notification queries ──────
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_notifications_user_read_created" ON "notifications" ("userId", "isRead", "createdAt" DESC)`);

        // ─── LIKES: Index for mutual match check (swipe → check reverse like) ─
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_likes_liked_liker_islike" ON "likes" ("likedId", "likerId", "isLike")`);

        // ─── PROFILES: Indexes for suggestions & search queries ───────────
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_profiles_complete_gender" ON "profiles" ("isComplete", "gender") WHERE "isComplete" = true`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_profiles_activity_score" ON "profiles" ("activityScore" DESC, "createdAt" DESC)`);

        // ─── PHOTOS: Index for batch main photo lookups ───────────────────
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_photos_user_main" ON "photos" ("userId", "isMain") WHERE "isMain" = true`);

        // ─── BLOCKED USERS: Indexes for exclude-ID lookups ────────────────
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_blocked_blocker" ON "blocked_users" ("blockerId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_blocked_blocked" ON "blocked_users" ("blockedId")`);

        // ─── MESSAGES: Index for status updates (markAsDelivered/Read) ────
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_messages_conv_sender_status" ON "messages" ("conversationId", "senderId", "status")`);

        // ─── SUBSCRIPTIONS: Index for premium user check ──────────────────
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_subscriptions_user_status" ON "subscriptions" ("userId", "status")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_matches_user1_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_matches_user2_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_matches_matched_at"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_conversations_user1_active"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_conversations_user2_active"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_user_read_created"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_likes_liked_liker_islike"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_profiles_complete_gender"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_profiles_activity_score"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_photos_user_main"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_blocked_blocker"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_blocked_blocked"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_messages_conv_sender_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_subscriptions_user_status"`);
    }
}
