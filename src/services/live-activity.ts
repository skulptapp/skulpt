import { ExerciseSetSelect, WorkoutSelect } from '@/db/schema';
import { ExecutionOrderSet } from '@/helpers/execution-order';
import { normalizeSetType } from '@/helpers/set-type';
import { WorkoutItem } from '@/screens/workouts/workout/types';
import {
    LiveActivityState,
    areActivitiesEnabled,
    endAllActivities,
    endWorkoutActivity,
    getRunningActivityId,
    startWorkoutActivity,
    updateWorkoutActivity,
} from '../../modules/live-activity';
import { Platform } from 'react-native';

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

const isIOS = Platform.OS === 'ios';

const toMs = (value: unknown): number => {
    if (!value) return Date.now();
    if (typeof value === 'number') return value;
    if (value instanceof Date) return value.getTime();
    const parsed = new Date(value as any).getTime();
    return Number.isNaN(parsed) ? Date.now() : parsed;
};

/**
 * Build the LiveActivityState from current workout context data.
 */
export const buildLiveActivityState = ({
    runningWorkout,
    activeExercise,
    activeSet,
    restingSet,
    nextSet,
    exercises,
    completedExercises,
    executionOrderSets,
}: {
    runningWorkout: WorkoutSelect;
    activeExercise: WorkoutItem | undefined;
    activeSet: ExerciseSetSelect | null;
    restingSet: ExerciseSetSelect | null;
    nextSet: ExerciseSetSelect | null;
    exercises: WorkoutItem[];
    completedExercises: WorkoutItem[];
    executionOrderSets: ExecutionOrderSet[];
}): LiveActivityState => {
    const workoutStartMs = toMs(runningWorkout.startedAt);

    // Determine state
    let state: LiveActivityState['state'] = 'ready';
    if (restingSet) {
        const hasNext = nextSet != null;
        state = hasNext ? 'resting' : 'resting_no_next';
    } else if (activeSet) {
        state = 'performing';
    }

    // Current exercise info
    const exerciseName = activeExercise?.name ?? '';
    const exerciseSets = activeExercise?.sets ?? [];
    const totalSets = exerciseSets.length;
    const timeOptions = activeExercise?.exercise?.timeOptions ?? null;

    // Current set info
    const currentSet = restingSet ?? activeSet;
    const setNumber = currentSet ? (currentSet.order ?? 0) + 1 : 0;
    const setType = normalizeSetType(currentSet?.type);

    // Timer anchors
    let timerStartMs = workoutStartMs;
    let timerEndMs = workoutStartMs + EIGHT_HOURS_MS;

    if (state === 'resting' || state === 'resting_no_next') {
        // Rest countdown
        const completedAtMs = toMs(restingSet!.completedAt);
        const restTimeSec = restingSet!.restTime ?? 0;
        timerStartMs = completedAtMs;
        timerEndMs = completedAtMs + restTimeSec * 1000;
    } else if (state === 'performing' && activeSet) {
        const startedAtMs = toMs(activeSet.startedAt);
        if (timeOptions === 'timer') {
            // Work timer countdown
            const plannedSec = Math.max(0, activeSet.time ?? 0);
            timerStartMs = startedAtMs;
            timerEndMs = startedAtMs + plannedSec * 1000;
        } else if (timeOptions === 'stopwatch') {
            // Stopwatch count-up
            timerStartMs = startedAtMs;
            timerEndMs = startedAtMs + EIGHT_HOURS_MS;
        } else {
            // Log exercise — show elapsed workout time
            timerStartMs = workoutStartMs;
            timerEndMs = workoutStartMs + EIGHT_HOURS_MS;
        }
    }
    // else: ready — show elapsed workout time (default values)

    // Next set info — resolve exercise name from the execution order
    let nextExerciseName: string | undefined;
    let nextSetNumber: number | undefined;
    let nextWeight: number | undefined;
    let nextWeightUnits: string | undefined;
    let nextReps: number | undefined;

    if (nextSet) {
        // Find which exercise the next set belongs to
        const nextEntry = executionOrderSets.find((eo) => eo.set.id === nextSet.id);
        if (nextEntry) {
            const nextExercise = exercises.find((ex) => ex.id === nextEntry.exerciseId);
            nextExerciseName = nextExercise?.name;
        }
        nextSetNumber = (nextSet.order ?? 0) + 1;
        nextWeight = nextSet.weight ?? undefined;
        nextWeightUnits = nextSet.weightUnits ?? undefined;
        nextReps = nextSet.reps ?? undefined;
    }

    // Workout exercise ID for deep link
    const workoutExerciseId = activeExercise?.id;

    return {
        state,
        exerciseName,
        setNumber,
        totalSets,
        setType,
        weight: currentSet?.weight ?? undefined,
        weightUnits: currentSet?.weightUnits ?? undefined,
        reps: currentSet?.reps ?? undefined,
        timeOptions: timeOptions ?? undefined,
        timerStartDate: timerStartMs,
        timerEndDate: timerEndMs,
        workoutStartDate: workoutStartMs,
        nextExerciseName,
        nextSetNumber,
        nextWeight,
        nextWeightUnits,
        nextReps,
        completedExercises: completedExercises.length,
        totalExercises: exercises.length,
        workoutExerciseId,
    };
};

/**
 * Serialize state for dedup comparison.
 * Includes timer anchor dates so that starting a new rest/work period triggers an update.
 */
const stateKey = (s: LiveActivityState): string =>
    `${s.state}:${s.exerciseName}:${s.setNumber}:${s.totalSets}:${s.weight}:${s.reps}:${s.nextExerciseName}:${s.nextSetNumber}:${s.completedExercises}:${s.timerStartDate}:${s.timerEndDate}`;

/**
 * Live Activity Manager — tracks the activity ID and deduplicates updates.
 */
export class LiveActivityManager {
    private activityId: string | null = null;
    private lastStateKey: string | null = null;
    private recovering = false;

    isEnabled(): boolean {
        if (!isIOS) return false;
        return areActivitiesEnabled();
    }

    async start(workoutName: string, workoutId: string, state: LiveActivityState): Promise<void> {
        if (!isIOS) return;

        // End any stale activities from previous sessions
        await endAllActivities();

        const id = await startWorkoutActivity(workoutName, workoutId, state);
        this.activityId = id;
        this.lastStateKey = stateKey(state);
    }

    async update(state: LiveActivityState): Promise<void> {
        if (!isIOS || !this.activityId) return;

        const key = stateKey(state);
        if (key === this.lastStateKey) return;

        this.lastStateKey = key;
        await updateWorkoutActivity(this.activityId, state);
    }

    async end(state: LiveActivityState, dismissImmediately = false): Promise<void> {
        if (!isIOS || !this.activityId) return;

        await endWorkoutActivity(this.activityId, state, dismissImmediately);
        this.activityId = null;
        this.lastStateKey = null;
    }

    /**
     * Recover from app restart: if there's a running activity but we lost the ref,
     * re-attach to it. If no activity is running but workout is active, start one.
     */
    async recover(runningWorkout: WorkoutSelect, state: LiveActivityState | null): Promise<void> {
        if (!isIOS || this.recovering) return;

        this.recovering = true;
        try {
            const existingId = getRunningActivityId();
            if (existingId) {
                this.activityId = existingId;
                if (state) await this.update(state);
                return;
            }

            // No running activity — start a fresh one (only if we have state to display)
            if (state) await this.start(runningWorkout.name, runningWorkout.id, state);
        } finally {
            this.recovering = false;
        }
    }

    hasActivity(): boolean {
        return this.activityId != null || this.recovering;
    }

    reset(): void {
        this.activityId = null;
        this.lastStateKey = null;
        this.recovering = false;
    }
}
