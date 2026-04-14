import { ExerciseSetSelect } from '@/db/schema';
import { OrderedExercise } from './workouts';

export type ExecutionOrderSet = {
    set: ExerciseSetSelect;
    exerciseId: string; // workoutExercise.id
};

/**
 * Minimal shape needed from workout details to determine group types.
 * Compatible with both full WorkoutDetails and WorkoutDetailsLike.
 */
type WorkoutDetailsForExecution = {
    groups?: { group: { id: string; type: string }; exercises?: any[] }[];
};

/**
 * Given ordered exercises and group metadata, produce a flat list of sets
 * in the correct execution order.
 *
 * For 'single' groups: linear (all sets of exercise A, then B)
 * For 'superset'/'triset'/'circuit' groups: round-robin by round
 *   Round 0: A-set0, B-set0, C-set0
 *   Round 1: A-set1, B-set1, C-set1
 *   etc.
 *
 * When exercises have different set counts, missing rounds are skipped.
 */
export const getExecutionOrderSets = (
    orderedExercises: OrderedExercise[],
    details: WorkoutDetailsForExecution | null | undefined,
): ExecutionOrderSet[] => {
    if (!orderedExercises.length || !details) return [];

    const groupTypeMap = new Map<string, string>();
    for (const g of details.groups || []) {
        groupTypeMap.set(g.group.id, g.group.type);
    }

    const result: ExecutionOrderSet[] = [];

    let i = 0;
    while (i < orderedExercises.length) {
        const ex = orderedExercises[i];
        const groupId = ex.groupId;
        const groupType = groupId ? (groupTypeMap.get(groupId) ?? 'single') : 'single';

        if (groupType === 'single' || !groupId) {
            // Linear: push all sets for this exercise
            for (const set of ex.sets) {
                result.push({ set, exerciseId: ex.id });
            }
            i++;
            continue;
        }

        // Collect all exercises in this group (consecutive with same groupId)
        const groupExercises: OrderedExercise[] = [];
        while (i < orderedExercises.length && orderedExercises[i].groupId === groupId) {
            groupExercises.push(orderedExercises[i]);
            i++;
        }

        // Determine hasRounds at group level — if ANY exercise in the group has rounds, use round-based matching for all
        const groupHasRounds = groupExercises.some((gex) => gex.sets.some((s) => s.round != null));

        // Round-robin: interleave by round number
        const allRounds = new Set<number>();
        for (const gex of groupExercises) {
            for (let idx = 0; idx < gex.sets.length; idx++) {
                allRounds.add(groupHasRounds ? (gex.sets[idx].round ?? idx) : idx);
            }
        }
        const sortedRounds = Array.from(allRounds).sort((a, b) => a - b);

        for (const round of sortedRounds) {
            for (const gex of groupExercises) {
                const set = getSetForRound(gex.sets, round, groupHasRounds);
                if (set) {
                    result.push({ set, exerciseId: gex.id });
                }
            }
        }
    }

    return result;
};

/**
 * Get the set for a given round number.
 * If the group has rounds, match by round field.
 * Otherwise, use positional index (0-based).
 */
function getSetForRound(
    sets: ExerciseSetSelect[],
    round: number,
    groupHasRounds: boolean,
): ExerciseSetSelect | undefined {
    if (groupHasRounds) {
        return sets.find((s) => s.round === round);
    }

    // Fallback: use position (sets are already sorted by order)
    return sets[round];
}
