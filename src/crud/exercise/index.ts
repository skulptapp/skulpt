import { eq, and, desc, inArray, or, exists, like, sql, type SQL } from 'drizzle-orm';

import { db } from '@/db';
import {
    exercise,
    exerciseSet,
    workoutExercise,
    workoutGroup,
    workout,
    ExerciseInsert,
    ExerciseSelect,
    ExerciseSetInsert,
    ExerciseSetSelect,
    WorkoutSelect,
    WorkoutExerciseSelect,
} from '@/db/schema';
import { nanoid } from '@/helpers/nanoid';
import { isRestActive } from '@/helpers/rest';
import { normalizeSetType } from '@/helpers/set-type';
import { reportError } from '@/services/error-reporting';
import { SKULPT_EXERCISES_USER_ID, isSkulptExerciseUserId } from '@/constants/skulpt';
import { expandMuscleValues } from '@/constants/muscles';

import { withSync, withSyncDelete, handleCrudError } from '../shared';
import { queueSyncOperation } from '../sync';

export interface ExerciseHistoryItem {
    workout: WorkoutSelect;
    workoutExercise: WorkoutExerciseSelect;
    sets: ExerciseSetSelect[];
}

export type ExerciseListSelect = Pick<
    ExerciseSelect,
    | 'id'
    | 'name'
    | 'category'
    | 'tracking'
    | 'primaryMuscleGroups'
    | 'gifFilename'
    | 'userId'
    | 'source'
>;

const normalizeExerciseSetRecord = (row: ExerciseSetSelect): ExerciseSetSelect => ({
    ...row,
    type: normalizeSetType(row.type) as ExerciseSetSelect['type'],
});

export const isSkulptExercise = (row: Pick<ExerciseSelect, 'userId'> | null | undefined): boolean =>
    isSkulptExerciseUserId(row?.userId);

const exerciseScopeCondition = (userId: string) =>
    or(eq(exercise.userId, userId), eq(exercise.userId, SKULPT_EXERCISES_USER_ID));

const buildForkedExerciseRecord = (
    source: ExerciseSelect,
    userId: string,
    updates: Partial<ExerciseSelect>,
): ExerciseInsert => {
    const now = new Date();

    return {
        ...source,
        ...updates,
        id: nanoid(),
        userId,
        source: 'user',
        skulptSourceId: source.skulptSourceId ?? source.id,
        createdAt: now,
        updatedAt: now,
    };
};

const remapWorkoutExerciseReferences = async (
    sourceExerciseId: string,
    targetExerciseId: string,
    userId: string,
): Promise<void> => {
    const affectedWorkoutExercises = await db
        .select({ id: workoutExercise.id })
        .from(workoutExercise)
        .innerJoin(workout, eq(workoutExercise.workoutId, workout.id))
        .where(and(eq(workout.userId, userId), eq(workoutExercise.exerciseId, sourceExerciseId)));

    for (const affectedWorkoutExercise of affectedWorkoutExercises) {
        await db
            .update(workoutExercise)
            .set({ exerciseId: targetExerciseId })
            .where(eq(workoutExercise.id, affectedWorkoutExercise.id));

        const updatedWorkoutExercise = await db
            .select()
            .from(workoutExercise)
            .where(eq(workoutExercise.id, affectedWorkoutExercise.id))
            .limit(1);

        if (updatedWorkoutExercise.length === 0) {
            continue;
        }

        await queueSyncOperation({
            tableName: 'workout_exercise',
            recordId: affectedWorkoutExercise.id,
            operation: 'update',
            timestamp: updatedWorkoutExercise[0].updatedAt,
            data: {
                exerciseId: targetExerciseId,
                updatedAt: updatedWorkoutExercise[0].updatedAt,
            },
        });
    }
};

export interface ExerciseFilterParams {
    ownership?: 'all' | 'mine' | 'system';
    category?: string[] | null;
    tracking?: string[][] | null;
    primaryMuscle?: string[] | null;
}

export const getExercises = async (userId: string): Promise<ExerciseListSelect[]> => {
    return getFilteredExercises(userId);
};

export const getFilteredExercises = async (
    userId: string,
    filters?: ExerciseFilterParams,
): Promise<ExerciseListSelect[]> => {
    const conditions: SQL[] = [];

    // Scope: ownership filter
    if (filters?.ownership === 'mine') {
        const hasTrainedSets = exists(
            db
                .select({ one: sql`1` })
                .from(workoutExercise)
                .innerJoin(workout, eq(workoutExercise.workoutId, workout.id))
                .innerJoin(exerciseSet, eq(exerciseSet.workoutExerciseId, workoutExercise.id))
                .where(
                    and(eq(workoutExercise.exerciseId, exercise.id), eq(workout.userId, userId)),
                ),
        );
        conditions.push(or(eq(exercise.userId, userId), hasTrainedSets)!);
    } else if (filters?.ownership === 'system') {
        conditions.push(eq(exercise.source, 'system'));
    } else {
        conditions.push(exerciseScopeCondition(userId)!);
    }

    // Category filter
    if (filters?.category && filters.category.length > 0) {
        conditions.push(
            inArray(exercise.category, filters.category as typeof exercise.category.enumValues),
        );
    }

    // Tracking filter — JSON column, match exact combo via serialized string
    if (filters?.tracking && filters.tracking.length > 0) {
        const trackingConditions = filters.tracking.map((combo) => {
            const sorted = [...combo].sort();
            const serialized = JSON.stringify(sorted);
            return eq(
                sql`(SELECT json_group_array(value) FROM (SELECT value FROM json_each(${exercise.tracking}) ORDER BY value))`,
                serialized,
            );
        });
        conditions.push(
            trackingConditions.length === 1 ? trackingConditions[0] : or(...trackingConditions)!,
        );
    }

    // Primary muscle filter — expand to all conflicting values, use LIKE on JSON
    if (filters?.primaryMuscle && filters.primaryMuscle.length > 0) {
        const expanded = expandMuscleValues(filters.primaryMuscle);
        const muscleConditions = expanded.map((muscle) =>
            like(sql`${exercise.primaryMuscleGroups}`, `%"${muscle}"%`),
        );
        conditions.push(
            muscleConditions.length === 1 ? muscleConditions[0] : or(...muscleConditions)!,
        );
    }

    return await db
        .select({
            id: exercise.id,
            name: exercise.name,
            category: exercise.category,
            tracking: exercise.tracking,
            primaryMuscleGroups: exercise.primaryMuscleGroups,
            gifFilename: exercise.gifFilename,
            userId: exercise.userId,
            source: exercise.source,
        })
        .from(exercise)
        .where(and(...conditions));
};

export const getExerciseById = async (
    id: string,
    userId: string,
): Promise<ExerciseSelect | null> => {
    const result = await db
        .select()
        .from(exercise)
        .where(and(eq(exercise.id, id), exerciseScopeCondition(userId)))
        .limit(1);
    return result.length > 0 ? result[0] : null;
};

export const createExercise = async (data: Omit<ExerciseInsert, 'id'>): Promise<ExerciseSelect> => {
    const newExercise: ExerciseInsert = {
        id: nanoid(),
        ...data,
    };

    try {
        return await withSync('exercise', 'create', async () => {
            await db.insert(exercise).values(newExercise).onConflictDoUpdate({
                target: exercise.id,
                set: newExercise,
            });
            return db.select().from(exercise).where(eq(exercise.id, newExercise.id)).limit(1);
        });
    } catch (error) {
        handleCrudError('create', 'exercise', error);
    }
};

export const updateExercise = async (
    id: string,
    userId: string,
    updates: Partial<ExerciseSelect>,
): Promise<ExerciseSelect> => {
    try {
        const existingExercise = await getExerciseById(id, userId);

        if (!existingExercise) {
            throw new Error('Exercise not found');
        }

        if (isSkulptExercise(existingExercise)) {
            const forkedExercise = buildForkedExerciseRecord(existingExercise, userId, updates);

            await db.insert(exercise).values(forkedExercise).onConflictDoUpdate({
                target: exercise.id,
                set: forkedExercise,
            });

            const createdFork = await db
                .select()
                .from(exercise)
                .where(eq(exercise.id, forkedExercise.id))
                .limit(1);

            if (createdFork.length === 0) {
                throw new Error('Failed to create exercise copy');
            }

            await queueSyncOperation({
                tableName: 'exercise',
                recordId: createdFork[0].id,
                operation: 'create',
                timestamp: createdFork[0].updatedAt,
                data: createdFork[0],
            });

            await remapWorkoutExerciseReferences(existingExercise.id, createdFork[0].id, userId);

            return createdFork[0];
        }

        return await withSync(
            'exercise',
            'update',
            async () => {
                await db
                    .update(exercise)
                    .set(updates)
                    .where(and(eq(exercise.id, id), eq(exercise.userId, userId)));

                return db
                    .select()
                    .from(exercise)
                    .where(and(eq(exercise.id, id), eq(exercise.userId, userId)))
                    .limit(1);
            },
            id,
        );
    } catch (error) {
        handleCrudError('update', 'exercise', error);
    }
};

export const mergeExercise = async (
    sourceId: string,
    targetId: string,
    userId: string,
): Promise<ExerciseSelect> => {
    try {
        if (sourceId === targetId) {
            throw new Error('Cannot merge exercise into itself');
        }

        const sourceExercise = await getExerciseById(sourceId, userId);
        if (!sourceExercise) {
            throw new Error('Source exercise not found');
        }

        const targetExercise = await getExerciseById(targetId, userId);
        if (!targetExercise) {
            throw new Error('Target exercise not found');
        }

        // Remap all workout_exercise references from source to target
        await remapWorkoutExerciseReferences(sourceId, targetId, userId);

        // Delete source if it's a user exercise (system exercises cannot be deleted)
        if (!isSkulptExercise(sourceExercise)) {
            await withSyncDelete('exercise', sourceExercise, async () => {
                await db
                    .delete(exercise)
                    .where(and(eq(exercise.id, sourceId), eq(exercise.userId, userId)));
            });
        }

        return targetExercise;
    } catch (error) {
        handleCrudError('merge', 'exercise', error);
    }
};

export const deleteExercise = async (id: string, userId: string): Promise<void> => {
    try {
        const exerciseToDelete = await getExerciseById(id, userId);

        if (!exerciseToDelete) {
            throw new Error('Exercise not found');
        }

        if (isSkulptExercise(exerciseToDelete)) {
            throw new Error('Dataset exercises cannot be deleted');
        }

        // Get all workout exercises for this exercise
        const workoutExercises = await db
            .select()
            .from(workoutExercise)
            .where(eq(workoutExercise.exerciseId, id));

        // Delete all exercise sets for each workout exercise and create sync records
        for (const workoutExercise of workoutExercises) {
            const exerciseSets = await getExerciseSets(workoutExercise.id);
            for (const set of exerciseSets) {
                await db.delete(exerciseSet).where(eq(exerciseSet.id, set.id));
                await queueSyncOperation({
                    tableName: 'exercise_set',
                    recordId: set.id,
                    operation: 'delete',
                    timestamp: new Date(),
                    data: set,
                });
            }
        }

        // Collect affected group IDs before deletion
        const affectedGroupIds = Array.from(
            new Set(
                workoutExercises
                    .map((we) => we.groupId)
                    .filter((gid): gid is string => Boolean(gid)),
            ),
        );

        // Delete all workout exercises for this exercise and create sync records
        for (const workoutEx of workoutExercises) {
            await db.delete(workoutExercise).where(eq(workoutExercise.id, workoutEx.id));
            await queueSyncOperation({
                tableName: 'workout_exercise',
                recordId: workoutEx.id,
                operation: 'delete',
                timestamp: new Date(),
                data: workoutEx,
            });
        }

        // Delete the exercise
        await withSyncDelete('exercise', exerciseToDelete, async () => {
            await db.delete(exercise).where(and(eq(exercise.id, id), eq(exercise.userId, userId)));
        });

        // Clean up empty groups
        await cleanupEmptyGroups(affectedGroupIds);
    } catch (error) {
        handleCrudError('delete', 'exercise', error);
    }
};

export const getExerciseSets = async (workoutExerciseId: string): Promise<ExerciseSetSelect[]> => {
    try {
        const rows = await db
            .select()
            .from(exerciseSet)
            .where(eq(exerciseSet.workoutExerciseId, workoutExerciseId))
            // Stable ordering even if duplicate `order` values exist.
            .orderBy(exerciseSet.order, exerciseSet.createdAt, exerciseSet.id);
        return rows.map(normalizeExerciseSetRecord);
    } catch (error) {
        reportError(error, 'Failed to load exercise sets:');
        return [];
    }
};

export const getExerciseSetsByWorkoutExerciseIds = async (
    workoutExerciseIds: string[],
): Promise<ExerciseSetSelect[]> => {
    try {
        if (workoutExerciseIds.length === 0) return [];
        const rows = await db
            .select()
            .from(exerciseSet)
            .where(inArray(exerciseSet.workoutExerciseId, workoutExerciseIds))
            .orderBy(
                exerciseSet.workoutExerciseId,
                exerciseSet.order,
                exerciseSet.createdAt,
                exerciseSet.id,
            );
        return rows.map(normalizeExerciseSetRecord);
    } catch (error) {
        reportError(error, 'Failed to load exercise sets by workout exercise ids:');
        return [];
    }
};

export const getLastExerciseSetsByExerciseId = async (
    exerciseId: string,
): Promise<ExerciseSetSelect[]> => {
    const latestWorkoutExercise = await db
        .select()
        .from(workoutExercise)
        .where(eq(workoutExercise.exerciseId, exerciseId))
        .orderBy(desc(workoutExercise.createdAt))
        .limit(1);

    if (latestWorkoutExercise.length === 0) return [];

    return await getExerciseSets(latestWorkoutExercise[0].id);
};

export const getExerciseHistory = async (
    exerciseId: string,
    userId: string,
): Promise<ExerciseHistoryItem[]> => {
    try {
        // Get all workout exercises for this exercise
        const workoutExercises = await db
            .select()
            .from(workoutExercise)
            .where(eq(workoutExercise.exerciseId, exerciseId));

        if (workoutExercises.length === 0) return [];

        // Get workouts for these workout exercises
        const workoutIds = Array.from(new Set(workoutExercises.map((we) => we.workoutId)));

        if (workoutIds.length === 0) return [];

        // Fetch all workouts at once using inArray
        const allWorkouts = await db
            .select()
            .from(workout)
            .where(and(eq(workout.userId, userId), inArray(workout.id, workoutIds)));

        const workoutMap = new Map<string, WorkoutSelect>();
        allWorkouts.forEach((w) => {
            workoutMap.set(w.id, w);
        });

        // Get completed sets for each workout exercise
        const historyItems: ExerciseHistoryItem[] = [];

        for (const we of workoutExercises) {
            const workoutData = workoutMap.get(we.workoutId);
            if (!workoutData) continue;

            // Get completed sets (only those with completedAt)
            const allSets = await getExerciseSets(we.id);
            const completedSets = allSets.filter((set) => set.completedAt != null);

            if (completedSets.length > 0) {
                historyItems.push({
                    workout: workoutData,
                    workoutExercise: we,
                    sets: completedSets.sort((a, b) => a.order - b.order),
                });
            }
        }

        // Sort by workout completedAt (most recent first), or createdAt if completedAt is null
        historyItems.sort((a, b) => {
            const aDate = a.workout.completedAt || a.workout.startedAt || a.workout.createdAt;
            const bDate = b.workout.completedAt || b.workout.startedAt || b.workout.createdAt;
            const aTime = aDate instanceof Date ? aDate.getTime() : new Date(aDate).getTime();
            const bTime = bDate instanceof Date ? bDate.getTime() : new Date(bDate).getTime();
            return bTime - aTime;
        });

        return historyItems;
    } catch (error) {
        reportError(error, 'Failed to load exercise history:');
        return [];
    }
};

export const createExerciseSet = async (
    data: Omit<ExerciseSetInsert, 'id'>,
): Promise<ExerciseSetSelect> => {
    try {
        return await createExerciseSetWithAutoStart(data);
    } catch (error) {
        handleCrudError('create', 'exercise_set', error);
    }
};

export const updateExerciseSet = async (
    id: string,
    updates: Partial<ExerciseSetSelect>,
): Promise<ExerciseSetSelect> => {
    try {
        return await updateExerciseSetWithRestCalculation(id, updates);
    } catch (error) {
        handleCrudError('update', 'exercise_set', error);
    }
};

export const deleteExerciseSet = async (id: string): Promise<void> => {
    try {
        const toDelete = await db.select().from(exerciseSet).where(eq(exerciseSet.id, id)).limit(1);

        if (toDelete.length === 0) {
            throw new Error('Exercise set not found');
        }

        await withSyncDelete('exercise_set', toDelete[0], async () => {
            await db.delete(exerciseSet).where(eq(exerciseSet.id, id));
        });
    } catch (error) {
        handleCrudError('delete', 'exercise_set', error);
    }
};

/**
 * Creates a new exercise set and handles auto-start logic
 */
export const createExerciseSetWithAutoStart = async (
    data: Omit<ExerciseSetInsert, 'id'>,
): Promise<ExerciseSetSelect> => {
    // Guard against duplicate `order` values for the same workoutExerciseId.
    // Duplicate orders can cause progression logic to skip sets.
    let safeOrder = data.order;
    try {
        const existing = await db
            .select({ id: exerciseSet.id, order: exerciseSet.order })
            .from(exerciseSet)
            .where(eq(exerciseSet.workoutExerciseId, data.workoutExerciseId))
            .orderBy(exerciseSet.order, exerciseSet.createdAt);

        const hasSameOrder = existing.some((s) => s.order === data.order);
        if (hasSameOrder) {
            const maxOrder = existing.reduce((max, s) => (s.order > max ? s.order : max), -1);
            safeOrder = maxOrder + 1;
        }
    } catch (error) {
        // best-effort; keep requested order if query fails
        reportError(error, 'Failed to validate exercise set order before create:');
        safeOrder = data.order;
    }

    // Get units from the associated exercise
    const exerciseUnits = await getExerciseUnits(data.workoutExerciseId);

    const newExerciseSet: ExerciseSetInsert = {
        id: nanoid(),
        ...data,
        order: safeOrder,
        // Always set units from the exercise
        weightUnits: exerciseUnits.weightUnits,
        distanceUnits: exerciseUnits.distanceUnits,
    };

    const createdSet = await withSync('exercise_set', 'create', async () => {
        await db.insert(exerciseSet).values(newExerciseSet).onConflictDoUpdate({
            target: exerciseSet.id,
            set: newExerciseSet,
        });
        return db.select().from(exerciseSet).where(eq(exerciseSet.id, newExerciseSet.id)).limit(1);
    });
    const normalizedCreatedSet = normalizeExerciseSetRecord(createdSet);

    // Handle auto-start logic separately
    try {
        await handleAutoStartLogic(normalizedCreatedSet);
    } catch (error) {
        // Ignore auto-start failures - this is best-effort
        reportError(error, 'Failed to auto-start the first exercise set:');
    }

    return normalizedCreatedSet;
};

/**
 * Handles automatic starting of the first set when conditions are met
 */
const handleAutoStartLogic = async (set: ExerciseSetSelect): Promise<void> => {
    // Get workout exercise info
    const weRows = await db
        .select()
        .from(workoutExercise)
        .where(eq(workoutExercise.id, set.workoutExerciseId))
        .limit(1);

    if (weRows.length === 0) return;

    const weRow = weRows[0];

    // Check workout status
    const workoutRows = await db
        .select()
        .from(workout)
        .where(eq(workout.id, weRow.workoutId))
        .limit(1);

    if (workoutRows.length === 0 || workoutRows[0].status !== 'in_progress') {
        return;
    }

    // Check for other pending sets or active rest
    const allWE = await db
        .select()
        .from(workoutExercise)
        .where(eq(workoutExercise.workoutId, weRow.workoutId));

    const allIds = allWE.map((r) => r.id);
    const otherIds = allIds.filter((id) => id !== weRow.id);

    const allSetsArrays = await Promise.all(
        allIds.map(async (id) => {
            try {
                return await getExerciseSets(id);
            } catch (error) {
                reportError(error, 'Failed to load exercise sets during auto-start check:');
                return [];
            }
        }),
    );
    const nowMs = Date.now();
    const restActive = allSetsArrays.flat().some((s) => isRestActive(s, nowMs));

    const otherSetsArrays = await Promise.all(
        otherIds.map(async (id) => {
            try {
                return await getExerciseSets(id);
            } catch (error) {
                reportError(error, 'Failed to load sibling exercise sets during auto-start check:');
                return [];
            }
        }),
    );
    const otherPendingExists = otherSetsArrays.flat().some((s) => !s.completedAt);

    if (restActive || otherPendingExists) {
        return;
    }

    // Start the first set if no conflicts
    let currentSets: ExerciseSetSelect[] = [];
    try {
        currentSets = await getExerciseSets(weRow.id);
    } catch (error) {
        reportError(error, 'Failed to load current exercise sets for auto-start:');
        currentSets = [];
    }

    if (currentSets.length > 0) {
        const firstSet = currentSets.slice().sort((a, b) => a.order - b.order)[0];
        if (!firstSet.startedAt) {
            await updateExerciseSetWithRestCalculation(firstSet.id, { startedAt: new Date() });
        }
    }
};

/**
 * Handles group cleanup after exercise deletion
 */
export const cleanupEmptyGroups = async (affectedGroupIds: string[]): Promise<void> => {
    for (const groupId of affectedGroupIds) {
        const remainingExercises = await db
            .select()
            .from(workoutExercise)
            .where(eq(workoutExercise.groupId, groupId))
            .limit(1);

        if (remainingExercises.length === 0) {
            const groupToDelete = await db
                .select()
                .from(workoutGroup)
                .where(eq(workoutGroup.id, groupId))
                .limit(1);

            if (groupToDelete.length > 0) {
                await withSyncDelete('workout_group', groupToDelete[0], async () => {
                    await db.delete(workoutGroup).where(eq(workoutGroup.id, groupId));
                });
            }
        }
    }
};

/**
 * Updates exercise set with automatic rest time calculation
 */
export const updateExerciseSetWithRestCalculation = async (
    id: string,
    updates: Partial<ExerciseSetSelect>,
): Promise<ExerciseSetSelect> => {
    const rows = await db.select().from(exerciseSet).where(eq(exerciseSet.id, id)).limit(1);
    const existingSet = rows[0];

    // Prevent starting already started sets
    if (updates.startedAt) {
        if (existingSet?.startedAt) {
            // Set is already started, skip the update
            return normalizeExerciseSetRecord(existingSet);
        }

        if (existingSet) {
            const targetWorkoutExercise = await db
                .select()
                .from(workoutExercise)
                .where(eq(workoutExercise.id, existingSet.workoutExerciseId))
                .limit(1);
            const workoutId = targetWorkoutExercise[0]?.workoutId;

            if (workoutId) {
                const workoutExercises = await db
                    .select({ id: workoutExercise.id })
                    .from(workoutExercise)
                    .where(eq(workoutExercise.workoutId, workoutId));
                const workoutExerciseIds = workoutExercises.map((item) => item.id);
                const workoutSets = await getExerciseSetsByWorkoutExerciseIds(workoutExerciseIds);
                const conflictingSet = workoutSets.find(
                    (set) => set.id !== id && !!set.startedAt && !set.completedAt,
                );

                if (conflictingSet) {
                    reportError(
                        new Error('Attempted to start a second active set'),
                        'Blocked conflicting set start:',
                        {
                            extras: {
                                workoutId,
                                requestedSetId: id,
                                conflictingSetId: conflictingSet.id,
                            },
                        },
                    );
                    return normalizeExerciseSetRecord(existingSet);
                }
            }
        }
    }

    let updatedData = { ...updates };

    // Auto-calculate rest time if needed
    if (updatedData.restCompletedAt && updatedData.finalRestTime == null) {
        const baseSet = existingSet;

        if (baseSet?.completedAt) {
            const completedAtMs = getTimeInMs(baseSet.completedAt);
            const restCompletedAtMs = getTimeInMs(updatedData.restCompletedAt);

            if (completedAtMs && restCompletedAtMs) {
                const diffSec = Math.floor((restCompletedAtMs - completedAtMs) / 1000);
                const cap = Math.max(0, Math.min(baseSet.restTime ?? 0, diffSec));
                updatedData.finalRestTime = cap;
            }
        }
    }

    // Handle case when restCompletedAt is not provided but restTime exists
    // Only auto-finalize if restTime is being set to 0 or null (cancelling rest)
    if (!updatedData.restCompletedAt && updatedData.finalRestTime == null) {
        const baseSet = existingSet;

        if (baseSet?.completedAt && baseSet.restTime != null) {
            // Only auto-finalize if restTime is being cancelled (set to 0 or null)
            if (updatedData.restTime === 0 || updatedData.restTime === null) {
                updatedData.restCompletedAt = baseSet.completedAt;
                updatedData.finalRestTime = 0;
            }
            // If restTime is being changed to a positive value, don't auto-finalize
            // Let the user see the updated timer
        }
    }

    return await withSync(
        'exercise_set',
        'update',
        async () => {
            await db.update(exerciseSet).set(updatedData).where(eq(exerciseSet.id, id));
            return db.select().from(exerciseSet).where(eq(exerciseSet.id, id)).limit(1);
        },
        id,
    ).then((row) => normalizeExerciseSetRecord(row));
};

/**
 * Helper function to get exercise units from workoutExerciseId
 */
const getExerciseUnits = async (
    workoutExerciseId: string,
): Promise<{ weightUnits: 'kg' | 'lb' | null; distanceUnits: 'km' | 'mi' | null }> => {
    const workoutExerciseData = await db
        .select({
            weightUnits: exercise.weightUnits,
            distanceUnits: exercise.distanceUnits,
        })
        .from(workoutExercise)
        .innerJoin(exercise, eq(workoutExercise.exerciseId, exercise.id))
        .where(eq(workoutExercise.id, workoutExerciseId))
        .limit(1);

    if (workoutExerciseData.length === 0) {
        throw new Error(`Workout exercise with id ${workoutExerciseId} not found`);
    }

    return {
        weightUnits: workoutExerciseData[0].weightUnits as 'kg' | 'lb' | null,
        distanceUnits: workoutExerciseData[0].distanceUnits as 'km' | 'mi' | null,
    };
};

/**
 * Helper function to convert time values to milliseconds
 */
const getTimeInMs = (value: unknown): number | null => {
    if (!value) return null;
    if (typeof value === 'number') return value;
    if (value instanceof Date) return value.getTime();
    const parsed = new Date(value as any).getTime();
    return Number.isNaN(parsed) ? null : parsed;
};
