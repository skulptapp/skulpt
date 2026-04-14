import { eq, and, desc, ne, isNotNull, sql, inArray, gte } from 'drizzle-orm';

import { db } from '@/db';
import {
    workout,
    workoutExercise,
    workoutGroup,
    WorkoutInsert,
    WorkoutSelect,
    WorkoutExerciseInsert,
    WorkoutExerciseSelect,
    WorkoutGroupInsert,
    WorkoutGroupSelect,
} from '@/db/schema';
import { exercise, exerciseSet, ExerciseSelect, ExerciseSetInsert } from '@/db/schema/exercise';
import { nanoid } from '@/helpers/nanoid';
import { reportError } from '@/services/error-reporting';
import { computeWorkoutStats } from '@/services/workout-health-stats';
import { HealthStats } from '@/types/health-stats';
import { getTopLevelMuscleValues } from '@/constants/muscles';

import { queueSyncOperation } from '../sync';
import { getExerciseSets, updateExerciseSet, createExerciseSet } from '../exercise';
import { convertWeight } from '@/helpers/units';
import { getCurrentUser } from '../user';

export const getWorkouts = async (): Promise<WorkoutSelect[]> => {
    const user = await getCurrentUser();
    if (!user) return [];
    return await db
        .select()
        .from(workout)
        .where(eq(workout.userId, user.id))
        .orderBy(desc(workout.createdAt));
};

export const getWorkoutById = async (id: string): Promise<WorkoutSelect | null> => {
    const result = await db.select().from(workout).where(eq(workout.id, id)).limit(1);
    return result.length > 0 ? result[0] : null;
};

export const createWorkout = async (data: Omit<WorkoutInsert, 'id'>): Promise<WorkoutSelect> => {
    // compute duration if both dates provided
    let computedDuration: number | null = null;
    const started = data.startedAt ? (data.startedAt as Date) : null;
    const completed = data.completedAt ? (data.completedAt as Date) : null;
    if (started && completed) {
        const deltaMs = completed.getTime() - started.getTime();
        computedDuration = Math.max(0, Math.floor(deltaMs / 1000));
    }

    const newWorkout: WorkoutInsert = {
        id: nanoid(),
        ...data,
        duration: computedDuration ?? data.duration ?? null,
    };

    try {
        await db.insert(workout).values(newWorkout).onConflictDoUpdate({
            target: workout.id,
            set: newWorkout,
        });

        const createdWorkout = await db
            .select()
            .from(workout)
            .where(eq(workout.id, newWorkout.id))
            .limit(1);

        if (createdWorkout.length === 0) {
            throw new Error('Failed to retrieve created workout');
        }

        await queueSyncOperation({
            tableName: 'workout',
            recordId: newWorkout.id,
            operation: 'create',
            timestamp: createdWorkout[0].updatedAt,
            data: createdWorkout[0],
        });

        return createdWorkout[0];
    } catch (error) {
        reportError(error, 'Failed to create workout:');
        throw error;
    }
};

export const updateWorkout = async (
    id: string,
    updates: Partial<WorkoutSelect>,
): Promise<WorkoutSelect> => {
    try {
        // Load current to compute duration against merged values
        const curr = await db.select().from(workout).where(eq(workout.id, id)).limit(1);
        if (curr.length === 0) {
            throw new Error('Workout not found');
        }

        const current = curr[0];
        const mergedStartedAt =
            (updates.startedAt as Date | null | undefined) ?? (current.startedAt as Date | null);
        const mergedCompletedAt =
            (updates.completedAt as Date | null | undefined) ??
            (current.completedAt as Date | null);

        let computedDuration: number | null = null;
        if (mergedStartedAt && mergedCompletedAt) {
            const deltaMs = mergedCompletedAt.getTime() - mergedStartedAt.getTime();
            computedDuration = Math.max(0, Math.floor(deltaMs / 1000));
        }

        const shouldRecompute =
            Object.prototype.hasOwnProperty.call(updates, 'startedAt') ||
            Object.prototype.hasOwnProperty.call(updates, 'completedAt');

        const updatedData: Partial<WorkoutSelect> = { ...updates } as any;
        if (shouldRecompute) {
            (updatedData as any).duration = computedDuration;
        }

        await db
            .update(workout)
            .set(updatedData as any)
            .where(eq(workout.id, id));

        const updatedWorkout = await db.select().from(workout).where(eq(workout.id, id)).limit(1);

        if (updatedWorkout.length === 0) {
            throw new Error('Workout not found after update');
        }

        await queueSyncOperation({
            tableName: 'workout',
            recordId: id,
            operation: 'update',
            timestamp: updatedWorkout[0].updatedAt,
            data: {
                ...updatedData,
                updatedAt: updatedWorkout[0].updatedAt,
            },
        });

        return updatedWorkout[0];
    } catch (error) {
        reportError(error, 'Failed to update workout:', {
            extras: { workoutId: id },
        });
        throw error;
    }
};

export const deleteWorkout = async (id: string): Promise<void> => {
    try {
        const workoutToDelete = await getWorkoutById(id);

        if (!workoutToDelete) {
            throw new Error('Workout not found');
        }

        // Get all workout exercises for this workout
        const workoutExercises = await getWorkoutExercises(id);

        // Get all workout groups for this workout
        const workoutGroups = await getWorkoutGroups(id);

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

        // Delete all workout exercises and create sync records
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

        // Delete all workout groups and create sync records
        for (const group of workoutGroups) {
            await db.delete(workoutGroup).where(eq(workoutGroup.id, group.id));
            await queueSyncOperation({
                tableName: 'workout_group',
                recordId: group.id,
                operation: 'delete',
                timestamp: new Date(),
                data: group,
            });
        }

        // Delete the workout itself
        await db.delete(workout).where(eq(workout.id, id));

        await queueSyncOperation({
            tableName: 'workout',
            recordId: id,
            operation: 'delete',
            timestamp: new Date(),
            data: workoutToDelete,
        });
    } catch (error) {
        reportError(error, 'Failed to delete workout:');
        throw error;
    }
};

export const getWorkoutExercises = async (workoutId: string): Promise<WorkoutExerciseSelect[]> => {
    return await db.select().from(workoutExercise).where(eq(workoutExercise.workoutId, workoutId));
};

export const getWorkoutGroups = async (workoutId: string): Promise<WorkoutGroupSelect[]> => {
    return await db
        .select()
        .from(workoutGroup)
        .where(eq(workoutGroup.workoutId, workoutId))
        .orderBy(workoutGroup.order);
};

export const createWorkoutGroup = async (
    data: Omit<WorkoutGroupInsert, 'id'>,
): Promise<WorkoutGroupSelect> => {
    const newGroup: WorkoutGroupInsert = { id: nanoid(), ...data };
    try {
        await db.insert(workoutGroup).values(newGroup).onConflictDoUpdate({
            target: workoutGroup.id,
            set: newGroup,
        });
        const created = await db
            .select()
            .from(workoutGroup)
            .where(eq(workoutGroup.id, newGroup.id))
            .limit(1);
        if (created.length === 0) throw new Error('Failed to retrieve created workout group');
        await queueSyncOperation({
            tableName: 'workout_group',
            recordId: newGroup.id,
            operation: 'create',
            timestamp: created[0].updatedAt,
            data: created[0],
        });
        return created[0];
    } catch (error) {
        reportError(error, 'Failed to create workout group:');
        throw error;
    }
};

export const updateWorkoutGroup = async (
    id: string,
    updates: Partial<WorkoutGroupSelect>,
): Promise<WorkoutGroupSelect> => {
    const updatedData = { ...updates };
    try {
        await db.update(workoutGroup).set(updatedData).where(eq(workoutGroup.id, id));
        const updated = await db
            .select()
            .from(workoutGroup)
            .where(eq(workoutGroup.id, id))
            .limit(1);
        if (updated.length === 0) throw new Error('Workout group not found after update');
        await queueSyncOperation({
            tableName: 'workout_group',
            recordId: id,
            operation: 'update',
            timestamp: updated[0].updatedAt,
            data: { ...updatedData, updatedAt: updated[0].updatedAt },
        });
        return updated[0];
    } catch (error) {
        reportError(error, 'Failed to update workout group:');
        throw error;
    }
};

export const deleteWorkoutGroup = async (id: string): Promise<void> => {
    try {
        const toDelete = await db
            .select()
            .from(workoutGroup)
            .where(eq(workoutGroup.id, id))
            .limit(1);
        if (toDelete.length === 0) throw new Error('Workout group not found');

        // Get all workout exercises in this group
        const groupWorkoutExercises = await db
            .select()
            .from(workoutExercise)
            .where(eq(workoutExercise.groupId, id));

        // Delete all exercise sets for each workout exercise in this group and create sync records
        for (const workoutExercise of groupWorkoutExercises) {
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

        // Delete all workout exercises in this group and create sync records
        for (const workoutEx of groupWorkoutExercises) {
            await db.delete(workoutExercise).where(eq(workoutExercise.id, workoutEx.id));
            await queueSyncOperation({
                tableName: 'workout_exercise',
                recordId: workoutEx.id,
                operation: 'delete',
                timestamp: new Date(),
                data: workoutEx,
            });
        }

        // Delete the workout group
        await db.delete(workoutGroup).where(eq(workoutGroup.id, id));

        await queueSyncOperation({
            tableName: 'workout_group',
            recordId: id,
            operation: 'delete',
            timestamp: new Date(),
            data: toDelete[0],
        });
    } catch (error) {
        reportError(error, 'Failed to delete workout group:');
        throw error;
    }
};

export type WorkoutExerciseWithExercise = WorkoutExerciseSelect & {
    exercise: ExerciseSelect;
};

export const getWorkoutExercisesWithExercise = async (
    workoutId: string,
): Promise<WorkoutExerciseWithExercise[]> => {
    const rows = await db
        .select({ we: workoutExercise, ex: exercise })
        .from(workoutExercise)
        .innerJoin(exercise, eq(workoutExercise.exerciseId, exercise.id))
        .where(eq(workoutExercise.workoutId, workoutId));

    return rows.map((r) => ({ ...r.we, exercise: r.ex }));
};

export const createWorkoutExercise = async (
    data: Omit<WorkoutExerciseInsert, 'id'>,
): Promise<WorkoutExerciseSelect> => {
    const newWorkoutExercise: WorkoutExerciseInsert = {
        id: nanoid(),
        ...data,
    };

    try {
        await db.insert(workoutExercise).values(newWorkoutExercise).onConflictDoUpdate({
            target: workoutExercise.id,
            set: newWorkoutExercise,
        });

        const created = await db
            .select()
            .from(workoutExercise)
            .where(eq(workoutExercise.id, newWorkoutExercise.id))
            .limit(1);

        if (created.length === 0) {
            throw new Error('Failed to retrieve created workout exercise');
        }

        await queueSyncOperation({
            tableName: 'workout_exercise',
            recordId: newWorkoutExercise.id,
            operation: 'create',
            timestamp: created[0].updatedAt,
            data: created[0],
        });

        return created[0];
    } catch (error) {
        reportError(error, 'Failed to create workout exercise:');
        throw error;
    }
};

export const updateWorkoutExercise = async (
    id: string,
    updates: Partial<WorkoutExerciseSelect>,
): Promise<WorkoutExerciseSelect> => {
    const updatedData = { ...updates };

    try {
        await db.update(workoutExercise).set(updatedData).where(eq(workoutExercise.id, id));

        const updated = await db
            .select()
            .from(workoutExercise)
            .where(eq(workoutExercise.id, id))
            .limit(1);

        if (updated.length === 0) {
            throw new Error('Workout exercise not found after update');
        }

        await queueSyncOperation({
            tableName: 'workout_exercise',
            recordId: id,
            operation: 'update',
            timestamp: updated[0].updatedAt,
            data: {
                ...updatedData,
                updatedAt: updated[0].updatedAt,
            },
        });

        return updated[0];
    } catch (error) {
        reportError(error, 'Failed to update workout exercise:');
        throw error;
    }
};

export const deleteWorkoutExercise = async (id: string): Promise<void> => {
    try {
        const toDelete = await db
            .select()
            .from(workoutExercise)
            .where(eq(workoutExercise.id, id))
            .limit(1);

        if (toDelete.length === 0) {
            throw new Error('Workout exercise not found');
        }

        const groupId = toDelete[0].groupId;

        // Delete all exercise sets for this workout exercise and create sync records
        const exerciseSets = await getExerciseSets(id);
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

        // Delete the workout exercise
        await db.delete(workoutExercise).where(eq(workoutExercise.id, id));

        await queueSyncOperation({
            tableName: 'workout_exercise',
            recordId: id,
            operation: 'delete',
            timestamp: new Date(),
            data: toDelete[0],
        });

        if (groupId) {
            const others = await db
                .select()
                .from(workoutExercise)
                .where(eq(workoutExercise.groupId, groupId))
                .limit(1);
            if (others.length === 0) {
                await deleteWorkoutGroup(groupId);
            }
        }
    } catch (error) {
        reportError(error, 'Failed to delete workout exercise:');
        throw error;
    }
};

export const getWorkoutWithExercisesAndSets = async (workoutId: string) => {
    const workoutData = await getWorkoutById(workoutId);
    if (!workoutData) return null;

    const exercises = await db
        .select({ workoutExercise, exercise })
        .from(workoutExercise)
        .innerJoin(exercise, eq(workoutExercise.exerciseId, exercise.id))
        .where(eq(workoutExercise.workoutId, workoutId));

    const groups = await getWorkoutGroups(workoutId);

    const exercisesWithSets = await Promise.all(
        exercises.map(async (row) => {
            const sets = await getExerciseSets(row.workoutExercise.id);
            return {
                workoutExercise: row.workoutExercise,
                exercise: row.exercise,
                sets,
            };
        }),
    );

    const groupIdToGroup = new Map(groups.map((g) => [g.id, { group: g, exercises: [] as any[] }]));
    for (const item of exercisesWithSets) {
        const gid = item.workoutExercise.groupId;
        if (gid && groupIdToGroup.has(gid)) {
            groupIdToGroup.get(gid)!.exercises.push(item);
        } else {
            const syntheticId = `single:${item.workoutExercise.id}`;
            if (!groupIdToGroup.has(syntheticId)) {
                groupIdToGroup.set(syntheticId, {
                    group: {
                        id: syntheticId,
                        workoutId,
                        type: 'single',
                        order: 0,
                        notes: null,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                    exercises: [],
                });
            }
            groupIdToGroup.get(syntheticId)!.exercises.push(item);
        }
    }
    const grouped = Array.from(groupIdToGroup.values()).sort(
        (a, b) => a.group.order - b.group.order,
    );

    return {
        workout: workoutData,
        exercises: exercisesWithSets,
        groups: grouped,
    } as const;
};

export const startWorkout = async (workoutId: string): Promise<WorkoutSelect> => {
    const startedWorkout = await updateWorkout(workoutId, {
        status: 'in_progress',
        startedAt: new Date(),
    });

    try {
        // Determine first exercise by group order then orderInGroup (fallback to createdAt)
        const [exercises, groups] = await Promise.all([
            getWorkoutExercises(workoutId),
            getWorkoutGroups(workoutId),
        ]);

        if (exercises.length === 0) {
            return startedWorkout;
        }

        const groupOrderMap = new Map(groups.map((g) => [g.id, g.order]));

        const sortedExercises = exercises.slice().sort((a, b) => {
            const groupOrderA = a.groupId ? (groupOrderMap.get(a.groupId) ?? 0) : 0;
            const groupOrderB = b.groupId ? (groupOrderMap.get(b.groupId) ?? 0) : 0;
            if (groupOrderA !== groupOrderB) return groupOrderA - groupOrderB;
            const orderInGroupA = a.orderInGroup ?? 0;
            const orderInGroupB = b.orderInGroup ?? 0;
            if (orderInGroupA !== orderInGroupB) return orderInGroupA - orderInGroupB;
            const createdAtA =
                (a.createdAt as unknown as Date).getTime?.() ??
                new Date(a.createdAt as unknown as any).getTime();
            const createdAtB =
                (b.createdAt as unknown as Date).getTime?.() ??
                new Date(b.createdAt as unknown as any).getTime();
            return createdAtA - createdAtB;
        });

        const firstExercise = sortedExercises[0];
        const sets = await getExerciseSets(firstExercise.id);
        if (sets.length > 0) {
            const firstSet = sets.slice().sort((a, b) => a.order - b.order)[0];
            if (!firstSet.startedAt) {
                await updateExerciseSet(firstSet.id, { startedAt: new Date() });
            }
        }
    } catch (error) {
        // best-effort starting the first set; ignore failures
        reportError(error, 'Failed to auto-start the first workout set:');
    }

    return startedWorkout;
};

export const completeWorkout = async (workoutId: string): Promise<WorkoutSelect> => {
    const workout = await getWorkoutById(workoutId);
    if (!workout) {
        throw new Error('Workout not found');
    }

    const completionTime = new Date();

    // Complete all unfinished sets and finalize any pending rest periods
    const workoutExercises = await getWorkoutExercises(workoutId);
    const setsArrays = await Promise.all(workoutExercises.map((we) => getExerciseSets(we.id)));

    let allSets = setsArrays.flat();

    // Complete unfinished sets
    const unfinishedSets = allSets.filter((s) => !s.completedAt);
    if (unfinishedSets.length > 0) {
        await Promise.all(
            unfinishedSets.map((s) =>
                updateExerciseSet(s.id, {
                    completedAt: completionTime,
                    // If set wasn't started, start it now before completing
                    ...(s.startedAt ? {} : { startedAt: completionTime }),
                }),
            ),
        );

        // Update allSets to reflect the completed sets
        allSets = allSets.map((s) =>
            !s.completedAt
                ? { ...s, completedAt: completionTime, startedAt: s.startedAt || completionTime }
                : s,
        );
    }

    // Finalize pending rest periods for completed sets
    const setsWithPendingRest = allSets.filter(
        (s) => s.completedAt != null && s.restTime != null && s.restCompletedAt == null,
    );
    if (setsWithPendingRest.length > 0) {
        await Promise.all(
            setsWithPendingRest.map((s) => {
                return updateExerciseSet(s.id, {
                    restCompletedAt: s.completedAt || completionTime,
                });
            }),
        );
    }

    const duration = workout.startedAt
        ? Math.floor((Date.now() - workout.startedAt.getTime()) / 1000)
        : 0;

    return await updateWorkout(workoutId, {
        status: 'completed',
        completedAt: completionTime,
        duration,
    });
};

export const duplicateWorkout = async (
    workoutId: string,
    mode: 'now' | 'planned' | 'completed',
): Promise<WorkoutSelect> => {
    try {
        const originalWorkout = await getWorkoutWithExercisesAndSets(workoutId);
        if (!originalWorkout) {
            throw new Error('Original workout not found');
        }

        const now = new Date();
        let newWorkoutData: Omit<WorkoutInsert, 'id'> = {
            name: originalWorkout.workout.name,
            userId: originalWorkout.workout.userId,
        };

        switch (mode) {
            case 'now':
                newWorkoutData = {
                    ...newWorkoutData,
                    status: 'in_progress',
                    startedAt: now,
                    startAt: null,
                    completedAt: null,
                    duration: null,
                    remind: null,
                };
                break;
            case 'planned':
                newWorkoutData = {
                    ...newWorkoutData,
                    status: 'planned',
                    startAt: null,
                    startedAt: null,
                    completedAt: null,
                    duration: null,
                    remind: null,
                };
                break;
            case 'completed':
                const originalStartedAt = originalWorkout.workout.startedAt;
                const originalCompletedAt = originalWorkout.workout.completedAt;

                let newStartedAt: Date | null = null;
                let newCompletedAt: Date | null = null;

                if (originalStartedAt && originalCompletedAt) {
                    const startTime =
                        originalStartedAt instanceof Date
                            ? originalStartedAt
                            : new Date(originalStartedAt);
                    const endTime =
                        originalCompletedAt instanceof Date
                            ? originalCompletedAt
                            : new Date(originalCompletedAt);

                    newStartedAt = new Date(now);
                    newStartedAt.setHours(
                        startTime.getHours(),
                        startTime.getMinutes(),
                        startTime.getSeconds(),
                        startTime.getMilliseconds(),
                    );

                    newCompletedAt = new Date(now);
                    newCompletedAt.setHours(
                        endTime.getHours(),
                        endTime.getMinutes(),
                        endTime.getSeconds(),
                        endTime.getMilliseconds(),
                    );
                }

                newWorkoutData = {
                    ...newWorkoutData,
                    status: 'completed',
                    startedAt: newStartedAt,
                    completedAt: newCompletedAt,
                    startAt: null,
                    duration:
                        newStartedAt && newCompletedAt
                            ? Math.floor((newCompletedAt.getTime() - newStartedAt.getTime()) / 1000)
                            : null,
                    remind: null,
                };
                break;
        }

        const newWorkout = await createWorkout(newWorkoutData);

        const groupIdMap = new Map<string, string>();
        for (const groupData of originalWorkout.groups) {
            const originalGroup = groupData.group;
            const newGroup = await createWorkoutGroup({
                workoutId: newWorkout.id,
                type: originalGroup.type,
                order: originalGroup.order,
                notes: originalGroup.notes,
            });
            groupIdMap.set(originalGroup.id, newGroup.id);
        }

        for (const exerciseData of originalWorkout.exercises) {
            const originalWorkoutExercise = exerciseData.workoutExercise;
            const originalSets = exerciseData.sets;

            let newGroupId: string | null = null;
            if (originalWorkoutExercise.groupId) {
                newGroupId = groupIdMap.get(originalWorkoutExercise.groupId) || null;
            }

            const newWorkoutExercise = await createWorkoutExercise({
                workoutId: newWorkout.id,
                exerciseId: originalWorkoutExercise.exerciseId,
                groupId: newGroupId,
                orderInGroup: originalWorkoutExercise.orderInGroup,
            });

            for (const originalSet of originalSets) {
                const newSetData: Omit<ExerciseSetInsert, 'id'> = {
                    workoutExerciseId: newWorkoutExercise.id,
                    order: originalSet.order,
                    type: originalSet.type,
                    round: originalSet.round,
                    weight: originalSet.weight,
                    reps: originalSet.reps,
                    time: originalSet.time,
                    distance: originalSet.distance,
                    rpe: originalSet.rpe,
                    restTime: originalSet.restTime,
                    restCompletedAt: null,
                    finalRestTime: null,
                    startedAt: null,
                    completedAt: null,
                };

                await createExerciseSet(newSetData);
            }
        }

        if (mode === 'now') {
            const newWorkoutExercises = await getWorkoutExercises(newWorkout.id);
            if (newWorkoutExercises.length > 0) {
                const firstNewExercise = newWorkoutExercises[0];
                const newSets = await getExerciseSets(firstNewExercise.id);
                if (newSets.length > 0) {
                    const firstNewSet = newSets.slice().sort((a, b) => a.order - b.order)[0];
                    if (firstNewSet) {
                        await updateExerciseSet(firstNewSet.id, { startedAt: now });
                    }
                }
            }
        }

        return newWorkout;
    } catch (error) {
        reportError(error, 'Failed to duplicate workout:');
        throw error;
    }
};

export interface WorkoutStats {
    trainingWeeks: number | null;
    trainingDays: number | null;
    trainingHours: number | null;
    workoutsCount: number | null;
    volume: number | null;
    exercisesCount: number | null;
    setsCount: number | null;
    repsCount: number | null;
}

export interface WorkoutDaySummary {
    workoutsCount: number;
    totalWorkoutDurationSeconds: number;
    totalSetTimeSeconds: number;
    totalRestTimeSeconds: number;
    volume: number;
    exercisesCount: number;
    setsCount: number;
    repsCount: number;
    healthStats: HealthStats | null;
    hasLocomotionMetricsSource: boolean;
}

export type StrengthRadarMuscleKey =
    | 'chest'
    | 'back'
    | 'legs'
    | 'shoulders'
    | 'core'
    | 'arms'
    | 'neck';

export type StrengthRadarMetricMap = Record<StrengthRadarMuscleKey, number>;

export interface StrengthRadarStats {
    periodDays: number;
    totalVolume: StrengthRadarMetricMap;
    workoutFrequency: StrengthRadarMetricMap;
    muscularLoad: StrengthRadarMetricMap;
}

export const strengthRadarMuscleOrder: readonly StrengthRadarMuscleKey[] = [
    'chest',
    'back',
    'legs',
    'shoulders',
    'core',
    'arms',
] as const;

const createEmptyStrengthRadarMetricMap = (): StrengthRadarMetricMap => ({
    chest: 0,
    back: 0,
    legs: 0,
    shoulders: 0,
    core: 0,
    arms: 0,
    neck: 0,
});

const createStrengthRadarSessionsMap = (): Record<StrengthRadarMuscleKey, Set<string>> => ({
    chest: new Set<string>(),
    back: new Set<string>(),
    legs: new Set<string>(),
    shoulders: new Set<string>(),
    core: new Set<string>(),
    arms: new Set<string>(),
    neck: new Set<string>(),
});

const mapTopLevelMuscleToRadar = (
    topLevelMuscle: string | null | undefined,
): StrengthRadarMuscleKey | null => {
    if (!topLevelMuscle) return null;

    if (topLevelMuscle === 'abs') {
        return 'core';
    }

    if (
        topLevelMuscle === 'chest' ||
        topLevelMuscle === 'back' ||
        topLevelMuscle === 'legs' ||
        topLevelMuscle === 'shoulders' ||
        topLevelMuscle === 'core' ||
        topLevelMuscle === 'arms' ||
        topLevelMuscle === 'neck'
    ) {
        return topLevelMuscle;
    }

    return null;
};

const PRIMARY_MUSCLE_WEIGHT = 1;
const SECONDARY_MUSCLE_WEIGHT = 0.5;

const resolveRadarMuscleWeightsFromExercise = ({
    primaryMuscleGroups,
    secondaryMuscleGroups,
}: {
    primaryMuscleGroups: ExerciseSelect['primaryMuscleGroups'];
    secondaryMuscleGroups: ExerciseSelect['secondaryMuscleGroups'];
}): Map<StrengthRadarMuscleKey, number> => {
    const resolved = new Map<StrengthRadarMuscleKey, number>();

    for (const topLevelMuscle of getTopLevelMuscleValues(primaryMuscleGroups) || []) {
        const radarMuscle = mapTopLevelMuscleToRadar(topLevelMuscle);
        if (radarMuscle) {
            resolved.set(radarMuscle, PRIMARY_MUSCLE_WEIGHT);
        }
    }

    for (const topLevelMuscle of getTopLevelMuscleValues(secondaryMuscleGroups) || []) {
        const radarMuscle = mapTopLevelMuscleToRadar(topLevelMuscle);
        if (!radarMuscle) continue;

        const currentWeight = resolved.get(radarMuscle) || 0;
        // Primary should always dominate when a muscle appears in both lists.
        resolved.set(radarMuscle, Math.max(currentWeight, SECONDARY_MUSCLE_WEIGHT));
    }

    return resolved;
};

const coerceNumber = (value: unknown): number => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === 'bigint') {
        return Number(value);
    }

    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
};

const roundToSingleDecimal = (value: number): number => Math.round(value * 10) / 10;
const roundToNearestInteger = (value: number): number => Math.round(value);

const getMinOrNull = (values: number[]): number | null => {
    if (values.length === 0) return null;
    return Math.min(...values);
};

const getMaxOrNull = (values: number[]): number | null => {
    if (values.length === 0) return null;
    return Math.max(...values);
};

const resolveZoneSeconds = (seconds: number | null, minutes: number | null): number | null => {
    if (seconds != null) return Math.max(0, roundToNearestInteger(seconds));
    if (minutes != null) return Math.max(0, roundToNearestInteger(minutes * 60));
    return null;
};

export const fetchWorkoutDaySummary = async (
    dateKey: string,
    weightUnits: 'kg' | 'lb' | null,
): Promise<WorkoutDaySummary> => {
    const user = await getCurrentUser();

    if (!user) {
        return {
            workoutsCount: 0,
            totalWorkoutDurationSeconds: 0,
            totalSetTimeSeconds: 0,
            totalRestTimeSeconds: 0,
            volume: 0,
            exercisesCount: 0,
            setsCount: 0,
            repsCount: 0,
            healthStats: null,
            hasLocomotionMetricsSource: false,
        };
    }

    const completedWorkouts = await db
        .select({
            id: workout.id,
            duration: workout.duration,
        })
        .from(workout)
        .where(
            and(
                eq(workout.userId, user.id),
                eq(workout.status, 'completed'),
                sql`date(${workout.completedAt} / 1000.0, 'unixepoch', 'localtime') = ${dateKey}`,
            ),
        );

    if (completedWorkouts.length === 0) {
        return {
            workoutsCount: 0,
            totalWorkoutDurationSeconds: 0,
            totalSetTimeSeconds: 0,
            totalRestTimeSeconds: 0,
            volume: 0,
            exercisesCount: 0,
            setsCount: 0,
            repsCount: 0,
            healthStats: null,
            hasLocomotionMetricsSource: false,
        };
    }

    const workoutIds = completedWorkouts.map((item) => item.id);

    const [exerciseTotals] = await db
        .select({
            exercisesCount: sql<number>`count(*)`,
        })
        .from(workoutExercise)
        .where(inArray(workoutExercise.workoutId, workoutIds));

    const [setTotals] = await db
        .select({
            setsCount: sql<number>`count(*)`,
            repsCount: sql<number>`coalesce(sum(coalesce(${exerciseSet.reps}, 0)), 0)`,
            totalSetTimeSeconds: sql<number>`
                coalesce(
                    sum(
                        case
                            when ${exerciseSet.startedAt} is not null
                                and ${exerciseSet.completedAt} is not null
                                and ${exerciseSet.completedAt} >= ${exerciseSet.startedAt}
                                then cast(
                                    (${exerciseSet.completedAt} - ${exerciseSet.startedAt}) / 1000
                                    as integer
                                )
                            when ${exerciseSet.time} is not null and ${exerciseSet.time} > 0
                                then ${exerciseSet.time}
                            else 0
                        end
                    ),
                    0
                )
            `,
            totalRestTimeSeconds: sql<number>`
                coalesce(
                    sum(
                        case
                            when ${exerciseSet.restTime} is null or ${exerciseSet.restTime} <= 0
                                then 0
                            when ${exerciseSet.finalRestTime} is not null
                                then max(0, ${exerciseSet.finalRestTime})
                            when ${exerciseSet.restCompletedAt} is not null
                                and ${exerciseSet.completedAt} is not null
                                and ${exerciseSet.restCompletedAt} >= ${exerciseSet.completedAt}
                                then max(
                                    0,
                                    min(
                                        ${exerciseSet.restTime},
                                        cast(
                                            (
                                                ${exerciseSet.restCompletedAt}
                                                - ${exerciseSet.completedAt}
                                            ) / 1000
                                            as integer
                                        )
                                    )
                                )
                            else 0
                        end
                    ),
                    0
                )
            `,
        })
        .from(exerciseSet)
        .innerJoin(workoutExercise, eq(exerciseSet.workoutExerciseId, workoutExercise.id))
        .where(
            and(inArray(workoutExercise.workoutId, workoutIds), isNotNull(exerciseSet.completedAt)),
        );

    const [volumeTotals] = await db
        .select({
            totalVolumeKg: sql<number>`
                coalesce(
                    sum(
                        (
                            case
                                when ${exerciseSet.weightUnits} = 'lb'
                                    then ${exerciseSet.weight} / 2.20462
                                else ${exerciseSet.weight}
                            end
                        ) *
                        (
                            case
                                when coalesce(${exercise.weightDoubleInStats}, 0) = 1
                                    then 2
                                else 1
                            end
                        ) *
                        ${exerciseSet.reps}
                    ),
                    0
                )
            `,
        })
        .from(exerciseSet)
        .innerJoin(workoutExercise, eq(exerciseSet.workoutExerciseId, workoutExercise.id))
        .innerJoin(exercise, eq(workoutExercise.exerciseId, exercise.id))
        .where(
            and(
                inArray(workoutExercise.workoutId, workoutIds),
                ne(exerciseSet.type, 'warmup'),
                isNotNull(exerciseSet.completedAt),
                isNotNull(exerciseSet.weight),
                isNotNull(exerciseSet.reps),
                sql`${exerciseSet.weight} != 0`,
                sql`${exerciseSet.reps} != 0`,
            ),
        );

    const locomotionRows = await db
        .select({
            category: exercise.category,
            tracking: exercise.tracking,
            distanceActivityType: exercise.distanceActivityType,
        })
        .from(workoutExercise)
        .innerJoin(exercise, eq(workoutExercise.exerciseId, exercise.id))
        .where(inArray(workoutExercise.workoutId, workoutIds));

    const totalWorkoutDurationSeconds = completedWorkouts.reduce((sum, item) => {
        return sum + (item.duration ?? 0);
    }, 0);

    const totalVolumeKg = coerceNumber(volumeTotals?.totalVolumeKg);

    const volumeInUserUnits =
        weightUnits === 'lb' ? convertWeight(totalVolumeKg, 'kg', 'lb') : totalVolumeKg;

    const hasLocomotionMetricsSource = locomotionRows.some((item) => {
        const tracking = Array.isArray(item.tracking) ? item.tracking : [];
        return (
            item.category === 'cardio' ||
            item.distanceActivityType != null ||
            tracking.includes('distance')
        );
    });

    return {
        workoutsCount: completedWorkouts.length,
        totalWorkoutDurationSeconds: coerceNumber(totalWorkoutDurationSeconds),
        totalSetTimeSeconds: coerceNumber(setTotals?.totalSetTimeSeconds),
        totalRestTimeSeconds: coerceNumber(setTotals?.totalRestTimeSeconds),
        volume: roundToSingleDecimal(volumeInUserUnits),
        exercisesCount: coerceNumber(exerciseTotals?.exercisesCount),
        setsCount: coerceNumber(setTotals?.setsCount),
        repsCount: coerceNumber(setTotals?.repsCount),
        healthStats: null,
        hasLocomotionMetricsSource,
    };
};

type WorkoutDayHealthRow = {
    workoutId: string;
} & Partial<HealthStats>;

const aggregateWorkoutDayHealthStats = (
    healthRows: readonly WorkoutDayHealthRow[],
    durationByWorkoutId: ReadonlyMap<string, number>,
    totalWorkoutDurationSeconds: number,
): HealthStats | null => {
    let avgHeartRateWeightedSum = 0;
    let avgHeartRateWeight = 0;
    let hasAvgHeartRate = false;
    const minHeartRateValues: number[] = [];
    const maxHeartRateValues: number[] = [];
    const mhrValues: number[] = [];

    let avgIntensityWeightedSum = 0;
    let avgIntensityWeight = 0;
    let hasAvgIntensity = false;
    const minIntensityValues: number[] = [];
    const maxIntensityValues: number[] = [];

    let totalActiveCalories = 0;
    let hasActiveCalories = false;
    let totalCalories = 0;
    let hasTotalCalories = false;

    let heartRateRecoverySum = 0;
    let heartRateRecoveryCount = 0;
    let heartRateRecoveryTwoMinutesSum = 0;
    let heartRateRecoveryTwoMinutesCount = 0;

    let totalActiveScore = 0;
    let hasActiveScore = false;
    let avgMetsWeightedSum = 0;
    let avgMetsWeight = 0;
    let hasAvgMets = false;

    let totalDistanceMeters = 0;
    let hasDistanceMeters = false;
    let paceWeightedSum = 0;
    let paceWeight = 0;
    let cadenceWeightedSum = 0;
    let cadenceWeight = 0;

    let totalZone1Seconds = 0;
    let hasZone1 = false;
    let totalZone2Seconds = 0;
    let hasZone2 = false;
    let totalZone3Seconds = 0;
    let hasZone3 = false;
    let totalZone4Seconds = 0;
    let hasZone4 = false;
    let totalZone5Seconds = 0;
    let hasZone5 = false;

    for (const row of healthRows) {
        const durationWeight = Math.max(1, durationByWorkoutId.get(row.workoutId) ?? 0);
        const distanceWeight =
            row.distanceMeters != null && row.distanceMeters > 0
                ? row.distanceMeters
                : durationWeight;

        if (row.avgHeartRate != null) {
            avgHeartRateWeightedSum += row.avgHeartRate * durationWeight;
            avgHeartRateWeight += durationWeight;
            hasAvgHeartRate = true;
        }
        if (row.minHeartRate != null) minHeartRateValues.push(row.minHeartRate);
        if (row.maxHeartRate != null) maxHeartRateValues.push(row.maxHeartRate);
        if (row.mhrUsed != null) mhrValues.push(row.mhrUsed);

        if (row.avgIntensity != null) {
            avgIntensityWeightedSum += row.avgIntensity * durationWeight;
            avgIntensityWeight += durationWeight;
            hasAvgIntensity = true;
        }
        if (row.minIntensity != null) minIntensityValues.push(row.minIntensity);
        if (row.maxIntensity != null) maxIntensityValues.push(row.maxIntensity);

        if (row.activeCalories != null) {
            totalActiveCalories += row.activeCalories;
            hasActiveCalories = true;
        }
        if (row.totalCalories != null) {
            totalCalories += row.totalCalories;
            hasTotalCalories = true;
        }

        if (row.heartRateRecovery != null) {
            heartRateRecoverySum += row.heartRateRecovery;
            heartRateRecoveryCount += 1;
        }
        if (row.heartRateRecoveryTwoMinutes != null) {
            heartRateRecoveryTwoMinutesSum += row.heartRateRecoveryTwoMinutes;
            heartRateRecoveryTwoMinutesCount += 1;
        }

        if (row.activeScore != null) {
            totalActiveScore += row.activeScore;
            hasActiveScore = true;
        }
        if (row.avgMets != null) {
            avgMetsWeightedSum += row.avgMets * durationWeight;
            avgMetsWeight += durationWeight;
            hasAvgMets = true;
        }

        if (row.distanceMeters != null) {
            totalDistanceMeters += row.distanceMeters;
            hasDistanceMeters = true;
        }
        if (row.paceSecondsPerKm != null) {
            paceWeightedSum += row.paceSecondsPerKm * distanceWeight;
            paceWeight += distanceWeight;
        }
        if (row.cadence != null) {
            cadenceWeightedSum += row.cadence * distanceWeight;
            cadenceWeight += distanceWeight;
        }

        const zone1Seconds = resolveZoneSeconds(row.zone1Seconds ?? null, null);
        if (zone1Seconds != null) {
            totalZone1Seconds += zone1Seconds;
            hasZone1 = true;
        }
        const zone2Seconds = resolveZoneSeconds(row.zone2Seconds ?? null, null);
        if (zone2Seconds != null) {
            totalZone2Seconds += zone2Seconds;
            hasZone2 = true;
        }
        const zone3Seconds = resolveZoneSeconds(row.zone3Seconds ?? null, null);
        if (zone3Seconds != null) {
            totalZone3Seconds += zone3Seconds;
            hasZone3 = true;
        }
        const zone4Seconds = resolveZoneSeconds(row.zone4Seconds ?? null, null);
        if (zone4Seconds != null) {
            totalZone4Seconds += zone4Seconds;
            hasZone4 = true;
        }
        const zone5Seconds = resolveZoneSeconds(row.zone5Seconds ?? null, null);
        if (zone5Seconds != null) {
            totalZone5Seconds += zone5Seconds;
            hasZone5 = true;
        }
    }

    const totalDurationForDayAverages = Math.max(0, totalWorkoutDurationSeconds);
    const avgHeartRateDenominator =
        totalDurationForDayAverages > 0 ? totalDurationForDayAverages : avgHeartRateWeight;
    const avgIntensityDenominator =
        totalDurationForDayAverages > 0 ? totalDurationForDayAverages : avgIntensityWeight;
    const avgMetsDenominator =
        totalDurationForDayAverages > 0 ? totalDurationForDayAverages : avgMetsWeight;

    const aggregated: HealthStats = {
        avgHeartRate:
            hasAvgHeartRate && avgHeartRateDenominator > 0
                ? roundToNearestInteger(avgHeartRateWeightedSum / avgHeartRateDenominator)
                : null,
        minHeartRate: getMinOrNull(minHeartRateValues),
        maxHeartRate: getMaxOrNull(maxHeartRateValues),
        mhrUsed: getMaxOrNull(mhrValues),
        avgIntensity:
            hasAvgIntensity && avgIntensityDenominator > 0
                ? roundToNearestInteger(avgIntensityWeightedSum / avgIntensityDenominator)
                : null,
        minIntensity: getMinOrNull(minIntensityValues),
        maxIntensity: getMaxOrNull(maxIntensityValues),
        activeCalories: hasActiveCalories ? roundToSingleDecimal(totalActiveCalories) : null,
        totalCalories: hasTotalCalories ? roundToSingleDecimal(totalCalories) : null,
        heartRateRecovery:
            heartRateRecoveryCount > 0
                ? roundToNearestInteger(heartRateRecoverySum / heartRateRecoveryCount)
                : null,
        heartRateRecoveryTwoMinutes:
            heartRateRecoveryTwoMinutesCount > 0
                ? roundToNearestInteger(
                      heartRateRecoveryTwoMinutesSum / heartRateRecoveryTwoMinutesCount,
                  )
                : null,
        activeScore: hasActiveScore ? roundToNearestInteger(totalActiveScore) : null,
        avgMets:
            hasAvgMets && avgMetsDenominator > 0
                ? roundToSingleDecimal(avgMetsWeightedSum / avgMetsDenominator)
                : null,
        distanceMeters: hasDistanceMeters ? roundToSingleDecimal(totalDistanceMeters) : null,
        paceSecondsPerKm:
            paceWeight > 0 ? roundToNearestInteger(paceWeightedSum / paceWeight) : null,
        cadence:
            cadenceWeight > 0 ? roundToNearestInteger(cadenceWeightedSum / cadenceWeight) : null,
        zone1Seconds: hasZone1 ? totalZone1Seconds : null,
        zone2Seconds: hasZone2 ? totalZone2Seconds : null,
        zone3Seconds: hasZone3 ? totalZone3Seconds : null,
        zone4Seconds: hasZone4 ? totalZone4Seconds : null,
        zone5Seconds: hasZone5 ? totalZone5Seconds : null,
    };

    const hasAnyHealthMetric = Object.values(aggregated).some((value) => value != null);
    return hasAnyHealthMetric ? aggregated : null;
};

export const fetchWorkoutDayHealthStats = async (dateKey: string): Promise<HealthStats | null> => {
    const user = await getCurrentUser();

    if (!user) return null;

    const completedWorkouts = await db
        .select({
            id: workout.id,
            duration: workout.duration,
            startedAt: workout.startedAt,
            completedAt: workout.completedAt,
        })
        .from(workout)
        .where(
            and(
                eq(workout.userId, user.id),
                eq(workout.status, 'completed'),
                sql`date(${workout.completedAt} / 1000.0, 'unixepoch', 'localtime') = ${dateKey}`,
            ),
        );

    if (completedWorkouts.length === 0) return null;

    const computedRows = await Promise.all(
        completedWorkouts.map(async (item) => {
            if (!item.startedAt || !item.completedAt) {
                return null;
            }

            const result = await computeWorkoutStats(item.startedAt, item.completedAt, {
                mhrFormula: user.mhrFormula,
                mhrManualValue: user.mhrManualValue,
                birthday: user.birthday,
            });

            return {
                workoutId: item.id,
                ...result.stats,
            } satisfies WorkoutDayHealthRow;
        }),
    );

    const healthRows = computedRows.filter((row): row is WorkoutDayHealthRow => row != null);
    if (healthRows.length === 0) return null;

    const totalWorkoutDurationSeconds = completedWorkouts.reduce(
        (sum, item) => sum + Math.max(0, item.duration ?? 0),
        0,
    );
    const durationByWorkoutId = new Map(
        completedWorkouts.map((item) => [item.id, Math.max(0, item.duration ?? 0)] as const),
    );

    return aggregateWorkoutDayHealthStats(
        healthRows,
        durationByWorkoutId,
        totalWorkoutDurationSeconds,
    );
};

// Custom query function to fetch detailed workout statistics
export const fetchWorkoutStats = async (weightUnits: 'kg' | 'lb' | null): Promise<WorkoutStats> => {
    const [completedTotals] = await db
        .select({
            workoutsCount: sql<number>`count(*)`,
            totalDurationSeconds: sql<number>`coalesce(sum(coalesce(${workout.duration}, 0)), 0)`,
            trainingDays: sql<number>`
                count(
                    distinct date(${workout.completedAt} / 1000.0, 'unixepoch')
                )
            `,
            trainingWeeks: sql<number>`
                count(
                    distinct (
                        strftime('%Y', ${workout.completedAt} / 1000.0, 'unixepoch', 'localtime')
                        || '-W' ||
                        cast(
                            (
                                cast(
                                    strftime(
                                        '%j',
                                        ${workout.completedAt} / 1000.0,
                                        'unixepoch',
                                        'localtime'
                                    ) as integer
                                ) + 6
                            ) / 7 as integer
                        )
                    )
                )
            `,
        })
        .from(workout)
        .where(eq(workout.status, 'completed'));

    const workoutsCount = coerceNumber(completedTotals?.workoutsCount);

    if (workoutsCount === 0) {
        return {
            trainingWeeks: null,
            trainingDays: null,
            trainingHours: null,
            workoutsCount: null,
            volume: null,
            exercisesCount: null,
            setsCount: null,
            repsCount: null,
        };
    }

    const [exerciseTotals] = await db
        .select({
            exercisesCount: sql<number>`count(${workoutExercise.id})`,
        })
        .from(workoutExercise)
        .innerJoin(workout, eq(workoutExercise.workoutId, workout.id))
        .innerJoin(exercise, eq(workoutExercise.exerciseId, exercise.id))
        .where(eq(workout.status, 'completed'));

    const [setTotals] = await db
        .select({
            setsCount: sql<number>`count(*)`,
            repsCount: sql<number>`coalesce(sum(${exerciseSet.reps}), 0)`,
            totalVolumeKg: sql<number>`
                coalesce(
                    sum(
                        (
                            case
                                when ${exerciseSet.weightUnits} = 'lb'
                                    then ${exerciseSet.weight} / 2.20462
                                else ${exerciseSet.weight}
                            end
                        ) *
                        (
                            case
                                when coalesce(${exercise.weightDoubleInStats}, 0) = 1
                                    then 2
                                else 1
                            end
                        ) *
                        ${exerciseSet.reps}
                    ),
                    0
                )
            `,
        })
        .from(exerciseSet)
        .innerJoin(workoutExercise, eq(exerciseSet.workoutExerciseId, workoutExercise.id))
        .innerJoin(workout, eq(workoutExercise.workoutId, workout.id))
        .innerJoin(exercise, eq(workoutExercise.exerciseId, exercise.id))
        .where(
            and(
                eq(workout.status, 'completed'),
                ne(exerciseSet.type, 'warmup'),
                isNotNull(exerciseSet.completedAt),
                isNotNull(exerciseSet.weight),
                isNotNull(exerciseSet.reps),
                sql`${exerciseSet.weight} != 0`,
                sql`${exerciseSet.reps} != 0`,
            ),
        );

    const trainingHours = roundToSingleDecimal(
        coerceNumber(completedTotals?.totalDurationSeconds) / 3600,
    );
    const totalVolumeKg = coerceNumber(setTotals?.totalVolumeKg);
    const volumeInUserUnits =
        weightUnits === 'lb' ? convertWeight(totalVolumeKg, 'kg', 'lb') : totalVolumeKg;
    const volume = roundToSingleDecimal(volumeInUserUnits);

    return {
        trainingWeeks: coerceNumber(completedTotals?.trainingWeeks),
        trainingDays: coerceNumber(completedTotals?.trainingDays),
        trainingHours,
        workoutsCount,
        volume,
        exercisesCount: coerceNumber(exerciseTotals?.exercisesCount),
        setsCount: coerceNumber(setTotals?.setsCount),
        repsCount: coerceNumber(setTotals?.repsCount),
    };
};

export const fetchStrengthRadarStats = async (
    weightUnits: 'kg' | 'lb' | null,
    periodDays = 30,
): Promise<StrengthRadarStats> => {
    const user = await getCurrentUser();

    const emptyResult: StrengthRadarStats = {
        periodDays,
        totalVolume: createEmptyStrengthRadarMetricMap(),
        workoutFrequency: createEmptyStrengthRadarMetricMap(),
        muscularLoad: createEmptyStrengthRadarMetricMap(),
    };

    if (!user) {
        return emptyResult;
    }

    const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const rows = await db
        .select({
            workoutId: workout.id,
            primaryMuscleGroups: exercise.primaryMuscleGroups,
            secondaryMuscleGroups: exercise.secondaryMuscleGroups,
            weightDoubleInStats: exercise.weightDoubleInStats,
            setWeight: exerciseSet.weight,
            setWeightUnits: exerciseSet.weightUnits,
            setReps: exerciseSet.reps,
        })
        .from(workout)
        .innerJoin(workoutExercise, eq(workoutExercise.workoutId, workout.id))
        .innerJoin(exercise, eq(workoutExercise.exerciseId, exercise.id))
        .innerJoin(exerciseSet, eq(exerciseSet.workoutExerciseId, workoutExercise.id))
        .where(
            and(
                eq(workout.userId, user.id),
                eq(workout.status, 'completed'),
                isNotNull(workout.completedAt),
                gte(workout.completedAt, periodStart),
                ne(exerciseSet.type, 'warmup'),
                isNotNull(exerciseSet.completedAt),
            ),
        );

    if (rows.length === 0) {
        return emptyResult;
    }

    const totalVolumeKgByMuscle = createEmptyStrengthRadarMetricMap();
    const sessionsByMuscle = createStrengthRadarSessionsMap();

    for (const row of rows) {
        const radarMuscleWeights = resolveRadarMuscleWeightsFromExercise({
            primaryMuscleGroups: row.primaryMuscleGroups,
            secondaryMuscleGroups: row.secondaryMuscleGroups,
        });
        if (radarMuscleWeights.size === 0) continue;

        for (const muscle of radarMuscleWeights.keys()) {
            sessionsByMuscle[muscle].add(row.workoutId);
        }

        const weight = row.setWeight ?? 0;
        const reps = row.setReps ?? 0;
        if (weight <= 0 || reps <= 0) continue;

        const convertedWeightKg =
            row.setWeightUnits === 'lb' ? convertWeight(weight, 'lb', 'kg') : weight;

        const setVolumeKg = convertedWeightKg * reps * (row.weightDoubleInStats ? 2 : 1);

        const totalMuscleWeight = Array.from(radarMuscleWeights.values()).reduce(
            (sum, muscleWeight) => sum + muscleWeight,
            0,
        );
        if (totalMuscleWeight <= 0) continue;

        for (const [muscle, muscleWeight] of radarMuscleWeights.entries()) {
            totalVolumeKgByMuscle[muscle] += setVolumeKg * (muscleWeight / totalMuscleWeight);
        }
    }

    const totalVolume = createEmptyStrengthRadarMetricMap();
    const workoutFrequency = createEmptyStrengthRadarMetricMap();
    const muscularLoad = createEmptyStrengthRadarMetricMap();

    for (const muscle of strengthRadarMuscleOrder) {
        const volumeInUserUnits =
            weightUnits === 'lb'
                ? convertWeight(totalVolumeKgByMuscle[muscle], 'kg', 'lb')
                : totalVolumeKgByMuscle[muscle];

        totalVolume[muscle] = roundToSingleDecimal(volumeInUserUnits);
        workoutFrequency[muscle] = sessionsByMuscle[muscle].size;
    }

    const totalVolumeAcrossMuscles = strengthRadarMuscleOrder.reduce(
        (sum, muscle) => sum + totalVolume[muscle],
        0,
    );

    for (const muscle of strengthRadarMuscleOrder) {
        muscularLoad[muscle] =
            totalVolumeAcrossMuscles > 0
                ? roundToSingleDecimal((totalVolume[muscle] / totalVolumeAcrossMuscles) * 100)
                : 0;
    }

    return {
        periodDays,
        totalVolume,
        workoutFrequency,
        muscularLoad,
    };
};
