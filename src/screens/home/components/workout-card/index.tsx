import { FC, memo, useCallback, useMemo } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Trash2, Dot } from 'lucide-react-native';
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import { isNumber } from 'lodash';

import { Pressable } from '@/components/primitives/pressable';
import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { WorkoutSelect } from '@/db/schema';
import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { useDeleteWorkout, type WorkoutOverviewMeta } from '@/hooks/use-workouts';
import { formatWorkoutDuration } from '@/helpers/times';

dayjs.extend(localizedFormat);

const styles = StyleSheet.create((theme, rt) => ({
    container: (status: WorkoutSelect['status']) => ({
        backgroundColor:
            status === 'in_progress' ? theme.colors.lime[400] : theme.colors.foreground,
    }),
    card: {
        paddingVertical: theme.space(3),
        paddingHorizontal: theme.space(5),
        gap: theme.space(3),
    },
    content: {
        gap: theme.space(1),
    },
    title: (status: WorkoutSelect['status']) => ({
        fontSize: theme.fontSize.lg.fontSize,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: status === 'in_progress' ? theme.colors.neutral[950] : theme.colors.typography,
    }),
    status: (status: WorkoutSelect['status']) => ({
        fontWeight:
            status === 'in_progress'
                ? theme.fontWeight.semibold.fontWeight
                : theme.fontWeight.medium.fontWeight,
        color: status === 'in_progress' ? theme.colors.neutral[950] : theme.colors.typography,
        opacity: status === 'in_progress' ? 1 : 0.6,
    }),
    workoutColorContainer: {
        width: theme.space(6),
        justifyContent: 'center',
    },
    workoutColor: (status: WorkoutSelect['status']) => ({
        width: theme.space(4),
        height: theme.space(4),
        backgroundColor:
            status === 'in_progress' ? theme.colors.neutral[950] : theme.colors.lime[400],
        borderRadius: theme.radius.full,
    }),
    swipeable: {
        backgroundColor: theme.colors.red[500],
        borderRadius: theme.radius['4xl'],
    },
    swipeableContainer: {
        backgroundColor: theme.colors.background,
        width: '100%',
    },
    rightAction: {
        width: 75,
        height: '100%',
        backgroundColor: theme.colors.red[500],
        justifyContent: 'center',
        alignItems: 'center',
    },
    completedInfoContainer: {
        alignItems: 'center',
        gap: theme.space(1),
    },
    workoutInfoTextSize: {
        fontSize: theme.fontSize.sm.fontSize,
    },
    workoutInfoTextColor: (status: WorkoutSelect['status']) => ({
        color: status === 'in_progress' ? theme.colors.neutral[950] : theme.colors.typography,
    }),
    timer: {
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.neutral[950],
    },
    workoutInfoContainer: {
        alignItems: 'center',
    },
}));

interface WorkoutCardProps {
    workout: WorkoutSelect;
    onPress: (workoutId: string) => void;
    activeElapsedFormatted: string | null;
    overviewMeta?: WorkoutOverviewMeta;
}

interface RightActionProps {
    prog: SharedValue<number>;
    drag: SharedValue<number>;
    handleDelete: () => void;
}

const RightAction: FC<RightActionProps> = ({ drag, handleDelete }) => {
    const { theme } = useUnistyles();

    const styleAnimation = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: drag.value + 75 }],
        };
    });

    return (
        <Reanimated.View style={[styles.rightAction, styleAnimation]}>
            <Pressable onPress={handleDelete}>
                <Trash2 color={theme.colors.neutral[50]} size={theme.space(6)} strokeWidth={1.75} />
            </Pressable>
        </Reanimated.View>
    );
};

const WorkoutCardComponent: FC<WorkoutCardProps> = ({
    workout,
    onPress,
    activeElapsedFormatted,
    overviewMeta,
}) => {
    const { t, i18n } = useTranslation(['common']);
    const { theme } = useUnistyles();

    const deleteWorkout = useDeleteWorkout();
    const sortedWorkoutTypes = overviewMeta?.sortedWorkoutTypes ?? [];
    const sortedPrimaryMuscleGroups = overviewMeta?.sortedPrimaryMuscleGroups ?? [];

    const handlePress = useCallback(() => {
        onPress(workout.id);
    }, [onPress, workout.id]);

    const formattedDate = useMemo(() => {
        if (workout.status === 'planned' && workout.startAt) {
            return dayjs(workout.startAt).locale(i18n.language).format('lll');
        }

        if (workout.status === 'completed' && workout.completedAt) {
            const dayName = dayjs(workout.completedAt).locale(i18n.language).format('dddd');
            return dayName.charAt(0).toUpperCase() + dayName.slice(1);
        }

        return null;
    }, [workout.status, workout.startAt, workout.completedAt, i18n.language]);

    const formattedDuration =
        workout.status === 'completed' && isNumber(workout.duration)
            ? formatWorkoutDuration(workout.duration)
            : null;

    const handleDelete = useCallback(() => {
        deleteWorkout.mutate(workout.id);
    }, [workout, deleteWorkout]);

    return (
        <Swipeable
            containerStyle={styles.swipeable}
            childrenContainerStyle={styles.swipeableContainer}
            friction={2}
            enableTrackpadTwoFingerGesture
            rightThreshold={40}
            renderRightActions={(prog, drag) => (
                <RightAction prog={prog} drag={drag} handleDelete={handleDelete} />
            )}
        >
            <Box style={styles.container(workout.status)}>
                <Pressable onPress={handlePress}>
                    <HStack style={styles.card}>
                        <VStack style={styles.content}>
                            <HStack style={styles.workoutInfoContainer}>
                                <Text
                                    style={[
                                        styles.status(workout.status),
                                        styles.workoutInfoTextSize,
                                    ]}
                                >
                                    {workout.status === 'in_progress' && t(`now`, { ns: 'common' })}
                                    {workout.status === 'planned' &&
                                        (workout.startAt
                                            ? formattedDate
                                            : t(`workoutStatus.${workout.status}`, {
                                                  ns: 'common',
                                              }))}
                                    {workout.status === 'completed' && formattedDate}
                                </Text>
                                {sortedWorkoutTypes.length > 0 && (
                                    <>
                                        <Dot
                                            color={
                                                workout.status === 'in_progress'
                                                    ? theme.colors.neutral[950]
                                                    : theme.colors.typography
                                            }
                                            opacity={workout.status === 'in_progress' ? 1 : 0.8}
                                            size={theme.space(4)}
                                        />
                                        <Text
                                            style={[
                                                styles.status(workout.status),
                                                styles.workoutInfoTextSize,
                                            ]}
                                        >
                                            {sortedWorkoutTypes
                                                .map((type) =>
                                                    t(`exerciseCategory.${type}`, { ns: 'common' }),
                                                )
                                                .join(', ')}
                                        </Text>
                                    </>
                                )}
                            </HStack>
                            <HStack>
                                <Box style={styles.workoutColorContainer}>
                                    <Box style={styles.workoutColor(workout.status)} />
                                </Box>
                                <Text style={styles.title(workout.status)}>{workout.name}</Text>
                            </HStack>
                            <HStack style={styles.workoutInfoContainer}>
                                {workout.status === 'in_progress' && (
                                    <HStack style={styles.completedInfoContainer}>
                                        <Text style={[styles.timer, styles.workoutInfoTextSize]}>
                                            {activeElapsedFormatted ?? ''}
                                        </Text>
                                    </HStack>
                                )}
                                {workout.status === 'completed' && (
                                    <HStack style={styles.completedInfoContainer}>
                                        {formattedDuration && (
                                            <Text style={styles.workoutInfoTextSize}>
                                                {formattedDuration}
                                            </Text>
                                        )}
                                    </HStack>
                                )}
                                {sortedPrimaryMuscleGroups.length > 0 && (
                                    <>
                                        {['in_progress', 'completed'].includes(workout.status) && (
                                            <Dot
                                                color={
                                                    workout.status === 'in_progress'
                                                        ? theme.colors.neutral[950]
                                                        : theme.colors.typography
                                                }
                                                size={theme.space(4)}
                                            />
                                        )}
                                        <Text
                                            style={[
                                                styles.workoutInfoTextSize,
                                                styles.workoutInfoTextColor(workout.status),
                                            ]}
                                        >
                                            {sortedPrimaryMuscleGroups
                                                .map((muscle) =>
                                                    t(`muscleGroup.${muscle}`, { ns: 'common' }),
                                                )
                                                .join(', ')}
                                        </Text>
                                    </>
                                )}
                            </HStack>
                        </VStack>
                    </HStack>
                </Pressable>
            </Box>
        </Swipeable>
    );
};

export const WorkoutCard = memo(WorkoutCardComponent, (prev, next) => {
    return (
        prev.workout === next.workout &&
        prev.onPress === next.onPress &&
        prev.activeElapsedFormatted === next.activeElapsedFormatted &&
        prev.overviewMeta === next.overviewMeta
    );
});
