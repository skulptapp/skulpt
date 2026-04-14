import { CreateDataSync, UpdateDataSync } from '@/db/schema/sync';
import { reportError } from '@/services/error-reporting';

import { queueSyncOperation } from '../sync';

export interface BaseRecord {
    id: string;
    updatedAt: Date;
}

/**
 * Generic wrapper for database operations that automatically handles sync operations
 */
export async function withSync<T extends BaseRecord>(
    tableName: string,
    operation: 'create' | 'update' | 'delete',
    dbOperation: () => Promise<T[]>,
    recordId?: string,
    fallbackData?: CreateDataSync | UpdateDataSync,
): Promise<T> {
    try {
        const result = await dbOperation();

        if (result.length === 0) {
            throw new Error(`Failed to execute ${operation} operation`);
        }

        const record = result[0];

        await queueSyncOperation({
            tableName,
            recordId: recordId || record.id,
            operation,
            timestamp: record.updatedAt,
            data:
                operation === 'delete'
                    ? fallbackData
                    : (record as unknown as CreateDataSync | UpdateDataSync),
        });

        return record;
    } catch (error) {
        reportError(error, `Failed to ${operation} ${tableName} with sync:`);
        throw new Error(
            `${operation} operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
    }
}

/**
 * Helper for handling delete operations where we need to preserve data before deletion
 */
export async function withSyncDelete<T extends BaseRecord>(
    tableName: string,
    recordToDelete: T,
    dbOperation: () => Promise<void>,
): Promise<void> {
    try {
        await dbOperation();

        await queueSyncOperation({
            tableName,
            recordId: recordToDelete.id,
            operation: 'delete',
            timestamp: new Date(),
            data: recordToDelete as unknown as CreateDataSync | UpdateDataSync,
        });
    } catch (error) {
        reportError(error, `Failed to delete ${tableName} with sync:`);
        throw new Error(
            `Delete operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
    }
}

/**
 * Generic error handler for CRUD operations
 */
export function handleCrudError(operation: string, entityType: string, error: unknown): never {
    reportError(error, `Failed to ${operation} ${entityType}:`);
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to ${operation} ${entityType}: ${message}`);
}
