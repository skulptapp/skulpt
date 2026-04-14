import { and, eq, gt, ne } from 'drizzle-orm';

import { db } from '@/db';
import {
    exercise,
    exerciseSet,
    measurement,
    syncQueue,
    user,
    workout,
    workoutExercise,
    workoutGroup,
} from '@/db/schema';
import { SKULPT_EXERCISES_USER_ID } from '@/constants/skulpt';
import { queueSyncOperations, getLastSyncTimestamp } from '@/crud/sync';

let backfillDone = false;

/**
 * Populates the sync queue with records that were created or modified
 * while sync was disabled. Queues records where updatedAt > lastSyncTimestamp,
 * skipping records that already have a pending entry in the sync queue.
 *
 * Runs once per app session — after the first call, subsequent calls are no-ops.
 *
 * Handles both scenarios:
 * - First-time sync enable (lastSyncTimestamp = epoch 0 → all records qualify)
 * - Re-enable after a gap (only records changed during the gap qualify)
 */
export const backfillSyncQueue = async (): Promise<void> => {
    if (backfillDone) return;

    const lastSync = await getLastSyncTimestamp();

    // Only check pending (synced=0) entries — completed entries (synced=1) that
    // weren't cleaned up before sync was disabled should not block re-queuing.
    const existingEntries = await db
        .select({ tableName: syncQueue.tableName, recordId: syncQueue.recordId })
        .from(syncQueue)
        .where(eq(syncQueue.synced, 0));

    const alreadyQueued = new Set(existingEntries.map((e) => `${e.tableName}:${e.recordId}`));

    const tables: { name: string; table: any; updatedAtCol: any }[] = [
        { name: 'user', table: user, updatedAtCol: user.updatedAt },
        { name: 'workout', table: workout, updatedAtCol: workout.updatedAt },
        { name: 'workout_group', table: workoutGroup, updatedAtCol: workoutGroup.updatedAt },
        {
            name: 'workout_exercise',
            table: workoutExercise,
            updatedAtCol: workoutExercise.updatedAt,
        },
        { name: 'exercise_set', table: exerciseSet, updatedAtCol: exerciseSet.updatedAt },
        { name: 'measurement', table: measurement, updatedAtCol: measurement.updatedAt },
    ];

    for (const { name, table, updatedAtCol } of tables) {
        const rows = await db.select().from(table).where(gt(updatedAtCol, lastSync));
        if (rows.length === 0) continue;

        const toQueue = rows.filter((row: any) => !alreadyQueued.has(`${name}:${row.id}`));
        if (toQueue.length === 0) continue;

        await queueSyncOperations(
            toQueue.map((row: any) => ({
                tableName: name,
                recordId: row.id as string,
                operation: (row.createdAt > lastSync ? 'create' : 'update') as 'create' | 'update',
                timestamp: row.updatedAt as Date,
                data: row,
            })),
        );
    }

    // Exercises: only queue user-created exercises, not skulpt library exercises
    const userExercises = await db
        .select()
        .from(exercise)
        .where(
            and(gt(exercise.updatedAt, lastSync), ne(exercise.userId, SKULPT_EXERCISES_USER_ID)),
        );

    const exercisesToQueue = userExercises.filter(
        (row) => !alreadyQueued.has(`exercise:${row.id}`),
    );

    if (exercisesToQueue.length > 0) {
        await queueSyncOperations(
            exercisesToQueue.map((row) => ({
                tableName: 'exercise',
                recordId: row.id,
                operation: (row.createdAt > lastSync ? 'create' : 'update') as 'create' | 'update',
                timestamp: row.updatedAt,
                data: row as unknown as Record<string, unknown>,
            })),
        );
    }

    backfillDone = true;
};
