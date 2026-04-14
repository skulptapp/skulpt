import { eq } from 'drizzle-orm';
import * as Sentry from '@sentry/react-native';
import { getServerChanges, sendChangesToServer, SyncBatchRequest } from '@/api';
import { sanitizeMuscleGroupSelections } from '@/constants/muscles';
import { backfillSyncQueue } from './backfill';
import { isSyncEnabled } from './config';
import {
    getSkulptLastSyncTimestamp,
    getLastSyncTimestamp,
    getPendingSyncOperations,
    getPendingSyncOperationsCount,
    markSyncOperationAsDone,
    updateSkulptLastSyncTimestamp,
    updateLastSyncTimestamp,
    cleanupSyncedOperations,
} from '@/crud/sync';
import {
    CreateDataSync,
    SyncQueueSelect,
    UpdateDataSync,
    exercise,
    exerciseSet,
    user as userTable,
    workout,
    workoutExercise,
    workoutGroup,
    measurement,
} from '@/db/schema';
import { getCurrentUser } from '@/crud/user';
import { db } from '@/db';
import { normalizeSetType } from '@/helpers/set-type';
import { SKULPT_EXERCISES_USER_ID } from '@/constants/skulpt';

const TRANSIENT_SYNC_ERRORS = new Set(['NO_INTERNET', 'TIMEOUT']);

const summarizeBatchData = (batchData: SyncBatchRequest) =>
    Object.fromEntries(
        Object.entries(batchData).map(([tableName, changes]) => [
            tableName,
            {
                created: changes.created.length,
                updated: changes.updated.length,
                deleted: changes.deleted.length,
                sampleCreatedIds: changes.created
                    .slice(0, 2)
                    .map((record) => String((record as Record<string, unknown>).id ?? '')),
                sampleUpdatedIds: changes.updated
                    .slice(0, 2)
                    .map((record) => String((record as Record<string, unknown>).id ?? '')),
                sampleUpdatedKeys:
                    changes.updated.length > 0
                        ? Object.keys(changes.updated[0] as Record<string, unknown>).sort()
                        : [],
            },
        ]),
    );

const isTransientSyncError = (result: { error?: string }) =>
    typeof result.error === 'string' && TRANSIENT_SYNC_ERRORS.has(result.error);

const captureSyncFailure = (
    scopeName: string,
    details: Record<string, unknown>,
    error?: unknown,
) => {
    if (__DEV__) {
        console.error('[sync]', {
            scope: scopeName,
            details,
            error,
        });
        return;
    }

    Sentry.withScope((scope) => {
        scope.setTag('scope', 'sync');
        scope.setTag('sync_scope', scopeName);

        for (const [key, value] of Object.entries(details)) {
            scope.setExtra(key, value);
        }

        if (error) {
            scope.setExtra('errorValue', error);
            Sentry.captureException(error);
            return;
        }

        Sentry.captureException(new Error(`Sync failure: ${scopeName}`));
    });
};

type CompactedSyncOperation = {
    operation: 'create' | 'update' | 'delete';
    data: Record<string, unknown> | null;
};

const EXERCISE_SYNC_RECORD_FIELDS = [
    'id',
    'name',
    'category',
    'tracking',
    'weightUnits',
    'weightAssisted',
    'weightDoubleInStats',
    'distanceUnits',
    'distanceActivityType',
    'distanceTrackAW',
    'timeOptions',
    'timeHalfwayAlert',
    'source',
    'skulptSourceId',
    'primaryMuscleGroups',
    'secondaryMuscleGroups',
    'equipment',
    'mistakes',
    'instructions',
    'description',
    'difficulty',
    'gifFilename',
    'userId',
    'createdAt',
    'updatedAt',
    'serverCreatedAt',
    'serverUpdatedAt',
] as const;

const getOperationKey = (operation: SyncQueueSelect) =>
    `${operation.tableName}:${operation.recordId}`;

const mergeSyncData = (
    recordId: string,
    data: CreateDataSync | UpdateDataSync | undefined,
    existingData: Record<string, unknown> | null = null,
): Record<string, unknown> => ({
    ...(existingData ?? {}),
    ...((data as Record<string, unknown> | undefined) ?? {}),
    id: recordId,
});

const pickExerciseSyncRecordFields = (record: Record<string, unknown>): Record<string, unknown> => {
    const picked: Record<string, unknown> = {};

    for (const field of EXERCISE_SYNC_RECORD_FIELDS) {
        if (field in record) {
            picked[field] = record[field];
        }
    }

    return picked;
};

const readExerciseMuscleSelection = (
    record: Record<string, unknown>,
    pluralKey: 'primaryMuscleGroups' | 'secondaryMuscleGroups',
    singularKey: 'primaryMuscleGroup' | 'secondaryMuscleGroup',
): string[] | null | undefined => {
    if (pluralKey in record) {
        const value = record[pluralKey];

        if (value == null) {
            return null;
        }

        if (Array.isArray(value)) {
            return value.filter((item): item is string => typeof item === 'string');
        }
    }

    if (singularKey in record) {
        const value = record[singularKey];

        if (value == null) {
            return null;
        }

        if (typeof value === 'string') {
            return [value];
        }
    }

    return undefined;
};

export const normalizeOutgoingExerciseSyncRecord = (
    record: Record<string, unknown>,
): Record<string, unknown> => {
    const primary = readExerciseMuscleSelection(
        record,
        'primaryMuscleGroups',
        'primaryMuscleGroup',
    );
    const secondary = readExerciseMuscleSelection(
        record,
        'secondaryMuscleGroups',
        'secondaryMuscleGroup',
    );
    const normalized = { ...record };
    const { primary: normalizedPrimary, secondary: normalizedSecondary } =
        sanitizeMuscleGroupSelections({
            primary,
            secondary,
        });

    delete normalized.primaryMuscleGroup;
    delete normalized.secondaryMuscleGroup;

    if (primary !== undefined) {
        normalized.primaryMuscleGroups = normalizedPrimary;
    }

    if (secondary !== undefined) {
        normalized.secondaryMuscleGroups = normalizedSecondary;
    }

    if (typeof normalized.source !== 'string' || normalized.source.trim().length === 0) {
        normalized.source = 'user';
    }

    return normalized;
};

const normalizeOutgoingExerciseSetSyncRecord = (
    record: Record<string, unknown>,
): Record<string, unknown> => {
    const normalized = { ...record };
    if ('type' in normalized) {
        normalized.type = normalizeSetType(normalized.type);
    }
    return normalized;
};

export const normalizeIncomingExerciseSyncRecord = (
    record: Record<string, unknown>,
): Record<string, unknown> => {
    const primary = readExerciseMuscleSelection(
        record,
        'primaryMuscleGroups',
        'primaryMuscleGroup',
    );
    const secondary = readExerciseMuscleSelection(
        record,
        'secondaryMuscleGroups',
        'secondaryMuscleGroup',
    );
    const normalized = pickExerciseSyncRecordFields(record);
    const { primary: normalizedPrimary, secondary: normalizedSecondary } =
        sanitizeMuscleGroupSelections({
            primary,
            secondary,
        });

    normalized.primaryMuscleGroups = normalizedPrimary;
    normalized.secondaryMuscleGroups = normalizedSecondary;

    return normalized;
};

const normalizeIncomingExerciseSetSyncRecord = (
    record: Record<string, unknown>,
): Record<string, unknown> => {
    const normalized = { ...record };
    if ('type' in normalized) {
        normalized.type = normalizeSetType(normalized.type);
    }
    return normalized;
};

const normalizeSyncRecordForPush = (
    tableName: string,
    record: Record<string, unknown>,
): Record<string, unknown> => {
    if (tableName === 'exercise') {
        return normalizeOutgoingExerciseSyncRecord(record);
    }

    if (tableName === 'exercise_set') {
        return normalizeOutgoingExerciseSetSyncRecord(record);
    }

    return record;
};

const groupOperationsByTable = (operations: SyncQueueSelect[]) => {
    // Collapse repeated local mutations so each record is pushed once with its final state.
    const compacted = new Map<string, CompactedSyncOperation>();

    for (const operation of operations) {
        const key = getOperationKey(operation);
        const current = compacted.get(key);

        switch (operation.operation) {
            case 'create':
                if (current?.operation === 'delete') {
                    break;
                }

                compacted.set(key, {
                    operation: 'create',
                    data: mergeSyncData(
                        operation.recordId,
                        operation.data as CreateDataSync | undefined,
                        current?.operation === 'create' ? current.data : null,
                    ),
                });
                break;
            case 'update': {
                if (current?.operation === 'delete') {
                    break;
                }

                const nextOperation = current?.operation === 'create' ? 'create' : 'update';
                const existingData =
                    current?.operation === 'create' || current?.operation === 'update'
                        ? current.data
                        : null;

                compacted.set(key, {
                    operation: nextOperation,
                    data: mergeSyncData(
                        operation.recordId,
                        operation.data as UpdateDataSync | undefined,
                        existingData,
                    ),
                });
                break;
            }
            case 'delete':
                compacted.set(key, {
                    operation: 'delete',
                    data: null,
                });
                break;
        }
    }

    const grouped: SyncBatchRequest = {};

    for (const operation of operations) {
        const key = getOperationKey(operation);
        const compactedOperation = compacted.get(key);

        if (!compactedOperation) continue;

        const tableName = operation.tableName;

        if (!grouped[tableName]) {
            grouped[tableName] = {
                created: [],
                updated: [],
                deleted: [],
            };
        }

        if (compactedOperation.operation === 'create' && compactedOperation.data) {
            grouped[tableName].created.push(
                normalizeSyncRecordForPush(tableName, compactedOperation.data),
            );
        } else if (compactedOperation.operation === 'update' && compactedOperation.data) {
            grouped[tableName].updated.push(
                normalizeSyncRecordForPush(tableName, compactedOperation.data),
            );
        } else if (compactedOperation.operation === 'delete') {
            grouped[tableName].deleted.push(operation.recordId);
        }

        compacted.delete(key);
    }

    return grouped;
};

const parseServerDate = (value: unknown): Date => {
    if (value instanceof Date) return value;
    if (typeof value === 'number') return new Date(value);

    if (typeof value === 'string') {
        // Rust can return NaiveDateTime without timezone suffix; treat it as UTC.
        const hasTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(value);
        return new Date(hasTimezone ? value : `${value}Z`);
    }

    return new Date(value as Date);
};

type PushResult =
    | { success: true }
    | {
          success: false;
          conflictMissingRecord?: boolean;
          isRetryableNetworkFailure?: boolean;
          table?: string;
          id?: string;
      };

type PullResult =
    | { success: true }
    | {
          success: false;
          isRetryableNetworkFailure?: boolean;
      };

const resolveConflictMissingRecord = async (
    pendingOperations: SyncQueueSelect[],
    table?: string,
    id?: string,
) => {
    if (!table || !id) return;

    const staleUpdates = pendingOperations.filter(
        (operation) =>
            operation.tableName === table &&
            operation.recordId === id &&
            operation.operation === 'update',
    );

    for (const operation of staleUpdates) {
        await markSyncOperationAsDone(operation.id);
    }
};

export const pushLocalChanges = async (): Promise<PushResult> => {
    try {
        const pendingOperations = await getPendingSyncOperations();

        if (pendingOperations.length === 0) {
            return { success: true };
        }

        const batchData = groupOperationsByTable(pendingOperations);

        if (Object.keys(batchData).length === 0) {
            for (const operation of pendingOperations) {
                await markSyncOperationAsDone(operation.id);
            }

            return { success: true };
        }

        const result = await sendChangesToServer(batchData);

        if (result.success) {
            for (const operation of pendingOperations) {
                await markSyncOperationAsDone(operation.id);
            }
            return { success: true };
        }

        const isMissingRecordConflict =
            result.status === 409 && result.type === 'conflict' && result.code === 'missing_record';

        if (isMissingRecordConflict) {
            await resolveConflictMissingRecord(pendingOperations, result.table, result.id);

            return {
                success: false,
                conflictMissingRecord: true,
                table: result.table,
                id: result.id,
            };
        }

        if (isTransientSyncError(result)) {
            return {
                success: false,
                isRetryableNetworkFailure: true,
            };
        }

        captureSyncFailure('push_response', {
            pendingOperations: pendingOperations.length,
            batch: summarizeBatchData(batchData),
            response: result,
        });
        return { success: false };
    } catch (error) {
        let pendingOperations = [];
        try {
            pendingOperations = await getPendingSyncOperations();
        } catch (pendingError) {
            captureSyncFailure('push_exception_pending_lookup', {}, pendingError);
        }
        captureSyncFailure(
            'push_exception',
            {
                pendingOperations: pendingOperations.length,
            },
            error,
        );
        return { success: false };
    }
};

const normalizeSyncLocale = (value: string | null | undefined): string => {
    if (!value) return 'en';

    const normalized = value.trim().replace('_', '-');
    if (!normalized) return 'en';

    const parts = normalized.split('-').filter((part) => part.length > 0);
    if (parts.length === 0) return 'en';

    const normalizedParts = parts.map((part, index) => {
        if (index === 0) return part.toLowerCase();
        if (/^[A-Za-z]{2}$/.test(part)) return part.toUpperCase();
        return part.toLowerCase();
    });

    return normalizedParts.join('-');
};

const resolveMaxPackTimestamp = (packs: Record<string, any>, since: number): number => {
    const packTimestamps = Object.values(packs)
        .map((pack) => Number(pack?.timestamp))
        .filter((timestamp) => Number.isFinite(timestamp));

    return Math.max(since, ...packTimestamps);
};

const applyUserSyncPacks = async (packs: Record<string, any>) => {
    await db.transaction(async (tx) => {
        const deleteWorkoutExercisesWithSets = async (column: any, value: string) => {
            const relatedWorkoutExercises = await tx
                .select({ id: workoutExercise.id })
                .from(workoutExercise)
                .where(eq(column, value));

            for (const row of relatedWorkoutExercises) {
                await tx.delete(exerciseSet).where(eq(exerciseSet.workoutExerciseId, row.id));
            }

            await tx.delete(workoutExercise).where(eq(column, value));
        };

        const upsert = async (
            syncTableName: string,
            table: any,
            rows: any[],
            key: any,
            dateKeys: string[],
        ) => {
            for (const row of rows) {
                const payload = (() => {
                    const baseRecord = { ...(row as Record<string, unknown>) };
                    if (syncTableName === 'exercise') {
                        return normalizeIncomingExerciseSyncRecord(baseRecord);
                    }
                    if (syncTableName === 'exercise_set') {
                        return normalizeIncomingExerciseSetSyncRecord(baseRecord);
                    }
                    return baseRecord as Record<string, any>;
                })();

                delete (payload as any).serverCreatedAt;
                delete (payload as any).serverUpdatedAt;

                for (const keyName of dateKeys) {
                    if (payload[keyName] != null) {
                        payload[keyName] = parseServerDate(payload[keyName]);
                    }
                }

                const recordId = payload.id as string | undefined;

                if (typeof recordId !== 'string' || recordId.length === 0) {
                    continue;
                }

                const found = await tx.select().from(table).where(eq(key, recordId)).limit(1);

                if (found.length === 0) {
                    await tx.insert(table).values(payload);
                    continue;
                }

                const local = found[0];
                const serverTime = parseServerDate(payload.updatedAt).getTime();
                const localTime = parseServerDate(local.updatedAt).getTime();
                if (serverTime > localTime) {
                    await tx.update(table).set(payload).where(eq(key, recordId));
                }
            }
        };

        if (packs.user) {
            await upsert('user', userTable, packs.user.records ?? [], userTable.id, [
                'createdAt',
                'updatedAt',
                'isDelayedDate',
                'birthday',
            ]);
            for (const id of packs.user.deletedIds ?? []) {
                await tx.delete(userTable).where(eq(userTable.id, id));
            }
        }

        if (packs.exercise) {
            await upsert('exercise', exercise, packs.exercise.records ?? [], exercise.id, [
                'createdAt',
                'updatedAt',
            ]);
            for (const id of packs.exercise.deletedIds ?? []) {
                await deleteWorkoutExercisesWithSets(workoutExercise.exerciseId, id);
                await tx.delete(exercise).where(eq(exercise.id, id));
            }
        }

        if (packs.workout) {
            await upsert('workout', workout, packs.workout.records ?? [], workout.id, [
                'createdAt',
                'updatedAt',
                'startAt',
                'startedAt',
                'completedAt',
            ]);
            for (const id of packs.workout.deletedIds ?? []) {
                await deleteWorkoutExercisesWithSets(workoutExercise.workoutId, id);
                await tx.delete(workoutGroup).where(eq(workoutGroup.workoutId, id));
                await tx.delete(workout).where(eq(workout.id, id));
            }
        }

        if (packs.workout_group) {
            await upsert(
                'workout_group',
                workoutGroup,
                packs.workout_group.records ?? [],
                workoutGroup.id,
                ['createdAt', 'updatedAt'],
            );
            for (const id of packs.workout_group.deletedIds ?? []) {
                await deleteWorkoutExercisesWithSets(workoutExercise.groupId, id);
                await tx.delete(workoutGroup).where(eq(workoutGroup.id, id));
            }
        }

        if (packs.workout_exercise) {
            await upsert(
                'workout_exercise',
                workoutExercise,
                packs.workout_exercise.records ?? [],
                workoutExercise.id,
                ['createdAt', 'updatedAt'],
            );
            for (const id of packs.workout_exercise.deletedIds ?? []) {
                await tx.delete(exerciseSet).where(eq(exerciseSet.workoutExerciseId, id));
                await tx.delete(workoutExercise).where(eq(workoutExercise.id, id));
            }
        }

        if (packs.exercise_set) {
            await upsert(
                'exercise_set',
                exerciseSet,
                packs.exercise_set.records ?? [],
                exerciseSet.id,
                ['createdAt', 'updatedAt', 'startedAt', 'completedAt', 'restCompletedAt'],
            );
            for (const id of packs.exercise_set.deletedIds ?? []) {
                await tx.delete(exerciseSet).where(eq(exerciseSet.id, id));
            }
        }

        if (packs.measurement) {
            await upsert(
                'measurement',
                measurement,
                packs.measurement.records ?? [],
                measurement.id,
                ['createdAt', 'updatedAt', 'recordedAt'],
            );
            for (const id of packs.measurement.deletedIds ?? []) {
                await tx.delete(measurement).where(eq(measurement.id, id));
            }
        }
    });
};

const applySkulptSyncPacks = async (
    packs: Record<string, any>,
    options: { replaceExistingSkulpt: boolean },
) => {
    await db.transaction(async (tx) => {
        const deleteWorkoutExercisesWithSets = async (exerciseId: string) => {
            const relatedWorkoutExercises = await tx
                .select({ id: workoutExercise.id })
                .from(workoutExercise)
                .where(eq(workoutExercise.exerciseId, exerciseId));

            for (const row of relatedWorkoutExercises) {
                await tx.delete(exerciseSet).where(eq(exerciseSet.workoutExerciseId, row.id));
            }

            await tx.delete(workoutExercise).where(eq(workoutExercise.exerciseId, exerciseId));
        };

        if (options.replaceExistingSkulpt) {
            await tx.delete(exercise).where(eq(exercise.userId, SKULPT_EXERCISES_USER_ID));
        }

        for (const row of packs.exercise?.records ?? []) {
            const payload = normalizeIncomingExerciseSyncRecord({
                ...(row as Record<string, unknown>),
            });

            delete (payload as any).serverCreatedAt;
            delete (payload as any).serverUpdatedAt;

            if (payload.createdAt != null) payload.createdAt = parseServerDate(payload.createdAt);
            if (payload.updatedAt != null) payload.updatedAt = parseServerDate(payload.updatedAt);

            const found = await tx
                .select()
                .from(exercise)
                .where(eq(exercise.id, payload.id as string))
                .limit(1);

            if (found.length === 0) {
                await tx.insert(exercise).values(payload as any);
                continue;
            }

            await tx
                .update(exercise)
                .set(payload as any)
                .where(eq(exercise.id, payload.id as string));
        }

        for (const id of packs.exercise?.deletedIds ?? []) {
            await deleteWorkoutExercisesWithSets(id);
            await tx.delete(exercise).where(eq(exercise.id, id));
        }
    });
};

const pullUserServerChanges = async (): Promise<PullResult> => {
    try {
        const lastSyncTime = await getLastSyncTimestamp();
        const since = lastSyncTime.getTime();

        const currentUser = await getCurrentUser();
        if (!currentUser) return { success: true };

        const result = await getServerChanges(since, currentUser.id, { syncType: 'user' });

        if (result.success && result.data) {
            await applyUserSyncPacks(result.data);
            const maxTimestamp = resolveMaxPackTimestamp(result.data, since);
            await updateLastSyncTimestamp(new Date(maxTimestamp));
            return { success: true };
        }

        if (isTransientSyncError(result)) {
            return {
                success: false,
                isRetryableNetworkFailure: true,
            };
        }

        captureSyncFailure('pull_user_response', {
            since,
            userId: currentUser.id,
            response: result,
        });
        return { success: false };
    } catch (error) {
        captureSyncFailure('pull_user_exception', {}, error);
        return { success: false };
    }
};

const pullSkulptChanges = async (
    options: {
        locale?: string;
        full?: boolean;
    } = {},
): Promise<PullResult> => {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser) return { success: true };

        const locale = normalizeSyncLocale(options.locale ?? currentUser.lng ?? 'en');
        const previousSyncTime = options.full
            ? new Date(0)
            : await getSkulptLastSyncTimestamp(locale);
        const since = options.full ? 0 : previousSyncTime.getTime();

        const result = await getServerChanges(since, currentUser.id, {
            syncType: 'skulpt',
            locale,
        });

        if (result.success && result.data) {
            await applySkulptSyncPacks(result.data, {
                replaceExistingSkulpt: options.full === true,
            });
            const maxTimestamp = resolveMaxPackTimestamp(result.data, since);
            await updateSkulptLastSyncTimestamp(locale, new Date(maxTimestamp));
            return { success: true };
        }

        if (isTransientSyncError(result)) {
            return {
                success: false,
                isRetryableNetworkFailure: true,
            };
        }

        captureSyncFailure('pull_skulpt_response', {
            since,
            userId: currentUser.id,
            locale,
            full: options.full === true,
            response: result,
        });
        return { success: false };
    } catch (error) {
        captureSyncFailure('pull_skulpt_exception', { options }, error);
        return { success: false };
    }
};

export const performSkulptSync = async (
    options: {
        locale?: string;
        full?: boolean;
    } = {},
): Promise<boolean> => {
    if (!isSyncEnabled()) return false;

    const result = await pullSkulptChanges(options);
    return result.success;
};

export const pullServerChanges = async (): Promise<PullResult> => {
    const userPull = await pullUserServerChanges();
    if (!userPull.success) {
        return userPull;
    }

    return pullSkulptChanges();
};

export const performSync = async (): Promise<boolean> => {
    try {
        await backfillSyncQueue();

        let pushResult = await pushLocalChanges();

        if (!pushResult.success && pushResult.conflictMissingRecord) {
            const conflictPullResult = await pullServerChanges();
            if (!conflictPullResult.success) {
                if (!conflictPullResult.isRetryableNetworkFailure) {
                    captureSyncFailure('perform_conflict_pull_failed', {
                        table: pushResult.table,
                        id: pushResult.id,
                    });
                }
                return false;
            }

            pushResult = await pushLocalChanges();
        }

        if (!pushResult.success) {
            if (!pushResult.isRetryableNetworkFailure) {
                captureSyncFailure('perform_stop_after_push_failure', {
                    conflictMissingRecord: pushResult.conflictMissingRecord ?? false,
                    table: pushResult.table ?? null,
                    id: pushResult.id ?? null,
                });
            }
            return false;
        }

        const pullResult = await pullServerChanges();
        if (!pullResult.success) {
            if (!pullResult.isRetryableNetworkFailure) {
                captureSyncFailure('perform_stop_after_pull_failure', {});
            }
            return false;
        }

        // Clean up synced records after successful sync
        await cleanupSyncedOperations();

        return true;
    } catch (error) {
        captureSyncFailure('perform_exception', {}, error);
        return false;
    }
};

export const getSyncStats = async () => {
    try {
        const pendingCount = await getPendingSyncOperationsCount();
        const lastSyncTime = await getLastSyncTimestamp();

        return {
            pendingCount,
            lastSyncTime,
            isSyncNeeded: pendingCount > 0,
        };
    } catch (error) {
        captureSyncFailure('getSyncStats', {}, error);
        return {
            pendingCount: 0,
            lastSyncTime: new Date(0),
            isSyncNeeded: false,
        };
    }
};
