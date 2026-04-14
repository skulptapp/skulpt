import { FC, useCallback, useMemo, useState } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import {
    Plus,
    ClockFading,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Play,
    Check,
    Square,
} from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import {
    useCreateExerciseSet,
    useUpdateExerciseSet,
    useWorkoutWithDetails,
} from '@/hooks/use-workouts';
import { ExerciseSetSelect } from '@/db/schema';
import { Pressable } from '@/components/primitives/pressable';
import { useRestStore } from '@/stores/rest';
import { getWorkoutState, getButtonIcon } from '@/helpers/workout-simple';
import { getOrderedExercisesFromDetails } from '@/helpers/workouts';
import { getExecutionOrderSets } from '@/helpers/execution-order';
import { startNextSetOrExercise } from '@/services/set-transitions';
import { useAnalytics } from '@/hooks/use-analytics';
import { useRunningWorkoutStatic } from '@/hooks/use-running-workout';

interface ActionsProps {
    workoutDetails: ReturnType<typeof useWorkoutWithDetails>['data'];
    workoutExerciseId: string;
    sets?: ExerciseSetSelect[];
    setActionsHeight: (height: number) => void;
}

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: theme.space(4) + rt.insets.bottom,
        paddingTop: theme.space(4),
        gap: theme.space(2),
    },
    wrapper: {
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    actionContainer: {
        flexDirection: 'row',
        gap: theme.space(6),
    },
    leftContainer: {
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingLeft: theme.space(2),
    },
    centerContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    rightContainer: {
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingRight: theme.space(2),
    },
    actionButtonContainer: {
        width: theme.space(10),
        height: theme.space(10),
        backgroundColor: theme.colors.background,
        borderRadius: theme.radius.full,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mainButtonContainer: {
        backgroundColor: theme.colors.lime[400],
        width: theme.space(16),
        height: theme.space(16),
    },
    chevronDownIcon: {
        marginTop: theme.space(0.5),
    },
    chevronLeftIcon: {
        marginRight: theme.space(0.5),
    },
    checkIcon: {
        marginTop: theme.space(0.5),
    },
}));

export const Actions: FC<ActionsProps> = ({
    workoutDetails,
    workoutExerciseId,
    sets,
    setActionsHeight,
}) => {
    const { theme } = useUnistyles();
    const { track } = useAnalytics();
    const { startWorkout } = useRunningWorkoutStatic();

    const [isMainActionPending, setIsMainActionPending] = useState(false);

    const { open } = useRestStore(
        useShallow((state) => ({
            open: state.open,
        })),
    );

    const { mutateAsync: createSet } = useCreateExerciseSet();
    const { mutateAsync: updateSet } = useUpdateExerciseSet();

    const orderedExercises = useMemo(
        () => getOrderedExercisesFromDetails(workoutDetails),
        [workoutDetails],
    );

    const sortedSets = useMemo(() => {
        return (sets || []).slice().sort((a, b) => a.order - b.order);
    }, [sets]);

    const currentIndex = useMemo(
        () => orderedExercises.findIndex((x) => x.id === workoutExerciseId),
        [orderedExercises, workoutExerciseId],
    );

    const executionOrderSets = useMemo(
        () => getExecutionOrderSets(orderedExercises, workoutDetails),
        [orderedExercises, workoutDetails],
    );

    const workoutStatus = workoutDetails?.workout.status;
    const workoutInfo = getWorkoutState(orderedExercises, executionOrderSets);

    const currentExercise = useMemo(() => {
        return workoutDetails?.exercises.find((x) => x.workoutExercise.id === workoutExerciseId)
            ?.exercise;
    }, [workoutDetails?.exercises, workoutExerciseId]);

    const handleAddSet = useCallback(async () => {
        if (!workoutExerciseId) return;

        // Determine if current exercise is in a non-single group
        const currentWe = workoutDetails?.exercises.find(
            (e) => e.workoutExercise.id === workoutExerciseId,
        );
        const groupId = currentWe?.workoutExercise.groupId;
        const group = workoutDetails?.groups.find((g) => g.group.id === groupId);
        const groupType = group?.group.type ?? 'single';

        if (groupType !== 'single' && groupId) {
            // Superset/triset/circuit: add one set to ALL exercises in the group
            const groupExercises = orderedExercises.filter((ex) => ex.groupId === groupId);

            // Find the max round across all exercises in the group
            let maxRound = -1;
            for (const gex of groupExercises) {
                for (const s of gex.sets) {
                    const r = s.round ?? gex.sets.indexOf(s);
                    if (r > maxRound) maxRound = r;
                }
            }
            const nextRound = maxRound + 1;

            await Promise.all(
                groupExercises.map((gex) => {
                    const exSets = gex.sets.slice().sort((a, b) => a.order - b.order);
                    const nextOrder = exSets.length > 0 ? exSets[exSets.length - 1].order + 1 : 0;
                    const prev = exSets[exSets.length - 1];

                    return createSet({
                        workoutExerciseId: gex.id,
                        order: nextOrder,
                        type: prev?.type ?? 'working',
                        weight: prev?.weight ?? null,
                        reps: prev?.reps ?? null,
                        time: prev?.time ?? null,
                        distance: prev?.distance ?? null,
                        restTime: prev?.restTime ?? null,
                        round: nextRound,
                    });
                }),
            );
        } else {
            // Single group: add set only to current exercise
            const nextOrder =
                sortedSets.length > 0 ? sortedSets[sortedSets.length - 1].order + 1 : 0;
            const prev = sortedSets[sortedSets.length - 1];

            await createSet({
                workoutExerciseId,
                order: nextOrder,
                type: prev?.type ?? 'working',
                weight: prev?.weight ?? null,
                reps: prev?.reps ?? null,
                time: prev?.time ?? null,
                distance: prev?.distance ?? null,
                restTime: prev?.restTime ?? null,
                round: prev?.round != null ? prev.round + 1 : sortedSets.length,
            });
        }
    }, [workoutExerciseId, sortedSets, createSet, workoutDetails, orderedExercises]);

    const handleRest = useCallback(() => {
        open({ workoutExerciseId, changeType: 'all_intervals' });
    }, [open, workoutExerciseId]);

    const handlePrevExercise = useCallback(() => {
        if (!workoutDetails?.workout) return;
        if (currentIndex <= 0) return;

        const prev = orderedExercises[currentIndex - 1];

        if (prev) {
            router.setParams({ workoutExerciseId: prev.id });
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    }, [workoutDetails?.workout, currentIndex, orderedExercises]);

    const handleNextExercise = useCallback(() => {
        if (!workoutDetails?.workout) return;
        if (currentIndex === -1) return;
        if (currentIndex >= orderedExercises.length - 1) return;

        const next = orderedExercises[currentIndex + 1];

        if (next) {
            router.setParams({ workoutExerciseId: next.id });
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    }, [workoutDetails?.workout, currentIndex, orderedExercises]);

    const isPrevDisabled = currentIndex <= 0;
    const isNextDisabled = currentIndex === -1 || currentIndex >= orderedExercises.length - 1;

    const handleMainAction = useCallback(async () => {
        if (!workoutDetails?.workout || isMainActionPending) return;

        setIsMainActionPending(true);
        try {
            // Planned workout - start it
            if (workoutStatus === 'planned') {
                await startWorkout(workoutDetails.workout.id);
                const firstExerciseId = orderedExercises[0]?.id;
                if (firstExerciseId && workoutExerciseId !== firstExerciseId) {
                    router.setParams({ workoutExerciseId: firstExerciseId });
                }
                return;
            }

            // Completed workout - go back
            if (workoutStatus === 'completed' || workoutInfo.state === 'completed') {
                router.back();
                return;
            }

            // Navigate to different exercise if needed
            if (workoutInfo.exerciseId && workoutInfo.exerciseId !== workoutExerciseId) {
                router.setParams({ workoutExerciseId: workoutInfo.exerciseId });
                return;
            }

            // Handle current state
            switch (workoutInfo.state) {
                case 'performing':
                    // Complete the set
                    if (workoutInfo.currentSet) {
                        if (currentExercise?.timeOptions === 'stopwatch') {
                            const startedAtMs =
                                workoutInfo.currentSet.startedAt instanceof Date
                                    ? workoutInfo.currentSet.startedAt.getTime()
                                    : typeof workoutInfo.currentSet.startedAt === 'number'
                                      ? workoutInfo.currentSet.startedAt
                                      : workoutInfo.currentSet.startedAt
                                        ? new Date(
                                              workoutInfo.currentSet.startedAt as unknown as string,
                                          ).getTime()
                                        : null;

                            const elapsedSec =
                                startedAtMs != null && !Number.isNaN(startedAtMs)
                                    ? Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))
                                    : Math.max(0, workoutInfo.currentSet.time ?? 0);

                            await updateSet({
                                id: workoutInfo.currentSet.id,
                                updates: { completedAt: new Date(), time: elapsedSec },
                            });
                        } else if (currentExercise?.timeOptions === 'timer') {
                            const plannedSec = Math.max(0, workoutInfo.currentSet.time ?? 0);
                            const startedAtMs =
                                workoutInfo.currentSet.startedAt instanceof Date
                                    ? workoutInfo.currentSet.startedAt.getTime()
                                    : typeof workoutInfo.currentSet.startedAt === 'number'
                                      ? workoutInfo.currentSet.startedAt
                                      : workoutInfo.currentSet.startedAt
                                        ? new Date(
                                              workoutInfo.currentSet.startedAt as unknown as string,
                                          ).getTime()
                                        : null;

                            const elapsedSec =
                                startedAtMs != null && !Number.isNaN(startedAtMs)
                                    ? Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))
                                    : 0;

                            const remainingSec =
                                plannedSec > 0 ? Math.max(0, plannedSec - elapsedSec) : plannedSec;

                            await updateSet({
                                id: workoutInfo.currentSet.id,
                                updates: { completedAt: new Date(), time: remainingSec },
                            });
                        } else {
                            await updateSet({
                                id: workoutInfo.currentSet.id,
                                updates: { completedAt: new Date() },
                            });
                        }

                        track('workout:exercise_set_complete', {
                            workoutExerciseId,
                            setType: workoutInfo.currentSet.type,
                        });

                        // If this set has no rest time, auto-start the next set
                        // (checkAndStartAfterRest only handles sets WITH rest time)
                        const restTime = workoutInfo.currentSet.restTime;
                        if (!restTime || restTime <= 0) {
                            await startNextSetOrExercise(
                                workoutInfo.currentSet,
                                workoutDetails,
                                updateSet,
                                (exerciseId) => {
                                    router.setParams({ workoutExerciseId: exerciseId });
                                },
                                workoutExerciseId,
                            );
                        }
                    }
                    break;

                case 'resting':
                    // Stop rest early and start next set
                    if (workoutInfo.activeRestSet) {
                        const nowMs = Date.now();
                        const completedAtMs = new Date(
                            workoutInfo.activeRestSet.completedAt!,
                        ).getTime();
                        const elapsedMs = nowMs - completedAtMs;
                        const elapsedSeconds = Math.floor(elapsedMs / 1000);
                        const plannedRestTime = workoutInfo.activeRestSet.restTime!;

                        // Calculate actual rest time, but cap it at planned rest time
                        const actualRestTime = Math.min(elapsedSeconds, plannedRestTime);

                        await updateSet({
                            id: workoutInfo.activeRestSet.id,
                            updates: {
                                restCompletedAt: new Date(),
                                finalRestTime: Math.max(0, actualRestTime),
                            },
                        });
                    }

                    if (workoutInfo.nextSet) {
                        await updateSet({
                            id: workoutInfo.nextSet.id,
                            updates: { startedAt: new Date() },
                        });

                        // Navigate to exercise containing the next set
                        const nextSetExercise = orderedExercises.find((ex) =>
                            ex.sets.some((s) => s.id === workoutInfo.nextSet!.id),
                        );
                        if (nextSetExercise && nextSetExercise.id !== workoutExerciseId) {
                            router.setParams({ workoutExerciseId: nextSetExercise.id });
                        }
                    }
                    break;

                case 'resting_no_next':
                    // Stop rest early, but don't start next set (none available)
                    if (workoutInfo.activeRestSet) {
                        const nowMs = Date.now();
                        const completedAtMs = new Date(
                            workoutInfo.activeRestSet.completedAt!,
                        ).getTime();
                        const elapsedMs = nowMs - completedAtMs;
                        const elapsedSeconds = Math.floor(elapsedMs / 1000);
                        const plannedRestTime = workoutInfo.activeRestSet.restTime!;

                        // Calculate actual rest time, but cap it at planned rest time
                        const actualRestTime = Math.min(elapsedSeconds, plannedRestTime);

                        await updateSet({
                            id: workoutInfo.activeRestSet.id,
                            updates: {
                                restCompletedAt: new Date(),
                                finalRestTime: Math.max(0, actualRestTime),
                            },
                        });
                    }
                    break;

                case 'ready':
                    // Start next set
                    if (workoutInfo.nextSet) {
                        await updateSet({
                            id: workoutInfo.nextSet.id,
                            updates: { startedAt: new Date() },
                        });

                        // Navigate to exercise containing the next set
                        const nextSetExercise = orderedExercises.find((ex) =>
                            ex.sets.some((s) => s.id === workoutInfo.nextSet!.id),
                        );
                        if (nextSetExercise && nextSetExercise.id !== workoutExerciseId) {
                            router.setParams({ workoutExerciseId: nextSetExercise.id });
                        }
                    }
                    break;
            }
        } finally {
            setIsMainActionPending(false);
        }
    }, [
        workoutStatus,
        orderedExercises,
        workoutExerciseId,
        workoutInfo,
        startWorkout,
        updateSet,
        currentExercise?.timeOptions,
        isMainActionPending,
        workoutDetails,
        track,
    ]);

    const mainIcon = useMemo(() => {
        return getButtonIcon(workoutInfo, workoutExerciseId, workoutStatus);
    }, [workoutInfo, workoutStatus, workoutExerciseId]);

    return (
        <Box
            style={styles.container}
            onLayout={(e) => setActionsHeight(Math.round(e.nativeEvent.layout.height))}
        >
            <HStack style={styles.wrapper}>
                <Box style={[styles.actionContainer, styles.leftContainer]}>
                    <Pressable onPress={handlePrevExercise} disabled={isPrevDisabled}>
                        <Box style={styles.actionButtonContainer}>
                            <ChevronLeft
                                size={theme.space(8)}
                                color={theme.colors.typography}
                                opacity={isPrevDisabled ? 0.6 : 1}
                            />
                        </Box>
                    </Pressable>
                    <Pressable onPress={handleAddSet}>
                        <Box style={[styles.actionButtonContainer]}>
                            <Plus size={theme.space(8)} color={theme.colors.typography} />
                        </Box>
                    </Pressable>
                </Box>
                <Box style={[styles.actionContainer, styles.centerContainer]}>
                    <Pressable onPress={handleMainAction} disabled={isMainActionPending}>
                        <Box style={[styles.actionButtonContainer, styles.mainButtonContainer]}>
                            {mainIcon === 'play' && (
                                <Play
                                    size={theme.space(5)}
                                    color={theme.colors.neutral[950]}
                                    fill={theme.colors.neutral[950]}
                                />
                            )}
                            {mainIcon === 'check' && (
                                <Check
                                    style={styles.checkIcon}
                                    size={theme.space(8)}
                                    color={theme.colors.neutral[950]}
                                    strokeWidth={2.5}
                                />
                            )}
                            {mainIcon === 'collapse' && (
                                <ChevronDown
                                    style={styles.chevronDownIcon}
                                    size={theme.space(10)}
                                    color={theme.colors.neutral[950]}
                                    strokeWidth={2.5}
                                />
                            )}
                            {mainIcon === 'back' && (
                                <ChevronLeft
                                    style={styles.chevronLeftIcon}
                                    size={theme.space(10)}
                                    color={theme.colors.neutral[950]}
                                    strokeWidth={2.5}
                                />
                            )}
                            {mainIcon === 'stop' && (
                                <Square
                                    size={theme.space(5)}
                                    color={theme.colors.neutral[950]}
                                    fill={theme.colors.neutral[950]}
                                />
                            )}
                        </Box>
                    </Pressable>
                </Box>
                <Box style={[styles.actionContainer, styles.rightContainer]}>
                    <Pressable onPress={handleRest}>
                        <Box style={[styles.actionButtonContainer]}>
                            <ClockFading size={theme.space(8)} color={theme.colors.typography} />
                        </Box>
                    </Pressable>
                    <Pressable onPress={handleNextExercise} disabled={isNextDisabled}>
                        <Box style={styles.actionButtonContainer}>
                            <ChevronRight
                                size={theme.space(8)}
                                color={theme.colors.typography}
                                opacity={isNextDisabled ? 0.6 : 1}
                            />
                        </Box>
                    </Pressable>
                </Box>
            </HStack>
        </Box>
    );
};
