import { FC, memo, useMemo, useCallback } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Reanimated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Trash2 } from 'lucide-react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Sortable, { useItemContext } from 'react-native-sortables';

import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { HStack } from '@/components/primitives/hstack';
import { Pressable } from '@/components/primitives/pressable';
import { ExerciseSetSelect, ExerciseSelect, WorkoutExerciseSelect } from '@/db/schema';
import { Separator } from '@/components/layout/separator';
import { useDeleteExerciseSet, useUpdateExerciseSet } from '@/hooks/use-workouts';
import { useActionsStore } from '@/stores/actions';

import { Rest } from '../rest';
import { formatClockSecondsCompact } from '@/helpers/times';
import { TimeDurationInput } from '@/components/primitives/time-duration-input';
import { WeightInput } from '@/components/primitives/weight-input';
import { RepsInput } from '@/components/primitives/reps-input';
import { DistanceInput } from '@/components/primitives/distance-input';
import { normalizeSetType } from '@/helpers/set-type';
import { useTranslation } from 'react-i18next';

interface SetItemProps {
    set: ExerciseSetSelect;
    exerciseInfo: {
        exercise: ExerciseSelect;
        workoutExercise: WorkoutExerciseSelect;
    } | null;
    index: number;
    nowMs: number;
    activeSetId: string | null;
    restingSetId: string | null;
    activeWorkTimerRemainingSeconds: number | null;
    activeStopwatchElapsedSeconds: number | null;
}

interface RightActionProps {
    prog: SharedValue<number>;
    drag: SharedValue<number>;
    handleDelete: () => void;
}

const styles = StyleSheet.create((theme, rt) => ({
    set: (active: boolean, isTimerActive: boolean) => ({
        backgroundColor: active
            ? rt.themeName === 'dark'
                ? theme.colors.lime[900]
                : theme.colors.lime[100]
            : isTimerActive
              ? theme.colors.foreground
              : theme.colors.background,
        paddingTop: theme.space(3),
        paddingBottom: theme.space(3),
    }),
    orderContainer: {
        paddingLeft: theme.space(4),
        width: theme.space(24),
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    orderWrapper: (active: boolean, isTimerActive: boolean) => ({
        backgroundColor: active
            ? rt.themeName === 'dark'
                ? theme.colors.lime[900]
                : theme.colors.lime[100]
            : isTimerActive
              ? theme.colors.foreground
              : theme.colors.background,
        paddingHorizontal: theme.space(2),
        paddingVertical: theme.space(0.5),
        borderRadius: theme.radius.lg,
    }),
    restContainer: {
        paddingRight: theme.space(4),
        width: theme.space(24),
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    orderTitle: {
        fontWeight: theme.fontWeight.default.fontWeight,
        fontSize: theme.fontSize.sm.fontSize,
        color: theme.colors.neutral[400],
    },
    setContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space(2),
    },
    separator: {
        marginLeft: theme.space(4),
        marginRight: theme.space(4),
    },
    swipeable: {
        backgroundColor: theme.colors.red[500],
    },
    swipeableContainer: {
        backgroundColor: theme.colors.background,
        width: '100%',
    },
    tackingContainer: {
        alignItems: 'flex-end',
        gap: theme.space(1),
    },
    input: (focused: boolean, active: boolean, completed: boolean, isTimerActive: boolean) => ({
        color: active ? theme.colors.lime[500] : theme.colors.typography,
        fontSize: theme.fontSize['3xl'].fontSize,
        lineHeight: theme.fontSize['3xl'].lineHeight,
        fontWeight: theme.fontWeight.medium.fontWeight,
        textAlign: 'center',
        height: theme.space(10),
        borderBottomWidth: theme.space(1),
        opacity: active || completed ? 1 : 0.3,
        borderBottomColor: focused
            ? theme.colors.lime[500]
            : active
              ? rt.themeName === 'dark'
                  ? theme.colors.lime[900]
                  : theme.colors.lime[100]
              : isTimerActive
                ? theme.colors.foreground
                : theme.colors.background,
    }),
    rightAction: {
        width: 75,
        height: '100%',
        backgroundColor: theme.colors.red[500],
        justifyContent: 'center',
        alignItems: 'center',
    },
    rightActionPressable: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sepText: {
        fontSize: theme.fontSize.lg.fontSize,
        marginBottom: theme.space(1.75),
    },
    sepX: {
        fontSize: theme.fontSize.lg.fontSize,
        marginBottom: theme.space(0.75),
    },
}));

const RightAction: FC<RightActionProps> = ({ drag, handleDelete }) => {
    const { theme } = useUnistyles();

    const styleAnimation = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: drag.value + 75 }],
        };
    });

    return (
        <Reanimated.View style={[styles.rightAction, styleAnimation]}>
            <Pressable style={styles.rightActionPressable} onPress={handleDelete}>
                <Trash2 color={theme.colors.neutral[50]} size={theme.space(6)} strokeWidth={1.75} />
            </Pressable>
        </Reanimated.View>
    );
};

const SetItemComponent = ({
    set,
    exerciseInfo,
    index,
    nowMs,
    activeSetId,
    restingSetId,
    activeWorkTimerRemainingSeconds,
    activeStopwatchElapsedSeconds,
}: SetItemProps) => {
    const { t } = useTranslation(['common']);
    const { gesture } = useItemContext();

    const { mutateAsync: updateSet } = useUpdateExerciseSet();
    const { mutate: deleteSet } = useDeleteExerciseSet();
    const actionsOpen = useActionsStore((state) => state.open);

    const isActive = set.id === activeSetId;
    const isCompleted = !!set.completedAt;
    const setTypeShort = t(`setTypeShort.${normalizeSetType(set.type)}`, { ns: 'common' });

    const initialSeconds = useMemo(() => Math.max(0, set.restTime ?? 0), [set.restTime]);

    const isTimerActive = set.id === restingSetId;

    const handleDelete = useCallback(
        (id: string) => {
            if (!exerciseInfo) return;
            deleteSet({ id, workoutExerciseId: exerciseInfo.workoutExercise.id });
        },
        [deleteSet, exerciseInfo],
    );

    const handleOpenSetMenu = useCallback(() => {
        actionsOpen({
            type: 'set__menu',
            payload: {
                setId: set.id,
                workoutExerciseId: set.workoutExerciseId,
                setType: normalizeSetType(set.type),
            },
        });
    }, [actionsOpen, set.id, set.type, set.workoutExerciseId]);

    const keyOf = (id: string, field: string) => `${id}:${field}`;

    const fieldComponents = useMemo(() => {
        const exerciseTracking = exerciseInfo?.exercise?.tracking;
        const tracking: string[] = Array.isArray(exerciseTracking) ? exerciseTracking : [];
        const timeOptions = exerciseInfo?.exercise?.timeOptions ?? 'log';

        return tracking
            .filter((f) => ['weight', 'reps', 'time', 'distance'].includes(String(f)))
            .map((field) => {
                if (field === 'weight') {
                    return (
                        <HStack key={keyOf(set.id, 'weight')} style={styles.tackingContainer}>
                            <WeightInput
                                value={set.weight}
                                editable={true}
                                style={styles.input(false, isActive, isCompleted, isTimerActive)}
                                onCommitValue={(value) => {
                                    updateSet({ id: set.id, updates: { weight: value } });
                                }}
                            />
                            <Text style={styles.sepText}>
                                {exerciseInfo?.exercise?.weightUnits || ''}
                            </Text>
                        </HStack>
                    );
                }

                if (field === 'reps') {
                    return (
                        <HStack key={keyOf(set.id, 'reps')}>
                            <RepsInput
                                value={set.reps}
                                editable={true}
                                style={styles.input(false, isActive, isCompleted, isTimerActive)}
                                onCommitValue={(value) => {
                                    updateSet({ id: set.id, updates: { reps: value } });
                                }}
                            />
                        </HStack>
                    );
                }

                if (field === 'time') {
                    const isSetActive = isActive;

                    const startedAtMs =
                        set.startedAt instanceof Date
                            ? set.startedAt.getTime()
                            : typeof set.startedAt === 'number'
                              ? set.startedAt
                              : set.startedAt
                                ? new Date(set.startedAt).getTime()
                                : null;

                    const elapsedSec =
                        isSetActive &&
                        timeOptions === 'stopwatch' &&
                        activeStopwatchElapsedSeconds != null
                            ? activeStopwatchElapsedSeconds
                            : isSetActive && startedAtMs != null && !Number.isNaN(startedAtMs)
                              ? Math.max(0, Math.floor((nowMs - startedAtMs) / 1000))
                              : 0;

                    const remainingSec =
                        isSetActive &&
                        timeOptions === 'timer' &&
                        activeWorkTimerRemainingSeconds != null
                            ? activeWorkTimerRemainingSeconds
                            : Math.max(0, Math.max(0, set.time ?? 0) - elapsedSec);

                    const displayText =
                        isSetActive && timeOptions === 'timer'
                            ? formatClockSecondsCompact(remainingSec)
                            : isSetActive && timeOptions === 'stopwatch'
                              ? formatClockSecondsCompact(elapsedSec)
                              : undefined;

                    const isEditable = !(
                        isSetActive &&
                        (timeOptions === 'timer' || timeOptions === 'stopwatch')
                    );

                    return (
                        <HStack key={keyOf(set.id, 'time')}>
                            <TimeDurationInput
                                valueSeconds={set.time ?? 0}
                                editable={isEditable}
                                displayOverride={displayText}
                                style={styles.input(false, isActive, isCompleted, isTimerActive)}
                                onCommitSeconds={(seconds) => {
                                    updateSet({ id: set.id, updates: { time: seconds } });
                                }}
                            />
                        </HStack>
                    );
                }

                if (field === 'distance') {
                    return (
                        <HStack key={keyOf(set.id, 'distance')}>
                            <DistanceInput
                                value={set.distance}
                                editable={true}
                                style={styles.input(false, isActive, isCompleted, isTimerActive)}
                                onCommitValue={(value) => {
                                    updateSet({ id: set.id, updates: { distance: value } });
                                }}
                            />
                            <Text style={styles.sepText}>
                                {exerciseInfo?.exercise?.distanceUnits || ''}
                            </Text>
                        </HStack>
                    );
                }

                return null;
            })
            .filter(Boolean);
    }, [
        set,
        exerciseInfo,
        nowMs,
        isTimerActive,
        isActive,
        isCompleted,
        updateSet,
        activeStopwatchElapsedSeconds,
        activeWorkTimerRemainingSeconds,
    ]);

    const interspersedFields = useMemo(() => {
        const result = [];

        for (let i = 0; i < fieldComponents.length; i++) {
            if (i > 0) {
                result.push(
                    <Text key={`sep-${set.id}-${i}`} style={styles.sepX}>
                        ×
                    </Text>,
                );
            }
            result.push(fieldComponents[i]);
        }

        return result;
    }, [fieldComponents, set.id]);

    return (
        <Sortable.Touchable gestureMode="simultaneous" style={{ width: '100%' }}>
            {index > 0 && <Separator style={styles.separator} />}
            <Swipeable
                containerStyle={styles.swipeable}
                childrenContainerStyle={styles.swipeableContainer}
                friction={2}
                enableTrackpadTwoFingerGesture
                rightThreshold={40}
                simultaneousWithExternalGesture={gesture as unknown as any}
                renderRightActions={(prog, drag) => (
                    <RightAction
                        prog={prog}
                        drag={drag}
                        handleDelete={() => handleDelete(set.id)}
                    />
                )}
            >
                <HStack style={styles.set(isActive, isTimerActive)}>
                    <Box style={styles.orderContainer}>
                        <Pressable onPress={handleOpenSetMenu}>
                            <Box style={styles.orderWrapper(isActive, isTimerActive)}>
                                <Text style={styles.orderTitle}>
                                    {`${index + 1} ${setTypeShort}`}
                                </Text>
                            </Box>
                        </Pressable>
                    </Box>
                    <HStack style={styles.setContainer}>{interspersedFields}</HStack>
                    <Box style={styles.restContainer}>
                        <Rest
                            workoutExerciseId={set.workoutExerciseId}
                            set={set}
                            initialSeconds={initialSeconds}
                        />
                    </Box>
                </HStack>
            </Swipeable>
        </Sortable.Touchable>
    );
};

export const SetItem = memo(SetItemComponent, (prev, next) => {
    if (prev.set !== next.set) return false;
    if (prev.exerciseInfo !== next.exerciseInfo) return false;
    if (prev.index !== next.index) return false;
    if (prev.activeSetId !== next.activeSetId) return false;
    if (prev.restingSetId !== next.restingSetId) return false;

    const prevIsTimeSensitive =
        prev.set.id === prev.activeSetId || prev.set.id === prev.restingSetId;
    const nextIsTimeSensitive =
        next.set.id === next.activeSetId || next.set.id === next.restingSetId;

    if (prevIsTimeSensitive || nextIsTimeSensitive) {
        if (prev.nowMs !== next.nowMs) return false;
        if (prev.activeWorkTimerRemainingSeconds !== next.activeWorkTimerRemainingSeconds)
            return false;
        if (prev.activeStopwatchElapsedSeconds !== next.activeStopwatchElapsedSeconds) return false;
    }

    return true;
});
