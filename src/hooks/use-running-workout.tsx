import {
    createContext,
    PropsWithChildren,
    useContext,
    FC,
    useCallback,
    useMemo,
    useState,
    useEffect,
    useRef,
} from 'react';
import { useGlobalSearchParams, router } from 'expo-router';
import { Alert, AppState, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { eq } from 'drizzle-orm';
import * as Linking from 'expo-linking';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import { db } from '@/db';
import { workout, ExerciseSetSelect, WorkoutSelect } from '@/db/schema';
import { getRemainingRestSeconds, isRestActive } from '@/helpers/rest';
import { resolveMhrFromProfile } from '@/helpers/heart-rate-zones';
import { normalizeSetType } from '@/helpers/set-type';
import { WorkoutItem } from '@/screens/workouts/workout/types';

import { useAudio } from './use-audio';
import {
    useCompleteWorkout,
    useStartWorkout,
    useUpdateExerciseSet,
    useWorkoutExercises,
    useWorkoutGroups,
    useWorkoutWithDetails,
} from './use-workouts';
import { useRestTicker } from './use-rest-ticker';
import { formatSet, getOrderedExercisesFromDetails } from '@/helpers/workouts';
import { getExecutionOrderSets } from '@/helpers/execution-order';
import {
    checkAndStartAfterRest,
    completeSet as completeSetTransition,
    finalizeRestNow,
    startNextSetOrExercise,
} from '@/services/set-transitions';
import { useNotifications } from '@/hooks/use-notifications';
import {
    buildTimerChainEvents,
    buildWorkoutTimerChainIdentifier,
    WorkoutDetailsLike,
} from '@/services/workout-notification-chain';
import { useUser } from './use-user';
import { LiveActivityManager, buildLiveActivityState } from '@/services/live-activity';
import { WatchCommand, WatchManager, buildWatchState } from '@/services/watch-connectivity';
import {
    readBiologicalSex,
    readDateOfBirth,
    requestHealthPermissions,
    saveWorkoutToHealth,
} from '@/services/health';
import { reportError, runInBackground } from '@/services/error-reporting';

type ProviderReturn = ReturnType<typeof useRunningWorkoutProvider>;

type RunningWorkoutStaticContextType = Pick<
    ProviderReturn,
    | 'runningWorkout'
    | 'runningWorkoutExercises'
    | 'runningWorkoutCompletedExercises'
    | 'startWorkout'
    | 'isPendingStartWorkout'
    | 'completeWorkout'
    | 'isPendingCompleteWorkout'
    | 'resetWatchSync'
>;

type RunningWorkoutTickerContextType = Pick<
    ProviderReturn,
    | 'runningWorkoutActiveExercise'
    | 'runningWorkoutActiveSet'
    | 'runningWorkoutRestingSet'
    | 'runningWorkoutNextSet'
    | 'restRemainingSeconds'
    | 'activeWorkTimerRemainingSeconds'
    | 'activeStopwatchElapsedSeconds'
    | 'elapsedSeconds'
    | 'elapsedFormated'
    | 'nowMs'
>;

const TIMER_WARNING_SECONDS = 4;

const staticContext = createContext<RunningWorkoutStaticContextType>(
    {} as RunningWorkoutStaticContextType,
);

const tickerContext = createContext<RunningWorkoutTickerContextType>(
    {} as RunningWorkoutTickerContextType,
);

const RunningWorkoutProvider: FC<PropsWithChildren> = ({ children }) => {
    const all = useRunningWorkoutProvider();

    const staticValue = useMemo<RunningWorkoutStaticContextType>(
        () => ({
            runningWorkout: all.runningWorkout,
            runningWorkoutExercises: all.runningWorkoutExercises,
            runningWorkoutCompletedExercises: all.runningWorkoutCompletedExercises,
            startWorkout: all.startWorkout,
            isPendingStartWorkout: all.isPendingStartWorkout,
            completeWorkout: all.completeWorkout,
            isPendingCompleteWorkout: all.isPendingCompleteWorkout,
            resetWatchSync: all.resetWatchSync,
        }),
        [
            all.runningWorkout,
            all.runningWorkoutExercises,
            all.runningWorkoutCompletedExercises,
            all.startWorkout,
            all.isPendingStartWorkout,
            all.completeWorkout,
            all.isPendingCompleteWorkout,
            all.resetWatchSync,
        ],
    );

    const tickerValue = useMemo<RunningWorkoutTickerContextType>(
        () => ({
            runningWorkoutActiveExercise: all.runningWorkoutActiveExercise,
            runningWorkoutActiveSet: all.runningWorkoutActiveSet,
            runningWorkoutRestingSet: all.runningWorkoutRestingSet,
            runningWorkoutNextSet: all.runningWorkoutNextSet,
            restRemainingSeconds: all.restRemainingSeconds,
            activeWorkTimerRemainingSeconds: all.activeWorkTimerRemainingSeconds,
            activeStopwatchElapsedSeconds: all.activeStopwatchElapsedSeconds,
            elapsedSeconds: all.elapsedSeconds,
            elapsedFormated: all.elapsedFormated,
            nowMs: all.nowMs,
        }),
        [
            all.runningWorkoutActiveExercise,
            all.runningWorkoutActiveSet,
            all.runningWorkoutRestingSet,
            all.runningWorkoutNextSet,
            all.restRemainingSeconds,
            all.activeWorkTimerRemainingSeconds,
            all.activeStopwatchElapsedSeconds,
            all.elapsedSeconds,
            all.elapsedFormated,
            all.nowMs,
        ],
    );

    return (
        <staticContext.Provider value={staticValue}>
            <tickerContext.Provider value={tickerValue}>{children}</tickerContext.Provider>
        </staticContext.Provider>
    );
};

const useRunningWorkout = () => {
    const s = useContext(staticContext);
    const t = useContext(tickerContext);
    return { ...s, ...t };
};

const useRunningWorkoutStatic = () => {
    return useContext(staticContext);
};

const useRunningWorkoutTicker = () => {
    return useContext(tickerContext);
};

const useRunningWorkoutProvider = () => {
    const { user, updateUser } = useUser();
    const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
    const [isTrackingOnWatch, setIsTrackingOnWatch] = useState(false);
    const [runtimeBirthday, setRuntimeBirthday] = useState<Date | null>(null);
    const { playWorkoutStart, playWorkoutStop } = useAudio();
    const { t } = useTranslation(['common']);
    const { playTimerEnd } = useAudio();
    const { workoutExerciseId } = useGlobalSearchParams<{
        workoutExerciseId?: string;
        workoutId?: string;
    }>();

    const playedSecondsRef = useRef<Set<number>>(new Set());
    const playedWorkTimerSetIdsRef = useRef<Set<string>>(new Set());
    const liveActivityRef = useRef(new LiveActivityManager());
    const watchManagerRef = useRef(new WatchManager());
    const lastRunningWorkoutIdRef = useRef<string | undefined>(undefined);
    const queuedWatchCommandIdsRef = useRef<Set<string>>(new Set());
    const watchCommandSequenceRef = useRef<Promise<void>>(Promise.resolve());
    const phoneHealthPermissionsGrantedRef = useRef(false);
    const processWatchCommandRef = useRef<(payload: WatchCommand) => Promise<void>>(
        async () => undefined,
    );
    const restAutoTransitionInFlightRef = useRef(false);
    const restAutoTransitionLastRunMsRef = useRef(0);

    const { data } = useLiveQuery(
        db.select().from(workout).where(eq(workout.status, 'in_progress')),
    );

    const { data: workoutExercises } = useWorkoutExercises(data[0]?.id);

    const { data: workoutDetails } = useWorkoutWithDetails(data[0]?.id);

    const { data: groups } = useWorkoutGroups(data[0]?.id);

    const start = useStartWorkout();

    const complete = useCompleteWorkout();

    const { nowMs } = useRestTicker(!!data[0]?.id, 1000);

    const { mutateAsync: updateSet } = useUpdateExerciseSet();

    const {
        scheduleRestTimerNotificationAt,
        scheduleWorkTimerNotificationAt,
        cancelNotification,
        cancelAllNotifications,
        isAppInBackground,
    } = useNotifications();

    const lastScheduledChainKeyRef = useRef<string | null>(null);

    useEffect(() => {
        const updateScreenLock = async () => {
            try {
                if (user?.screenAutoLock) {
                    await activateKeepAwakeAsync();
                } else {
                    deactivateKeepAwake();
                }
            } catch (error) {
                reportError(error, 'Failed to update screen keep awake:');
            }
        };

        runInBackground(updateScreenLock, 'Failed to update screen keep awake:');
    }, [user?.screenAutoLock]);

    const runningWorkout = useMemo(() => {
        if (data && data.length > 0) {
            return data[0];
        }
        return null;
    }, [data]);

    useEffect(() => {
        watchManagerRef.current.setCurrentWorkoutId(runningWorkout?.id);
        setIsTrackingOnWatch(watchManagerRef.current.isTrackingOnWatch);
    }, [runningWorkout?.id]);

    const orderedExercises = useMemo(
        () => getOrderedExercisesFromDetails(workoutDetails),
        [workoutDetails],
    );

    const executionOrderSets = useMemo(
        () => getExecutionOrderSets(orderedExercises, workoutDetails),
        [orderedExercises, workoutDetails],
    );

    const orderedSets = useMemo(() => executionOrderSets.map((eo) => eo.set), [executionOrderSets]);

    const hasPendingAutoRest = useMemo(
        () =>
            orderedSets.some(
                (set) =>
                    !!set.completedAt && !!set.restTime && set.restTime > 0 && !set.restCompletedAt,
            ),
        [orderedSets],
    );

    const runningWorkoutExercises = useMemo<WorkoutItem[]>(() => {
        if (!workoutExercises || !workoutDetails) return [];

        const exerciseMap = new Map(
            workoutDetails.exercises.map((item) => [item.exercise.id, item.exercise]),
        );
        const setsByWorkoutExerciseId = new Map<string, any[]>(
            (workoutDetails?.exercises || []).map((e) => [e.workoutExercise.id, e.sets]),
        );
        const groupOrderMap = new Map((groups || []).map((g) => [g.id, g.order]));
        return workoutExercises
            .map((we) => {
                const ex = exerciseMap.get(we.exerciseId);
                const groupOrder = we.groupId ? (groupOrderMap.get(we.groupId) ?? 0) : 0;
                const compositeOrder = groupOrder * 1000 + (we.orderInGroup ?? 0);
                return {
                    id: we.id,
                    name: ex?.name || we.exerciseId,
                    order: compositeOrder,
                    tracking: ex?.tracking,
                    sets: (setsByWorkoutExerciseId.get(we.id) || [])
                        .slice()
                        .sort((a, b) => a.order - b.order),
                    exercise: ex,
                };
            })
            .sort((a, b) => a.order - b.order);
    }, [workoutExercises, workoutDetails, groups]);

    const runningWorkoutExerciseMap = useMemo(
        () => new Map(runningWorkoutExercises.map((item) => [item.id, item])),
        [runningWorkoutExercises],
    );

    const { runningWorkoutActiveExercise, runningWorkoutActiveSet, runningWorkoutRestingSet } =
        useMemo<{
            runningWorkoutActiveExercise: WorkoutItem | undefined;
            runningWorkoutActiveSet: ExerciseSetSelect | null;
            runningWorkoutRestingSet: ExerciseSetSelect | null;
        }>(() => {
            const activeRestEntry = executionOrderSets.find(({ set }) => {
                if (!set.completedAt || !set.restTime || set.restTime <= 0 || set.restCompletedAt) {
                    return false;
                }

                return isRestActive(set, nowMs);
            });

            if (activeRestEntry) {
                return {
                    runningWorkoutActiveExercise: runningWorkoutExerciseMap.get(
                        activeRestEntry.exerciseId,
                    ),
                    runningWorkoutActiveSet: null,
                    runningWorkoutRestingSet: activeRestEntry.set,
                };
            }

            const activeEntry = executionOrderSets.find(
                ({ set }) => !!set.startedAt && !set.completedAt,
            );

            return {
                runningWorkoutActiveExercise: activeEntry
                    ? runningWorkoutExerciseMap.get(activeEntry.exerciseId)
                    : undefined,
                runningWorkoutActiveSet: activeEntry?.set ?? null,
                runningWorkoutRestingSet: null,
            };
        }, [executionOrderSets, nowMs, runningWorkoutExerciseMap]);

    const runningWorkoutCompletedExercises = useMemo(() => {
        return runningWorkoutExercises.filter((item) => {
            if (!item.sets || item.sets.length === 0) return false;

            return item.sets.every((set) => {
                if (!set.completedAt) return false;

                if (set.restTime && set.restTime > 0) {
                    return !!set.restCompletedAt;
                }

                return true;
            });
        });
    }, [runningWorkoutExercises]);

    const isWatchCommandStateReady = useMemo(() => {
        if (data === undefined) return false;
        if (!runningWorkout) return true;

        return workoutDetails != null && workoutExercises !== undefined;
    }, [data, runningWorkout, workoutDetails, workoutExercises]);

    const autoCompletedTimerSetIdsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        // Auto-complete active timer set even when user is not on the exercise screen.
        if (!workoutDetails?.exercises || !runningWorkoutActiveSet) return;

        const activeSet = runningWorkoutActiveSet;
        if (!activeSet.startedAt || activeSet.completedAt) return;
        if (autoCompletedTimerSetIdsRef.current.has(activeSet.id)) return;

        const container = workoutDetails.exercises.find((x) =>
            x.sets.some((s) => s.id === activeSet.id),
        );
        const timeOptions = container?.exercise?.timeOptions;
        if (timeOptions !== 'timer') return;

        const plannedSec = Math.max(0, activeSet.time ?? 0);
        if (plannedSec <= 0) return;

        const startedAtMs =
            activeSet.startedAt instanceof Date
                ? activeSet.startedAt.getTime()
                : typeof activeSet.startedAt === 'number'
                  ? activeSet.startedAt
                  : activeSet.startedAt
                    ? new Date(activeSet.startedAt as unknown as string).getTime()
                    : null;

        if (startedAtMs == null || Number.isNaN(startedAtMs)) return;

        const elapsedSec = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
        const remainingSec = Math.max(0, plannedSec - elapsedSec);

        if (remainingSec === 0) {
            autoCompletedTimerSetIdsRef.current.add(activeSet.id);
            const completedAt = new Date(startedAtMs + plannedSec * 1000);
            // For timer: if user stops early we store remaining in time (handled elsewhere).
            // If timer finishes naturally, keep planned time as-is (do not overwrite with 0).
            runInBackground(
                () => updateSet({ id: activeSet.id, updates: { completedAt } }),
                'Failed to auto-complete active timer set:',
            );
        }
    }, [nowMs, runningWorkoutActiveSet, updateSet, workoutDetails?.exercises]);

    const activeWorkTimerRemainingSeconds = useMemo(() => {
        if (!workoutDetails?.exercises || !runningWorkoutActiveSet) return null;

        const activeSet = runningWorkoutActiveSet;
        if (!activeSet.startedAt || activeSet.completedAt) return null;

        const container = workoutDetails.exercises.find((x) =>
            x.sets.some((s) => s.id === activeSet.id),
        );
        if (container?.exercise?.timeOptions !== 'timer') return null;

        const plannedSec = Math.max(0, activeSet.time ?? 0);
        if (plannedSec <= 0) return null;

        const startedAtMs =
            activeSet.startedAt instanceof Date
                ? activeSet.startedAt.getTime()
                : typeof activeSet.startedAt === 'number'
                  ? activeSet.startedAt
                  : activeSet.startedAt
                    ? new Date(activeSet.startedAt as unknown as string).getTime()
                    : null;

        if (startedAtMs == null || Number.isNaN(startedAtMs)) return null;

        const elapsedSec = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
        return Math.max(0, plannedSec - elapsedSec);
    }, [nowMs, runningWorkoutActiveSet, workoutDetails?.exercises]);

    const activeStopwatchElapsedSeconds = useMemo(() => {
        if (!workoutDetails?.exercises || !runningWorkoutActiveSet) return null;

        const activeSet = runningWorkoutActiveSet;
        if (!activeSet.startedAt || activeSet.completedAt) return null;

        const container = workoutDetails.exercises.find((x) =>
            x.sets.some((s) => s.id === activeSet.id),
        );
        if (container?.exercise?.timeOptions !== 'stopwatch') return null;

        const startedAtMs =
            activeSet.startedAt instanceof Date
                ? activeSet.startedAt.getTime()
                : typeof activeSet.startedAt === 'number'
                  ? activeSet.startedAt
                  : activeSet.startedAt
                    ? new Date(activeSet.startedAt as unknown as string).getTime()
                    : null;

        if (startedAtMs == null || Number.isNaN(startedAtMs)) return null;

        return Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
    }, [nowMs, runningWorkoutActiveSet, workoutDetails?.exercises]);

    useEffect(() => {
        // Start playing timer end sound 4 seconds before completion (foreground only).
        if (isAppInBackground) return;
        if (isTrackingOnWatch) return;
        if (!runningWorkoutActiveSet?.id) return;
        if (
            activeWorkTimerRemainingSeconds == null ||
            activeWorkTimerRemainingSeconds > TIMER_WARNING_SECONDS ||
            activeWorkTimerRemainingSeconds <= 0
        ) {
            return;
        }
        if (playedWorkTimerSetIdsRef.current.has(runningWorkoutActiveSet.id)) return;
        playedWorkTimerSetIdsRef.current.add(runningWorkoutActiveSet.id);
        playTimerEnd();
    }, [
        activeWorkTimerRemainingSeconds,
        isAppInBackground,
        isTrackingOnWatch,
        playTimerEnd,
        runningWorkoutActiveSet?.id,
    ]);

    const runningWorkoutNextSet = useMemo(() => {
        // If currently resting, next is the one after the resting set
        if (runningWorkoutRestingSet) {
            const restIdx = orderedSets.findIndex((s) => s.id === runningWorkoutRestingSet.id);
            if (restIdx !== -1) {
                return orderedSets.slice(restIdx + 1).find((set) => !set.completedAt) || null;
            }
            return null;
        }

        if (!runningWorkoutActiveSet) return null;

        const idx = orderedSets.findIndex((s) => s.id === runningWorkoutActiveSet.id);

        if (idx === -1) return null;

        return orderedSets.slice(idx + 1).find((set) => !set.completedAt) || null;
    }, [runningWorkoutRestingSet, runningWorkoutActiveSet, orderedSets]);

    const restRemainingSeconds = useMemo(() => {
        if (
            !runningWorkoutRestingSet?.completedAt ||
            !runningWorkoutRestingSet.restTime ||
            runningWorkoutRestingSet.restTime <= 0
        ) {
            return null;
        }

        return getRemainingRestSeconds(runningWorkoutRestingSet, nowMs);
    }, [runningWorkoutRestingSet, nowMs]);

    useEffect(() => {
        if (isTrackingOnWatch) return;

        if (
            restRemainingSeconds !== null &&
            restRemainingSeconds <= TIMER_WARNING_SECONDS &&
            restRemainingSeconds > 0 &&
            !playedSecondsRef.current.has(TIMER_WARNING_SECONDS)
        ) {
            playedSecondsRef.current.add(TIMER_WARNING_SECONDS);
            playTimerEnd();
        }

        if (restRemainingSeconds === null || restRemainingSeconds > TIMER_WARNING_SECONDS) {
            playedSecondsRef.current.clear();
        }
    }, [isTrackingOnWatch, restRemainingSeconds, playTimerEnd]);

    useEffect(() => {
        if (!workoutDetails || !hasPendingAutoRest) {
            return;
        }

        if (restAutoTransitionInFlightRef.current) {
            return;
        }

        const now = Date.now();
        if (now - restAutoTransitionLastRunMsRef.current < 1_000) {
            return;
        }

        restAutoTransitionLastRunMsRef.current = now;
        restAutoTransitionInFlightRef.current = true;

        runInBackground(async () => {
            try {
                await checkAndStartAfterRest(
                    workoutDetails,
                    updateSet,
                    (exerciseId: string) => {
                        if (workoutExerciseId) {
                            router.setParams({ workoutExerciseId: exerciseId });
                        }
                    },
                    workoutExerciseId,
                    orderedExercises,
                );
            } finally {
                restAutoTransitionInFlightRef.current = false;
            }
        }, 'Failed to auto-start next set after rest:');
    }, [hasPendingAutoRest, nowMs, orderedExercises, updateSet, workoutDetails, workoutExerciseId]);

    useEffect(() => {
        if (!data[0] || !data[0].startedAt) {
            setElapsedSeconds(0);
            return;
        }

        const compute = () => {
            const startedMs =
                data[0].startedAt instanceof Date
                    ? data[0].startedAt.getTime()
                    : new Date(data[0].startedAt as unknown as any).getTime();
            const delta = Math.max(0, Math.floor((Date.now() - startedMs) / 1000));
            setElapsedSeconds(delta);
        };

        compute();

        const intervalId = setInterval(compute, 1000);
        return () => clearInterval(intervalId);
    }, [data]);

    useEffect(() => {
        const MAX_EVENTS = 50;

        const cancelChainForWorkout = async (workoutId: string) => {
            // Cancel chain notifications for every set in the workout (both work/rest kinds).
            const cancelIds: string[] = [];
            for (const ex of orderedExercises) {
                for (const s of ex.sets) {
                    cancelIds.push(
                        buildWorkoutTimerChainIdentifier({
                            workoutId,
                            kind: 'work-timer',
                            setId: s.id,
                        }),
                        buildWorkoutTimerChainIdentifier({
                            workoutId,
                            kind: 'rest-timer',
                            setId: s.id,
                        }),
                    );
                }
            }
            await Promise.all(cancelIds.map((id) => cancelNotification(id)));
        };

        const reschedule = async () => {
            const workoutId = runningWorkout?.id;
            if (!workoutId || !workoutDetails) {
                lastScheduledChainKeyRef.current = null;
                return;
            }

            // Skip phone notifications when Apple Watch is tracking the workout —
            // the watch handles timer alerts and end-of-rest transitions directly.
            if (isTrackingOnWatch) {
                await cancelChainForWorkout(workoutId);
                lastScheduledChainKeyRef.current = null;
                return;
            }

            const now = Date.now();
            const events = buildTimerChainEvents({
                nowMs: now,
                workoutId,
                details: workoutDetails as unknown as WorkoutDetailsLike,
                orderedExercises,
                maxEvents: MAX_EVENTS,
            });

            // Include set tracking data (weight, reps, etc.) in the key so that
            // editing a future set's properties triggers rescheduling with the
            // updated notification body even when fireAtMs stays the same.
            const setDataFingerprint = orderedExercises
                .flatMap((ex) =>
                    ex.sets.map(
                        (s) =>
                            `${s.id}:${s.weight ?? ''}:${s.reps ?? ''}:${s.time ?? ''}:${s.distance ?? ''}:${s.restTime ?? ''}`,
                    ),
                )
                .join(',');

            const nextKey = `${workoutId}:${setDataFingerprint}:${events.map((e) => `${e.kind}:${'setId' in e ? e.setId : e.fromSetId}:${e.fireAtMs}`).join('|')}`;
            if (lastScheduledChainKeyRef.current === nextKey) return;

            lastScheduledChainKeyRef.current = nextKey;

            // Always cancel previous chain before scheduling a new one.
            await cancelChainForWorkout(workoutId);

            if (events.length === 0) return;

            const exerciseByWorkoutExerciseId = new Map(
                workoutDetails.exercises.map((x) => [x.workoutExercise.id, x]),
            );

            for (const event of events) {
                const fireDate = new Date(event.fireAtMs);
                if (event.kind === 'work-timer') {
                    const identifier = buildWorkoutTimerChainIdentifier({
                        workoutId,
                        kind: 'work-timer',
                        setId: event.setId,
                    });
                    const title = t('timeOption.timer', { ns: 'common' });
                    const body = exerciseByWorkoutExerciseId.get(event.workoutExerciseId)?.exercise
                        .name;
                    const deepLinkUrl = Linking.createURL(
                        `/workout/${workoutId}/${event.workoutExerciseId}`,
                    );
                    await scheduleWorkTimerNotificationAt(
                        fireDate,
                        { title, body: body ?? undefined },
                        identifier,
                        deepLinkUrl,
                    );
                    continue;
                }

                // rest-timer (rest ended)
                const identifier = buildWorkoutTimerChainIdentifier({
                    workoutId,
                    kind: 'rest-timer',
                    setId: event.fromSetId,
                });

                let title = t('pushes.workouts.ended.title', { ns: 'common' });
                let body: string | undefined = t('pushes.workouts.ended.body', { ns: 'common' });
                let nextExerciseId: string | null = null;

                if (event.nextWorkoutExerciseId && event.nextSetId) {
                    nextExerciseId = event.nextWorkoutExerciseId;
                    const exDetails = exerciseByWorkoutExerciseId.get(event.nextWorkoutExerciseId);
                    const nextSet = exDetails?.sets.find((s) => s.id === event.nextSetId) ?? null;
                    const exerciseName = exDetails?.exercise.name;
                    if (exDetails && nextSet && exerciseName) {
                        title = t('pushes.workouts.work.title', { ns: 'common' });
                        const setTypeShort = t(`setTypeShort.${normalizeSetType(nextSet.type)}`, {
                            ns: 'common',
                        });
                        body = t('pushes.workouts.work.body', {
                            ns: 'common',
                            exerciseName,
                            setNumber: `${(nextSet.order ?? 0) + 1}${setTypeShort}`,
                            setTracking: formatSet(exDetails.exercise, nextSet),
                        });
                    }
                }

                const deepLinkUrl =
                    nextExerciseId != null
                        ? Linking.createURL(`/workout/${workoutId}/${nextExerciseId}`)
                        : undefined;

                await scheduleRestTimerNotificationAt(
                    fireDate,
                    { title, body },
                    identifier,
                    deepLinkUrl,
                );
            }
        };

        runInBackground(reschedule, 'Failed to reschedule workout notifications:');
    }, [
        cancelNotification,
        isTrackingOnWatch,
        orderedExercises,
        runningWorkout?.id,
        scheduleRestTimerNotificationAt,
        scheduleWorkTimerNotificationAt,
        t,
        workoutDetails,
    ]);

    const elapsedFormated = useMemo(() => {
        const hours = Math.floor(elapsedSeconds / 3600);
        const minutes = Math.floor((elapsedSeconds % 3600) / 60);
        const seconds = elapsedSeconds % 60;
        const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }, [elapsedSeconds]);

    const currentHeartRateMhr = useMemo(
        () =>
            resolveMhrFromProfile({
                mhrFormula: user?.mhrFormula,
                mhrManualValue: user?.mhrManualValue,
                birthday: runtimeBirthday ?? user?.birthday ?? null,
            }),
        [runtimeBirthday, user?.birthday, user?.mhrFormula, user?.mhrManualValue],
    );

    const hydrateHealthProfileFromPermissions = useCallback(async () => {
        let resolvedBirthday = runtimeBirthday ?? user?.birthday ?? null;

        if (!resolvedBirthday) {
            const birthday = await readDateOfBirth();
            if (birthday) {
                resolvedBirthday = birthday;
                setRuntimeBirthday(birthday);

                try {
                    await updateUser({ birthday });
                } catch (error) {
                    reportError(error, 'Failed to persist birthday after health permissions:');
                }
            }
        }

        if (!user?.biologicalSex) {
            const biologicalSex = await readBiologicalSex();
            if (biologicalSex) {
                try {
                    await updateUser({ biologicalSex });
                } catch (error) {
                    reportError(
                        error,
                        'Failed to persist biological sex after health permissions:',
                    );
                }
            }
        }

        return resolvedBirthday;
    }, [runtimeBirthday, updateUser, user?.biologicalSex, user?.birthday]);

    const ensureWorkoutHealthReady = useCallback(async () => {
        try {
            const granted = await requestHealthPermissions();
            let resolvedBirthday = runtimeBirthday ?? user?.birthday ?? null;

            if (granted) {
                resolvedBirthday = await hydrateHealthProfileFromPermissions();
            }

            const resolvedMhr = resolveMhrFromProfile({
                mhrFormula: user?.mhrFormula,
                mhrManualValue: user?.mhrManualValue,
                birthday: resolvedBirthday,
            });

            return {
                permissionsGranted: granted,
                hasResolvedMhr: resolvedMhr != null,
            };
        } catch (error) {
            reportError(error, 'Failed to prepare workout health access:');
        }

        return {
            permissionsGranted: false,
            hasResolvedMhr: false,
        };
    }, [
        hydrateHealthProfileFromPermissions,
        runtimeBirthday,
        user?.birthday,
        user?.mhrFormula,
        user?.mhrManualValue,
    ]);

    const syncCompletedWorkoutHealth = useCallback(
        async (
            completedWorkout: Pick<
                WorkoutSelect,
                'id' | 'userId' | 'startedAt' | 'completedAt' | 'name'
            >,
            options?: {
                preferWatchSave?: boolean;
            },
        ) => {
            if (!completedWorkout.startedAt || !completedWorkout.completedAt) return;

            const shouldSkipPhoneHealthSave =
                Platform.OS === 'ios' && (options?.preferWatchSave ?? isTrackingOnWatch);

            if (
                Platform.OS === 'ios' &&
                !shouldSkipPhoneHealthSave &&
                watchManagerRef.current.hasPairedWatch()
            ) {
                await new Promise((resolve) => setTimeout(resolve, 1_200));
            }

            if (!shouldSkipPhoneHealthSave) {
                await saveWorkoutToHealth({
                    name: completedWorkout.name,
                    startDate: completedWorkout.startedAt,
                    endDate: completedWorkout.completedAt,
                });
            }
        },
        [isTrackingOnWatch],
    );

    useEffect(() => {
        if (runningWorkout?.id) {
            lastRunningWorkoutIdRef.current = runningWorkout.id;
        }
    }, [runningWorkout?.id]);

    // --- Live Activity: update on state changes ---
    // The stateKey dedup inside LiveActivityManager.update() prevents redundant native calls,
    // so it's safe to include broad dependencies here.
    useEffect(() => {
        if (!runningWorkout) return;

        const la = liveActivityRef.current;

        if (!runningWorkoutActiveExercise) {
            // No active exercise — either data not yet loaded or all sets completed.
            // Still send watch state so the watch knows all sets are done.
            if (!la.hasActivity()) {
                runInBackground(
                    () => la.recover(runningWorkout, null),
                    'Failed to recover Live Activity state:',
                );
            }

            const watchState = buildWatchState({
                runningWorkout,
                activeExercise: undefined,
                activeSet: null,
                restingSet: null,
                nextSet: null,
                exercises: runningWorkoutExercises,
                completedExercises: runningWorkoutCompletedExercises,
                executionOrderSets,
                workoutName: runningWorkout.name,
                playSounds: user?.playSounds ?? false,
                heartRateMhr: currentHeartRateMhr,
                phoneHealthPermissionsGranted: phoneHealthPermissionsGrantedRef.current,
            });
            runInBackground(
                () => watchManagerRef.current.update(watchState),
                'Failed to update watch state:',
            );
            return;
        }

        const state = buildLiveActivityState({
            runningWorkout,
            activeExercise: runningWorkoutActiveExercise,
            activeSet: runningWorkoutActiveSet,
            restingSet: runningWorkoutRestingSet,
            nextSet: runningWorkoutNextSet,
            exercises: runningWorkoutExercises,
            completedExercises: runningWorkoutCompletedExercises,
            executionOrderSets,
        });

        if (!la.hasActivity()) {
            runInBackground(
                () => la.recover(runningWorkout, state),
                'Failed to recover Live Activity state:',
            );
        } else {
            runInBackground(() => la.update(state), 'Failed to update Live Activity state:');
        }

        // Update Watch app
        const watchState = buildWatchState({
            runningWorkout,
            activeExercise: runningWorkoutActiveExercise,
            activeSet: runningWorkoutActiveSet,
            restingSet: runningWorkoutRestingSet,
            nextSet: runningWorkoutNextSet,
            exercises: runningWorkoutExercises,
            completedExercises: runningWorkoutCompletedExercises,
            executionOrderSets,
            workoutName: runningWorkout.name,
            playSounds: user?.playSounds ?? false,
            heartRateMhr: currentHeartRateMhr,
            phoneHealthPermissionsGranted: phoneHealthPermissionsGrantedRef.current,
        });
        runInBackground(
            () => watchManagerRef.current.update(watchState),
            'Failed to update watch state:',
        );
    }, [
        runningWorkout,
        runningWorkoutActiveExercise,
        runningWorkoutActiveSet,
        runningWorkoutRestingSet,
        runningWorkoutNextSet,
        runningWorkoutExercises,
        runningWorkoutCompletedExercises,
        executionOrderSets,
        currentHeartRateMhr,
        user?.playSounds,
    ]);

    // --- Live Activity & Watch: end when workout no longer in_progress ---
    useEffect(() => {
        const la = liveActivityRef.current;
        if (data === undefined || runningWorkout) {
            return;
        }

        phoneHealthPermissionsGrantedRef.current = false;

        // Cancel any stale scheduled timer notifications (rest/work) left over from
        // the workout that just ended or was deleted. The reschedule effect stops
        // producing new ones once runningWorkout is null, but previously scheduled
        // notifications are not automatically removed — do it explicitly here.
        runInBackground(
            cancelAllNotifications,
            'Failed to cancel notifications after workout ended:',
        );

        const completedWorkoutId = lastRunningWorkoutIdRef.current;
        if (completedWorkoutId) {
            lastRunningWorkoutIdRef.current = undefined;
            runInBackground(
                () => watchManagerRef.current.end(completedWorkoutId),
                'Failed to end watch session after workout left in-progress state:',
            );
        }

        if (la.hasActivity()) {
            runInBackground(
                () =>
                    la.end(
                        {
                            state: 'completed',
                            exerciseName: '',
                            setNumber: 0,
                            totalSets: 0,
                            setType: 'working',
                            timerStartDate: Date.now(),
                            timerEndDate: Date.now(),
                            workoutStartDate: Date.now(),
                            completedExercises: 0,
                            totalExercises: 0,
                        },
                        true,
                    ),
                'Failed to end Live Activity:',
            );
        }
    }, [cancelAllNotifications, data, runningWorkout]);

    // --- Watch: handle commands from Apple Watch ---
    const processWatchCommand = useCallback(
        async (payload: WatchCommand) => {
            if (!isWatchCommandStateReady) {
                return;
            }

            const ack = async () => {
                if (payload.commandId) {
                    await watchManagerRef.current.ackCommand(payload.commandId);
                }
            };

            if (!runningWorkout) {
                await ack();
                return;
            }

            if (payload.workoutId && payload.workoutId !== runningWorkout.id) {
                await ack();
                return;
            }

            const currentWorkoutState = runningWorkoutRestingSet
                ? runningWorkoutNextSet
                    ? 'resting'
                    : 'resting_no_next'
                : runningWorkoutActiveSet
                  ? 'performing'
                  : runningWorkoutNextSet
                    ? 'ready'
                    : 'completed';
            const expectedStateMatches =
                !payload.expectedState || payload.expectedState === currentWorkoutState;

            if (
                payload.command === 'completeSet' &&
                runningWorkoutActiveSet &&
                expectedStateMatches &&
                (!payload.setId || payload.setId === runningWorkoutActiveSet.id)
            ) {
                await completeSetTransition(runningWorkoutActiveSet.id, updateSet);
                const restTime = runningWorkoutActiveSet.restTime;
                if ((!restTime || restTime <= 0) && workoutDetails) {
                    await startNextSetOrExercise(
                        runningWorkoutActiveSet,
                        workoutDetails,
                        updateSet,
                        (exerciseId: string) => {
                            if (workoutExerciseId) {
                                router.setParams({
                                    workoutExerciseId: exerciseId,
                                });
                            }
                        },
                        workoutExerciseId,
                    );
                }
            } else if (
                payload.command === 'skipRest' &&
                runningWorkoutRestingSet &&
                expectedStateMatches &&
                (!payload.setId || payload.setId === runningWorkoutRestingSet.id)
            ) {
                await finalizeRestNow(runningWorkoutRestingSet, updateSet);
                if (workoutDetails) {
                    await startNextSetOrExercise(
                        runningWorkoutRestingSet,
                        workoutDetails,
                        updateSet,
                        (exerciseId: string) => {
                            if (workoutExerciseId) {
                                router.setParams({ workoutExerciseId: exerciseId });
                            }
                        },
                        workoutExerciseId,
                    );
                }
            } else if (
                payload.command === 'startSet' &&
                !runningWorkoutActiveSet &&
                !runningWorkoutRestingSet &&
                runningWorkoutNextSet &&
                expectedStateMatches &&
                (!payload.setId || payload.setId === runningWorkoutNextSet.id)
            ) {
                await updateSet({
                    id: runningWorkoutNextSet.id,
                    updates: { startedAt: new Date() },
                });
            } else if (payload.command === 'playTimerEnd') {
                await playTimerEnd();
            } else if (
                payload.command === 'restTimerDone' &&
                runningWorkoutRestingSet &&
                expectedStateMatches &&
                (!payload.setId || payload.setId === runningWorkoutRestingSet.id)
            ) {
                await finalizeRestNow(runningWorkoutRestingSet, updateSet);
                if (workoutDetails) {
                    await startNextSetOrExercise(
                        runningWorkoutRestingSet,
                        workoutDetails,
                        updateSet,
                        (exerciseId: string) => {
                            if (workoutExerciseId) {
                                router.setParams({ workoutExerciseId: exerciseId });
                            }
                        },
                        workoutExerciseId,
                    );
                }
            } else if (payload.command === 'finishWorkout') {
                const completedWorkout = await complete.mutateAsync(runningWorkout.id);
                await playWorkoutStop();
                runInBackground(
                    () => watchManagerRef.current.end(completedWorkout.id),
                    'Failed to end watch session after watch workout completion:',
                );
                await syncCompletedWorkoutHealth(completedWorkout, {
                    preferWatchSave: true,
                });
            }

            await ack();
        },
        [
            complete,
            isWatchCommandStateReady,
            playTimerEnd,
            playWorkoutStop,
            runningWorkout,
            runningWorkoutActiveSet,
            runningWorkoutNextSet,
            runningWorkoutRestingSet,
            syncCompletedWorkoutHealth,
            updateSet,
            workoutDetails,
            workoutExerciseId,
        ],
    );

    useEffect(() => {
        processWatchCommandRef.current = processWatchCommand;
    }, [processWatchCommand]);

    const enqueueWatchCommand = useCallback((payload: WatchCommand) => {
        const commandId = payload.commandId;

        if (commandId && queuedWatchCommandIdsRef.current.has(commandId)) {
            return;
        }

        if (commandId) {
            queuedWatchCommandIdsRef.current.add(commandId);
        }

        watchCommandSequenceRef.current = watchCommandSequenceRef.current
            .catch(() => undefined)
            .then(async () => {
                try {
                    await processWatchCommandRef.current(payload);
                } catch (error) {
                    reportError(error, 'Failed to process watch command:');
                } finally {
                    if (commandId) {
                        queuedWatchCommandIdsRef.current.delete(commandId);
                    }
                }
            });
    }, []);

    const drainPendingWatchCommandsToQueue = useCallback(async () => {
        if (!isWatchCommandStateReady) return;

        const pendingCommands = await watchManagerRef.current.drainPendingCommands();
        for (const payload of pendingCommands) {
            enqueueWatchCommand(payload);
        }
    }, [enqueueWatchCommand, isWatchCommandStateReady]);

    useEffect(() => {
        if (!isWatchCommandStateReady) return;

        runInBackground(
            drainPendingWatchCommandsToQueue,
            'Failed to hydrate pending watch commands:',
        );
    }, [drainPendingWatchCommandsToQueue, runningWorkout?.id, isWatchCommandStateReady]);

    useEffect(() => {
        if (!isWatchCommandStateReady) return;

        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState !== 'active') return;

            runInBackground(
                drainPendingWatchCommandsToQueue,
                'Failed to hydrate pending watch commands on app foreground:',
            );
        });

        return () => {
            subscription.remove();
        };
    }, [drainPendingWatchCommandsToQueue, isWatchCommandStateReady]);

    useEffect(() => {
        const sub = watchManagerRef.current.onCommand((payload) => {
            if (
                payload.command === 'watchSessionStarted' ||
                payload.command === 'watchSessionEnded'
            ) {
                setIsTrackingOnWatch(watchManagerRef.current.isTrackingOnWatch);
                return;
            }

            enqueueWatchCommand(payload);
        });
        setIsTrackingOnWatch(watchManagerRef.current.isTrackingOnWatch);

        return () => {
            sub?.remove();
        };
    }, [enqueueWatchCommand]);

    const startWorkout = useCallback(
        async (workoutId: string) => {
            if (runningWorkout || start.isPending) return;

            watchManagerRef.current.reset();
            setIsTrackingOnWatch(false);
            phoneHealthPermissionsGrantedRef.current = false;
            const healthReadiness = await ensureWorkoutHealthReady();
            phoneHealthPermissionsGrantedRef.current = healthReadiness.permissionsGranted;

            if (!healthReadiness.permissionsGranted) {
                // Alert.alert(
                //     'Health access incomplete',
                //     'Workout tracking can start, but heart-rate zones may stay empty until Health permissions are granted.',
                // );
            } else if (!healthReadiness.hasResolvedMhr) {
                // Alert.alert(
                //     'Max heart rate not configured',
                //     'Set your birthday or manual max heart rate in Heart Rate settings to enable heart-rate zones.',
                // );
            }

            try {
                await start.mutateAsync(workoutId);
                playWorkoutStart();
            } catch (error) {
                reportError(error, 'Failed to start workout:');
            }
        },
        [ensureWorkoutHealthReady, playWorkoutStart, runningWorkout, start],
    );

    const completeWorkout = useCallback(() => {
        if (!runningWorkout) return;
        Alert.alert(
            t('completeWorkout', { ns: 'common' }),
            undefined,
            [
                {
                    text: t('cancel', { ns: 'common' }),
                    style: 'cancel',
                },
                {
                    text: t('complete', { ns: 'common' }),
                    onPress: () => {
                        watchManagerRef.current.hydrateLifecycleState();
                        const preferWatchSave = watchManagerRef.current.isTrackingOnWatch;
                        setIsTrackingOnWatch(preferWatchSave);
                        complete.mutate(runningWorkout.id, {
                            onSuccess: (data) => {
                                playWorkoutStop();
                                runInBackground(
                                    () =>
                                        syncCompletedWorkoutHealth(data, {
                                            preferWatchSave,
                                        }),
                                    'Failed to sync completed workout health after workout completion:',
                                );
                                runInBackground(
                                    () => watchManagerRef.current.end(data.id),
                                    'Failed to end watch session after workout completion:',
                                );
                            },
                        });
                    },
                },
            ],
            {
                cancelable: true,
            },
        );
    }, [complete, playWorkoutStop, runningWorkout, syncCompletedWorkoutHealth, t]);

    const resetWatchSync = useCallback(() => {
        watchManagerRef.current.reset();
        setIsTrackingOnWatch(false);
        phoneHealthPermissionsGrantedRef.current = false;
    }, []);

    return {
        runningWorkout,
        runningWorkoutExercises,
        runningWorkoutActiveExercise,
        runningWorkoutActiveSet,
        runningWorkoutRestingSet,
        runningWorkoutCompletedExercises,
        runningWorkoutNextSet,
        activeWorkTimerRemainingSeconds,
        activeStopwatchElapsedSeconds,
        elapsedSeconds,
        elapsedFormated,
        restRemainingSeconds,
        nowMs,
        startWorkout,
        isPendingStartWorkout: start.isPending,
        completeWorkout,
        isPendingCompleteWorkout: complete.isPending,
        resetWatchSync,
    };
};

export {
    RunningWorkoutProvider,
    useRunningWorkout,
    useRunningWorkoutStatic,
    useRunningWorkoutTicker,
};
