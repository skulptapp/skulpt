import { ExerciseSelect, ExerciseSetSelect, WorkoutSelect } from '@/db/schema';
import { WorkoutExerciseSelect, WorkoutGroupSelect } from '@/db/schema/workout';
import { OrderedExercise } from '@/helpers/workouts';
import { isRestActive } from '@/helpers/rest';
import { toMs } from '@/helpers/times';
import { getExecutionOrderSets } from '@/helpers/execution-order';

export type WorkoutDetailsLike = {
    workout: WorkoutSelect;
    exercises: {
        workoutExercise: WorkoutExerciseSelect;
        exercise: ExerciseSelect;
        sets: ExerciseSetSelect[];
    }[];
    groups?: { group: WorkoutGroupSelect; exercises: any[] }[];
};

export type TimerChainEvent =
    | {
          kind: 'work-timer';
          setId: string;
          workoutExerciseId: string;
          fireAtMs: number;
      }
    | {
          kind: 'rest-timer';
          /**
           * Rest belongs to the set that just ended (i.e. set.completedAt + restTime).
           * We use fromSetId for stable identifier/cancelation.
           */
          fromSetId: string;
          fireAtMs: number;
          nextSetId: string | null;
          nextWorkoutExerciseId: string | null;
      };

export type BuildTimerChainParams = {
    nowMs: number;
    workoutId: string;
    details: WorkoutDetailsLike | null | undefined;
    orderedExercises: OrderedExercise[];
    maxEvents: number;
};

type ExerciseInfo = {
    workoutExerciseId: string;
    exerciseName: string | null;
    timeOptions: ExerciseSelect['timeOptions'] | null;
};

const buildExerciseInfoMap = (details: WorkoutDetailsLike) => {
    const map = new Map<string, ExerciseInfo>();
    for (const item of details.exercises) {
        map.set(item.workoutExercise.id, {
            workoutExerciseId: item.workoutExercise.id,
            exerciseName: item.exercise.name ?? null,
            timeOptions: item.exercise.timeOptions ?? null,
        });
    }
    return map;
};

const buildSetToWorkoutExerciseId = (orderedExercises: OrderedExercise[]) => {
    const map = new Map<string, string>();
    for (const ex of orderedExercises) {
        for (const s of ex.sets) {
            map.set(s.id, ex.id);
        }
    }
    return map;
};

const findActiveRest = (orderedExercises: OrderedExercise[], nowMs: number) => {
    for (const ex of orderedExercises) {
        for (const set of ex.sets) {
            if (!set.completedAt) continue;
            if (!set.restTime || set.restTime <= 0) continue;
            if (set.restCompletedAt) continue;
            if (isRestActive(set, nowMs)) return set;
        }
    }
    return null;
};

const findActiveSet = (orderedExercises: OrderedExercise[]) => {
    for (const ex of orderedExercises) {
        for (const set of ex.sets) {
            if (set.startedAt && !set.completedAt) return set;
        }
    }
    return null;
};

export const buildWorkoutTimerChainIdentifier = (args: {
    workoutId: string;
    kind: TimerChainEvent['kind'];
    setId: string;
}) => {
    // Keep identifier stable so we can bulk-cancel/reschedule.
    return `workout:${args.workoutId}:${args.kind}:${args.setId}`;
};

/**
 * Build a future chain of timer-related notifications.
 *
 * Rules:
 * - Only timer sets (`timeOptions === 'timer'`) produce `work-timer` notifications.
 * - Rest notifications (`rest-timer`) are produced for timer sets that have `restTime > 0`.
 * - The chain stops as soon as the next set belongs to a non-timer exercise.
 * - Events are returned only if they are strictly in the future (`fireAtMs > nowMs`).
 */
export const buildTimerChainEvents = ({
    nowMs,
    workoutId,
    details,
    orderedExercises,
    maxEvents,
}: BuildTimerChainParams): TimerChainEvent[] => {
    if (!workoutId) return [];
    if (!details) return [];
    if (!orderedExercises.length) return [];
    if (maxEvents <= 0) return [];

    const exerciseInfoByWorkoutExerciseId = buildExerciseInfoMap(details);
    const setToWorkoutExerciseId = buildSetToWorkoutExerciseId(orderedExercises);

    // Use execution order (round-robin for supersets) instead of linear flattening
    const executionOrder = getExecutionOrderSets(orderedExercises, details);
    const flattenedSets = executionOrder.map((eo) => eo.set);
    // Also build a set-to-exerciseId map from execution order for correct lookups
    for (const eo of executionOrder) {
        setToWorkoutExerciseId.set(eo.set.id, eo.exerciseId);
    }

    const activeRestSet = findActiveRest(orderedExercises, nowMs);
    const activeSet = activeRestSet ? null : findActiveSet(orderedExercises);

    // If we're on a non-timer active set, we don't schedule anything.
    if (activeSet) {
        const weId = setToWorkoutExerciseId.get(activeSet.id);
        const exInfo = weId ? exerciseInfoByWorkoutExerciseId.get(weId) : undefined;
        if (exInfo?.timeOptions !== 'timer') return [];
    }

    const events: TimerChainEvent[] = [];

    const idxOf = (setId: string) => flattenedSets.findIndex((s) => s.id === setId);

    let cursorIdx: number | null = null;
    let cursorStartAtMs: number | null = null;

    if (activeRestSet) {
        const completedAtMs = toMs(activeRestSet.completedAt);
        if (completedAtMs == null) return [];
        const restEndMs = completedAtMs + activeRestSet.restTime! * 1000;
        cursorIdx = idxOf(activeRestSet.id) + 1; // next set after the resting one
        cursorStartAtMs = restEndMs;

        if (restEndMs > nowMs) {
            const nextSet = flattenedSets[cursorIdx] ?? null;
            const nextWeId = nextSet ? (setToWorkoutExerciseId.get(nextSet.id) ?? null) : null;
            events.push({
                kind: 'rest-timer',
                fromSetId: activeRestSet.id,
                fireAtMs: restEndMs,
                nextSetId: nextSet?.id ?? null,
                nextWorkoutExerciseId: nextWeId,
            });
        }
    } else if (activeSet) {
        const startedAtMs = toMs(activeSet.startedAt);
        const plannedSec = Math.max(0, activeSet.time ?? 0);
        if (startedAtMs == null || plannedSec <= 0) return [];

        const workEndMs = startedAtMs + plannedSec * 1000;
        cursorIdx = idxOf(activeSet.id) + 1;
        cursorStartAtMs = workEndMs + Math.max(0, activeSet.restTime ?? 0) * 1000;

        // Work end notification (strictly at end)
        if (workEndMs > nowMs) {
            const weId = setToWorkoutExerciseId.get(activeSet.id);
            if (weId) {
                events.push({
                    kind: 'work-timer',
                    setId: activeSet.id,
                    workoutExerciseId: weId,
                    fireAtMs: workEndMs,
                });
            }
        }

        // Rest end notification after this timer set (if restTime)
        const restSec = Math.max(0, activeSet.restTime ?? 0);
        if (restSec > 0) {
            const restEndMs = workEndMs + restSec * 1000;
            if (restEndMs > nowMs) {
                const nextSet = flattenedSets[cursorIdx] ?? null;
                const nextWeId = nextSet ? (setToWorkoutExerciseId.get(nextSet.id) ?? null) : null;
                events.push({
                    kind: 'rest-timer',
                    fromSetId: activeSet.id,
                    fireAtMs: restEndMs,
                    nextSetId: nextSet?.id ?? null,
                    nextWorkoutExerciseId: nextWeId,
                });
            }
        }
    } else {
        // No active timer set and no active rest -> nothing to chain.
        return [];
    }

    if (cursorIdx == null || cursorStartAtMs == null) {
        return events.slice(0, maxEvents);
    }

    // Walk forward using planned schedule (assume next set starts immediately when rest ends).
    let startAtMs = cursorStartAtMs;
    for (let i = cursorIdx; i < flattenedSets.length; i++) {
        if (events.length >= maxEvents) break;

        const set = flattenedSets[i];
        const weId = setToWorkoutExerciseId.get(set.id) ?? null;
        if (!weId) break;

        const exInfo = exerciseInfoByWorkoutExerciseId.get(weId);
        if (exInfo?.timeOptions !== 'timer') {
            // In a superset, timer and non-timer exercises may alternate — skip non-timers
            continue;
        }

        const plannedSec = Math.max(0, set.time ?? 0);
        if (plannedSec <= 0) continue;

        const workEndMs = startAtMs + plannedSec * 1000;
        if (workEndMs > nowMs) {
            events.push({
                kind: 'work-timer',
                setId: set.id,
                workoutExerciseId: weId,
                fireAtMs: workEndMs,
            });
        }

        const restSec = Math.max(0, set.restTime ?? 0);
        if (restSec > 0) {
            const restEndMs = workEndMs + restSec * 1000;
            if (restEndMs > nowMs) {
                const nextSet = flattenedSets[i + 1] ?? null;
                const nextWeId = nextSet ? (setToWorkoutExerciseId.get(nextSet.id) ?? null) : null;
                events.push({
                    kind: 'rest-timer',
                    fromSetId: set.id,
                    fireAtMs: restEndMs,
                    nextSetId: nextSet?.id ?? null,
                    nextWorkoutExerciseId: nextWeId,
                });
            }
            startAtMs = restEndMs;
        } else {
            startAtMs = workEndMs;
        }
    }

    return events
        .filter((e) => e.fireAtMs > nowMs)
        .sort((a, b) => a.fireAtMs - b.fireAtMs)
        .slice(0, maxEvents);
};
