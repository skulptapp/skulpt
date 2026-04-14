import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export type SyncQueueSelect = typeof syncQueue.$inferSelect;
export type SyncQueueInsert = typeof syncQueue.$inferInsert;
export type SkulptSyncMetadataSelect = typeof skulptSyncMetadata.$inferSelect;
export type SkulptSyncMetadataInsert = typeof skulptSyncMetadata.$inferInsert;

// Use generic, table-agnostic payloads for sync queue
export type CreateDataSync = Record<string, unknown>;
export type UpdateDataSync = Record<string, unknown>;

export const syncQueue = sqliteTable('sync_queue', {
    id: text('id', { length: 21 }).primaryKey(),
    tableName: text('table_name').notNull(),
    recordId: text('record_id', { length: 21 }).notNull(),
    operation: text('operation', { enum: ['create', 'update', 'delete'] }).notNull(),
    data: text('data', { mode: 'json' }).$type<CreateDataSync | UpdateDataSync>(),
    timestamp: integer('timestamp', { mode: 'timestamp_ms' }).notNull(),
    synced: integer('synced').notNull().default(0),
});

export const syncMetadata = sqliteTable('sync_metadata', {
    id: text('id', { length: 21 }).primaryKey(),
    lastSyncTimestamp: integer('last_sync_timestamp', { mode: 'timestamp_ms' }).notNull(),
});

export const skulptSyncMetadata = sqliteTable('skulpt_sync_metadata', {
    locale: text('locale', { length: 16 }).primaryKey(),
    lastSyncTimestamp: integer('last_sync_timestamp', { mode: 'timestamp_ms' }).notNull(),
});
