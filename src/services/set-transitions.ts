import { ExerciseSetSelect } from '@/db/schema';
import { buildFinalizeRestUpdate, needsAutoFinalize } from '@/helpers/rest';
import { getOrderedExercisesFromDetails } from '@/helpers/workouts';
import { getExecutionOrderSets } from '@/helpers/execution-order';
import { useWorkoutWithDetails } from '@/hooks/use-workouts';

export type UpdateSetFn = (args: {
    id: string;
    updates: Partial<ExerciseSetSelect>;
}) => Promise<any>;

export const startSet = async (id: string, updateSet: UpdateSetFn, startTime?: Date) => {
    await updateSet({ id, updates: { startedAt: startTime || new Date() } });
};

export const completeSet = async (id: string, updateSet: UpdateSetFn) => {
    await updateSet({ id, updates: { completedAt: new Date() } });
};

/**
 * Starts the next set according to execution order (round-robin for supersets).
 * Uses getExecutionOrderSets to determine the correct next set.
 */
export const startNextSetOrExercise = async (
    completedSet: ExerciseSetSelect,
    workoutDetails: ReturnType<typeof useWorkoutWithDetails>['data'],
    updateSet: UpdateSetFn,
    navigateToExercise: (exerciseId: string) => void,
    currentExerciseId?: string,
    startTime?: Date,
): Promise<void> => {
    if (!workoutDetails) return;

    const orderedExercises = getOrderedExercisesFromDetails(workoutDetails);
    const executionOrder = getExecutionOrderSets(orderedExercises, workoutDetails);

    // Find the completed set in execution order
    const completedIdx = executionOrder.findIndex((eo) => eo.set.id === completedSet.id);
    if (completedIdx === -1) return;

    // Find next pending set after the completed one
    const nextEntry = executionOrder
        .slice(completedIdx + 1)
        .find((eo) => !eo.set.completedAt && !eo.set.startedAt);

    if (nextEntry) {
        await startSet(nextEntry.set.id, updateSet, startTime);

        // Navigate to the exercise containing the next set if different
        if (currentExerciseId !== nextEntry.exerciseId) {
            navigateToExercise(nextEntry.exerciseId);
        }
    }
    // If no next set found, workout is completed
};

/**
 * Simple check: find expired rest, auto-complete it, and start next set
 */
export const checkAndStartAfterRest = async (
    workoutDetails: ReturnType<typeof useWorkoutWithDetails>['data'],
    updateSet: UpdateSetFn,
    navigateToExercise: (exerciseId: string) => void,
    currentExerciseId?: string,
    orderedExercisesOverride?: ReturnType<typeof getOrderedExercisesFromDetails>,
): Promise<boolean> => {
    if (!workoutDetails) return false;

    const now = Date.now();
    const orderedExercises =
        orderedExercisesOverride ?? getOrderedExercisesFromDetails(workoutDetails);

    // Collect all sets with expired rest, find the most recent by completedAt
    let latestExpiredSet: ExerciseSetSelect | null = null;
    let latestCompletedAtMs = -1;
    let latestRestEndMs = 0;
    const staleExpiredSets: ExerciseSetSelect[] = [];

    for (const ex of orderedExercises) {
        for (const set of ex.sets) {
            if (!set.completedAt || !set.restTime || set.restTime <= 0) continue;
            if (set.restCompletedAt) continue;

            if (needsAutoFinalize(set, now)) {
                const completedAtMs = new Date(set.completedAt).getTime();
                if (completedAtMs > latestCompletedAtMs) {
                    if (latestExpiredSet) staleExpiredSets.push(latestExpiredSet);
                    latestCompletedAtMs = completedAtMs;
                    latestRestEndMs = completedAtMs + set.restTime * 1000;
                    latestExpiredSet = set;
                } else {
                    staleExpiredSets.push(set);
                }
            }
        }
    }

    // Neutralize stale phantom rests (e.g. retroactively applied restTime)
    // by finalizing with restTime=0 and restCompletedAt=completedAt
    for (const set of staleExpiredSets) {
        await updateSet({
            id: set.id,
            updates: { restTime: 0, restCompletedAt: new Date(set.completedAt!) },
        });
    }

    if (latestExpiredSet) {
        await updateSet({
            id: latestExpiredSet.id,
            updates: buildFinalizeRestUpdate(latestExpiredSet, latestRestEndMs),
        });

        const restEndTime = new Date(latestRestEndMs);
        await startNextSetOrExercise(
            latestExpiredSet,
            workoutDetails,
            updateSet,
            navigateToExercise,
            currentExerciseId,
            restEndTime,
        );
        return true;
    }

    return false;
};

export const finalizeRestIfDue = async (
    set: Pick<ExerciseSetSelect, 'id' | 'completedAt' | 'restTime' | 'restCompletedAt'>,
    updateSet: UpdateSetFn,
    atMs: number,
) => {
    if (!set.completedAt || !set.restTime || set.restTime <= 0 || set.restCompletedAt) return;
    if (needsAutoFinalize(set, atMs)) {
        const completedAtMs = new Date(set.completedAt).getTime();
        const restEndMs = completedAtMs + set.restTime * 1000;
        await updateSet({ id: set.id, updates: buildFinalizeRestUpdate(set, restEndMs) });
    }
};

export const finalizeRestNow = async (
    set: Pick<ExerciseSetSelect, 'id' | 'completedAt' | 'restTime' | 'restCompletedAt'>,
    updateSet: UpdateSetFn,
    atMs: number = Date.now(),
) => {
    if (!set.completedAt || !set.restTime || set.restTime <= 0 || set.restCompletedAt) return;
    await updateSet({ id: set.id, updates: buildFinalizeRestUpdate(set, atMs) });
};
