import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export type AppReviewPromptSelect = typeof appReviewPrompt.$inferSelect;
export type AppReviewPromptInsert = typeof appReviewPrompt.$inferInsert;

export const appReviewPrompt = sqliteTable(
    'app_review_prompt',
    {
        id: text('id', { length: 21 }).primaryKey(),
        userId: text('user_id', { length: 21 }).notNull(),
        promptKey: text('prompt_key').notNull().default('post_workout_review'),
        cycleIndex: integer('cycle_index').notNull().default(0),
        status: text('status', {
            enum: ['deferred', 'shown', 'submitted', 'dismissed'],
        }).notNull(),
        triggerWorkoutId: text('trigger_workout_id', { length: 21 }),
        shownWorkoutId: text('shown_workout_id', { length: 21 }),
        eligibleWorkoutCount: integer('eligible_workout_count').notNull().default(0),
        completionSource: text('completion_source', { enum: ['phone', 'watch'] }),
        response: text('response', { enum: ['bad', 'not_bad', 'good'] }),
        storeReviewAvailable: integer('store_review_available', { mode: 'boolean' }),
        storeReviewHasAction: integer('store_review_has_action', { mode: 'boolean' }),
        storeReviewRequestedAt: integer('store_review_requested_at', { mode: 'timestamp_ms' }),
        shownAt: integer('shown_at', { mode: 'timestamp_ms' }),
        submittedAt: integer('submitted_at', { mode: 'timestamp_ms' }),
        dismissedAt: integer('dismissed_at', { mode: 'timestamp_ms' }),
        createdAt: integer('created_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`),
        updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`)
            .$onUpdate(() => new Date()),
    },
    (table) => [
        uniqueIndex('app_review_prompt_user_cycle_idx').on(
            table.userId,
            table.promptKey,
            table.cycleIndex,
        ),
        index('app_review_prompt_user_status_idx').on(table.userId, table.status),
        index('app_review_prompt_user_updated_at_idx').on(table.userId, table.updatedAt),
    ],
);
