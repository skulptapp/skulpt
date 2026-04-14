import { EventSubscription } from 'expo-modules-core';
import {
    WatchCommandPayload,
    WatchWorkoutState,
    ackPendingWatchCommand,
    clearPendingWatchContext,
    clearStoredWatchLifecycleCommand,
    drainPendingWatchCommands,
    getCurrentWatchCommand,
    isWatchSupported,
    isWatchPaired,
    isWatchReachable,
    updateWatchContext,
    sendWatchMessage,
    onWatchCommand,
} from '../../modules/watch-connectivity';
import { buildLiveActivityState } from './live-activity';
import { reportError } from '@/services/error-reporting';
import { normalizeSetType } from '@/helpers/set-type';

type BuildStateArgs = Parameters<typeof buildLiveActivityState>[0];

export const buildWatchState = (
    args: BuildStateArgs & {
        workoutName: string;
        playSounds?: boolean;
        heartRateMhr?: number | null;
        phoneHealthPermissionsGranted?: boolean;
    },
): WatchWorkoutState => {
    const laState = buildLiveActivityState(args);
    const currentSet = args.restingSet ?? args.activeSet;
    const lastCompletedSet = [...args.executionOrderSets]
        .map((entry) => entry.set)
        .reverse()
        .find((set) => !!set.completedAt);
    const currentTracking = Array.isArray(args.activeExercise?.exercise?.tracking)
        ? args.activeExercise?.exercise?.tracking.map(String)
        : undefined;
    const nextEntry = args.nextSet
        ? args.executionOrderSets.find((item) => item.set.id === args.nextSet?.id)
        : undefined;
    const nextExercise = nextEntry
        ? args.exercises.find((exercise) => exercise.id === nextEntry.exerciseId)
        : undefined;
    const nextTracking = Array.isArray(nextExercise?.exercise?.tracking)
        ? nextExercise?.exercise?.tracking.map(String)
        : undefined;

    return {
        ...laState,
        setType: normalizeSetType(currentSet?.type ?? lastCompletedSet?.type),
        tracking: currentTracking,
        distance: currentSet?.distance ?? undefined,
        distanceUnits: args.activeExercise?.exercise?.distanceUnits ?? undefined,
        timeSeconds: currentSet?.time ?? undefined,
        workoutId: args.runningWorkout.id,
        currentSetId: args.activeSet?.id ?? undefined,
        restSetId: args.restingSet?.id ?? undefined,
        nextSetId: args.nextSet?.id ?? undefined,
        nextTracking,
        nextDistance: args.nextSet?.distance ?? undefined,
        nextDistanceUnits: nextExercise?.exercise?.distanceUnits ?? undefined,
        workoutName: args.workoutName,
        playSounds: args.playSounds ?? false,
        heartRateMhr: args.heartRateMhr ?? undefined,
        restTimeSeconds: currentSet?.restTime ?? undefined,
        nextTimeOptions: nextExercise?.exercise?.timeOptions ?? undefined,
        nextTimeSeconds: args.nextSet?.time ?? undefined,
        nextRestTimeSeconds: args.nextSet?.restTime ?? undefined,
        phoneHealthPermissionsGranted: args.phoneHealthPermissionsGranted ?? false,
    };
};

export type WatchCommand = WatchCommandPayload;

const stateKey = (state: WatchWorkoutState): string =>
    JSON.stringify({
        ...state,
        weight: state.weight ?? null,
        weightUnits: state.weightUnits ?? null,
        reps: state.reps ?? null,
        tracking: state.tracking ?? null,
        distance: state.distance ?? null,
        distanceUnits: state.distanceUnits ?? null,
        timeSeconds: state.timeSeconds ?? null,
        timeOptions: state.timeOptions ?? null,
        workoutId: state.workoutId ?? null,
        currentSetId: state.currentSetId ?? null,
        restSetId: state.restSetId ?? null,
        nextSetId: state.nextSetId ?? null,
        nextExerciseName: state.nextExerciseName ?? null,
        nextSetNumber: state.nextSetNumber ?? null,
        nextWeight: state.nextWeight ?? null,
        nextWeightUnits: state.nextWeightUnits ?? null,
        nextReps: state.nextReps ?? null,
        nextTracking: state.nextTracking ?? null,
        nextDistance: state.nextDistance ?? null,
        nextDistanceUnits: state.nextDistanceUnits ?? null,
        playSounds: state.playSounds ?? false,
        heartRateMhr: state.heartRateMhr ?? null,
        restTimeSeconds: state.restTimeSeconds ?? null,
        nextTimeOptions: state.nextTimeOptions ?? null,
        nextTimeSeconds: state.nextTimeSeconds ?? null,
        nextRestTimeSeconds: state.nextRestTimeSeconds ?? null,
        phoneHealthPermissionsGranted: state.phoneHealthPermissionsGranted ?? false,
    });

export class WatchManager {
    private lastStateKey: string | null = null;
    private _isTrackingOnWatch = false;
    private trackedWatchWorkoutIds: string[] = [];
    private currentWorkoutId: string | undefined;
    private lastLifecycleEventAtMs = 0;
    private statePushChain: Promise<void> = Promise.resolve();
    private isEnding = false;
    private stateGeneration = 0;

    private markWorkoutTrackedOnWatch(workoutId?: string): void {
        if (!workoutId) return;
        if (this.trackedWatchWorkoutIds.includes(workoutId)) return;

        this.trackedWatchWorkoutIds.push(workoutId);

        // Keep only a small history for recent workouts.
        if (this.trackedWatchWorkoutIds.length > 20) {
            this.trackedWatchWorkoutIds = this.trackedWatchWorkoutIds.slice(-20);
        }
    }

    private wasWorkoutTrackedOnWatch(workoutId?: string): boolean {
        if (workoutId) {
            return this.trackedWatchWorkoutIds.includes(workoutId);
        }

        return this._isTrackingOnWatch;
    }

    private applyLifecyclePayload(payload: WatchCommand): boolean {
        if (payload.command !== 'watchSessionStarted' && payload.command !== 'watchSessionEnded') {
            return false;
        }

        if (this.currentWorkoutId) {
            if (!payload.workoutId || payload.workoutId !== this.currentWorkoutId) {
                return true;
            }
        } else {
            if (payload.workoutId) {
                return true;
            }

            if (payload.command === 'watchSessionStarted') {
                return true;
            }
        }

        const eventAtMs = Number(payload.eventAtMs ?? '0');
        if (Number.isFinite(eventAtMs) && eventAtMs > 0) {
            if (eventAtMs < this.lastLifecycleEventAtMs) {
                return true;
            }
            this.lastLifecycleEventAtMs = eventAtMs;
        }

        this._isTrackingOnWatch = payload.command === 'watchSessionStarted';
        if (this._isTrackingOnWatch) {
            this.markWorkoutTrackedOnWatch(payload.workoutId ?? this.currentWorkoutId);
        }
        return true;
    }

    private enqueueStatePush(task: () => Promise<void>): Promise<void> {
        const next = this.statePushChain.catch(() => undefined).then(task);
        this.statePushChain = next.then(
            () => undefined,
            () => undefined,
        );
        return next;
    }

    private async pushState(state: WatchWorkoutState): Promise<boolean> {
        let contextUpdated = false;

        try {
            contextUpdated = await updateWatchContext(state);
        } catch (error) {
            reportError(error, 'Failed to update watch context:');
        }

        let messageSent = false;

        if (isWatchReachable()) {
            try {
                messageSent = await sendWatchMessage(state);
            } catch (error) {
                reportError(error, 'Failed to send watch message:');
            }
        }

        return contextUpdated || messageSent;
    }

    isSupported(): boolean {
        return isWatchSupported();
    }

    hasPairedWatch(): boolean {
        return isWatchSupported() && isWatchPaired();
    }

    /** Whether the watch is actively tracking the current workout. */
    get isTrackingOnWatch(): boolean {
        return this._isTrackingOnWatch;
    }

    setCurrentWorkoutId(workoutId?: string): void {
        const didChange = this.currentWorkoutId !== workoutId;
        if (didChange) {
            this.lastLifecycleEventAtMs = 0;
            this._isTrackingOnWatch = false;
        }
        this.currentWorkoutId = workoutId;

        if (!workoutId) {
            this._isTrackingOnWatch = false;
            return;
        }

        if (didChange) {
            this.hydrateLifecycleState();
        }
    }

    async update(state: WatchWorkoutState): Promise<void> {
        if (!isWatchSupported()) return;
        if (this.isEnding) return;

        const generation = this.stateGeneration;
        const key = stateKey(state);
        if (key === this.lastStateKey) return;
        const previousKey = this.lastStateKey;
        this.lastStateKey = key;

        await this.enqueueStatePush(async () => {
            if (this.isEnding || generation !== this.stateGeneration) return;

            const didSend = await this.pushState(state);
            if (!didSend && !this.isEnding && generation === this.stateGeneration) {
                this.lastStateKey = previousKey;
            }
        });
    }

    async end(workoutId?: string): Promise<void> {
        if (!isWatchSupported()) return;

        const shouldExpectCompletionDelivery = this.wasWorkoutTrackedOnWatch(workoutId);
        const endState: WatchWorkoutState = {
            state: 'completed',
            workoutId,
            workoutName: '',
            exerciseName: '',
            setNumber: 0,
            totalSets: 0,
            setType: 'working',
            timerStartDate: Date.now(),
            timerEndDate: Date.now(),
            workoutStartDate: Date.now(),
            completedExercises: 0,
            totalExercises: 0,
        };

        const generation = this.stateGeneration;
        this.isEnding = true;
        this.lastStateKey = null;
        await this.enqueueStatePush(async () => {
            const retryDelaysMs = shouldExpectCompletionDelivery ? [0, 250, 1_000, 3_000] : [0];

            for (const delayMs of retryDelaysMs) {
                if (generation !== this.stateGeneration) {
                    return;
                }

                if (delayMs > 0) {
                    await new Promise((resolve) => setTimeout(resolve, delayMs));
                }

                if (generation !== this.stateGeneration) {
                    return;
                }

                const didSend = await this.pushState(endState);
                if (didSend) {
                    return;
                }
            }

            if (generation !== this.stateGeneration) {
                return;
            }

            if (!shouldExpectCompletionDelivery) {
                return;
            }

            reportError(
                new Error('Watch completion state was not delivered'),
                'Failed to deliver watch completion state:',
            );
        });
    }

    async drainPendingCommands(): Promise<WatchCommand[]> {
        if (!isWatchSupported()) return [];
        return drainPendingWatchCommands();
    }

    async ackCommand(commandId: string): Promise<void> {
        if (!isWatchSupported()) return;
        await ackPendingWatchCommand(commandId);
    }

    hydrateLifecycleState(): void {
        if (!isWatchSupported()) return;

        const payload = getCurrentWatchCommand();
        if (!payload) return;

        this.applyLifecyclePayload(payload);
    }

    onCommand(listener: (payload: WatchCommand) => void): EventSubscription | null {
        const subscription = onWatchCommand((payload) => {
            this.applyLifecyclePayload(payload);

            listener(payload);
        });

        try {
            this.hydrateLifecycleState();
        } catch (error) {
            reportError(error, 'Failed to hydrate watch lifecycle state:');
        }

        return subscription;
    }

    reset(): void {
        this.stateGeneration += 1;
        this.lastStateKey = null;
        this._isTrackingOnWatch = false;
        this.currentWorkoutId = undefined;
        this.lastLifecycleEventAtMs = 0;
        this.isEnding = false;
        this.trackedWatchWorkoutIds = [];
        if (isWatchSupported()) {
            try {
                clearPendingWatchContext();
                clearStoredWatchLifecycleCommand();
            } catch (error) {
                reportError(error, 'Failed to reset stored watch state:');
            }
        }
    }
}
