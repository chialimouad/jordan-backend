import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMatchNotificationColumns1720000000000 implements MigrationInterface {
    name = 'AddMatchNotificationColumns1720000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "matches"
            ADD COLUMN IF NOT EXISTS "user1NotifiedAt" TIMESTAMP NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "matches"
            ADD COLUMN IF NOT EXISTS "user2NotifiedAt" TIMESTAMP NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "matches"
            DROP COLUMN IF EXISTS "user2NotifiedAt"
        `);

        await queryRunner.query(`
            ALTER TABLE "matches"
            DROP COLUMN IF EXISTS "user1NotifiedAt"
        `);
    }
}
