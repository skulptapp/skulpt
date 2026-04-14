import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export type MeasurementSelect = typeof measurement.$inferSelect;
export type MeasurementInsert = typeof measurement.$inferInsert;

export const measurement = sqliteTable(
    'measurement',
    {
        id: text('id', { length: 21 }).primaryKey(),
        userId: text('user_id', { length: 21 }).notNull(),
        metric: text('metric').notNull(),
        value: real('value').notNull(),
        unit: text('unit').notNull(),
        recordedAt: integer('recorded_at', { mode: 'timestamp_ms' }).notNull(),
        source: text('source', { enum: ['manual', 'health'] })
            .notNull()
            .default('manual'),
        sourcePlatform: text('source_platform', {
            enum: ['ios_healthkit', 'android_health_connect'],
        }),
        externalId: text('external_id'),
        createdAt: integer('created_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`),
        updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`)
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index('measurement_user_metric_recorded_idx').on(
            table.userId,
            table.metric,
            table.recordedAt,
        ),
        index('measurement_user_recorded_idx').on(table.userId, table.recordedAt),
        uniqueIndex('measurement_user_source_metric_external_idx').on(
            table.userId,
            table.source,
            table.metric,
            table.externalId,
        ),
    ],
);
