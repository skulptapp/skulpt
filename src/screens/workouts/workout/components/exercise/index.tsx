import { FC, memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Sortable, { useItemContext } from 'react-native-sortables';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Reanimated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { Box } from '@/components/primitives/box';
import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { Separator } from '@/components/layout/separator';
import { Pressable } from '@/components/primitives/pressable';
import { Trash2 } from 'lucide-react-native';
import { WorkoutItem } from '../../types';
import { ExerciseSet } from '../exercise-set';

interface ExerciseProps {
    item: WorkoutItem;
    index: number;
    onDelete: (id: string) => void;
    onPress: (id: string) => void;
    activeExerciseId: string | null;
    activeSetId: string | null;
    restingSetId: string | null;
    isEditMode?: boolean;
    isSelected?: boolean;
    onToggleSelect?: (id: string) => void;
    showGroupIndicator?: boolean;
}

const styles = StyleSheet.create((theme, rt) => ({
    exercise: {
        paddingTop: theme.space(1.5),
    },
    orderContainer: {
        width: theme.space(12),
        alignItems: 'center',
    },
    orderTitle: (isActive: boolean, isCompleted: boolean) => ({
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: isActive ? theme.colors.lime[500] : theme.colors.typography,
        opacity: isActive || isCompleted ? 1 : 0.45,
    }),
    exerciseContainer: {
        flex: 1,
        marginRight: theme.space(4),
        paddingBottom: theme.space(3),
    },
    exerciseName: {
        color: theme.colors.typography,
        fontWeight: theme.fontWeight.semibold.fontWeight,
    },
    exerciseMeta: {
        color: theme.colors.typography,
        opacity: 0.6,
        fontSize: theme.fontSize.sm.fontSize,
        marginTop: -theme.space(0.5),
        marginBottom: theme.space(1),
    },
    setsContainer: {
        gap: theme.space(1),
        flexWrap: 'wrap',
    },
    separator: {
        marginLeft: theme.space(12),
        marginRight: theme.space(4),
    },
    swipeable: {
        backgroundColor: theme.colors.red[500],
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
    rightActionPressable: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectCircle: (selected: boolean) => ({
        marginTop: theme.space(0.75),
        width: theme.space(5),
        height: theme.space(5),
        borderRadius: theme.space(5),
        borderWidth: 1,
        borderColor: selected ? theme.colors.typography : theme.colors.border,
        backgroundColor: selected ? theme.colors.typography : 'transparent',
    }),
    groupIndicatorContainer: {
        flex: 1,
        alignItems: 'center',
        gap: theme.space(2),
    },
    groupIndicator: {
        flex: 1,
        height: '100%',
        width: theme.space(0.5),
        backgroundColor: theme.colors.typography,
    },
}));

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
            <Pressable style={styles.rightActionPressable} onPress={handleDelete}>
                <Trash2 color={theme.colors.neutral[50]} size={theme.space(6)} strokeWidth={1.75} />
            </Pressable>
        </Reanimated.View>
    );
};

const ExerciseContent: FC<{
    item: WorkoutItem;
    index: number;
    isExerciseActive: boolean;
    isExerciseCompleted: boolean;
    isEditMode?: boolean;
    isSelected?: boolean;
    activeSetId: string | null;
    restingSetId: string | null;
    showGroupIndicator?: boolean;
}> = ({
    item,
    index,
    isExerciseActive,
    isExerciseCompleted,
    isEditMode,
    isSelected,
    activeSetId,
    restingSetId,
    showGroupIndicator,
}) => {
    const { t } = useTranslation(['common']);

    return (
        <HStack style={styles.exercise}>
            <Box style={styles.orderContainer}>
                <VStack style={styles.groupIndicatorContainer}>
                    {isEditMode ? (
                        <Box style={styles.selectCircle(!!isSelected)} />
                    ) : (
                        <Box>
                            <Text style={styles.orderTitle(isExerciseActive, isExerciseCompleted)}>
                                {index + 1}
                            </Text>
                        </Box>
                    )}
                    {showGroupIndicator && <Box style={styles.groupIndicator} />}
                </VStack>
            </Box>
            <VStack style={styles.exerciseContainer}>
                <Box>
                    <Text style={styles.exerciseName}>{item.name}</Text>
                </Box>
                {item.tracking && item.tracking.length > 0 ? (
                    <Box>
                        <Text style={styles.exerciseMeta}>
                            {item.tracking
                                .map((v) => t(`exerciseTracking.${v}`, { ns: 'common' }))
                                .join(' + ')}
                        </Text>
                    </Box>
                ) : null}
                {item.sets && item.sets.length > 0 ? (
                    <HStack style={styles.setsContainer}>
                        {item.sets.map((set) => (
                            <ExerciseSet
                                key={set.id}
                                set={set}
                                workout={item}
                                activeSetId={activeSetId}
                                restingSetId={restingSetId}
                            />
                        ))}
                    </HStack>
                ) : null}
            </VStack>
        </HStack>
    );
};

const ExerciseComponent: FC<ExerciseProps> = ({
    item,
    index,
    onDelete,
    onPress,
    activeExerciseId,
    activeSetId,
    restingSetId,
    isEditMode,
    isSelected,
    onToggleSelect,
    showGroupIndicator,
}) => {
    const { gesture } = useItemContext();

    const isExerciseActive = useMemo(() => {
        return item.id === activeExerciseId;
    }, [item.id, activeExerciseId]);

    const isExerciseCompleted = useMemo(() => {
        if (!item.sets || item.sets.length === 0) return false;

        return item.sets.every((set) => {
            if (!set.completedAt) return false;

            if (set.restTime && set.restTime > 0) {
                return !!set.restCompletedAt;
            }

            return true;
        });
    }, [item.sets]);

    if (isEditMode) {
        return (
            <Box>
                {index > 0 && <Separator style={styles.separator} />}
                <Pressable onPress={() => onToggleSelect?.(item.id)}>
                    <ExerciseContent
                        item={item}
                        index={index}
                        isExerciseActive={isExerciseActive}
                        isExerciseCompleted={isExerciseCompleted}
                        isEditMode={isEditMode}
                        isSelected={isSelected}
                        activeSetId={activeSetId}
                        restingSetId={restingSetId}
                        showGroupIndicator={showGroupIndicator}
                    />
                </Pressable>
            </Box>
        );
    }

    return (
        <Box>
            {index > 0 && <Separator style={styles.separator} />}
            <Swipeable
                containerStyle={styles.swipeable}
                childrenContainerStyle={styles.swipeableContainer}
                friction={2}
                enableTrackpadTwoFingerGesture
                rightThreshold={40}
                simultaneousWithExternalGesture={gesture as unknown as any}
                renderRightActions={(prog, drag) => (
                    <RightAction prog={prog} drag={drag} handleDelete={() => onDelete(item.id)} />
                )}
            >
                <Sortable.Touchable
                    gestureMode="simultaneous"
                    onTap={() => onPress(item.id)}
                    style={{ width: '100%' }}
                >
                    <ExerciseContent
                        item={item}
                        index={index}
                        isExerciseActive={isExerciseActive}
                        isExerciseCompleted={isExerciseCompleted}
                        activeSetId={activeSetId}
                        restingSetId={restingSetId}
                        showGroupIndicator={showGroupIndicator}
                    />
                </Sortable.Touchable>
            </Swipeable>
        </Box>
    );
};

export const Exercise = memo(ExerciseComponent, (prev, next) => {
    return (
        prev.item === next.item &&
        prev.index === next.index &&
        prev.onDelete === next.onDelete &&
        prev.onPress === next.onPress &&
        prev.activeExerciseId === next.activeExerciseId &&
        prev.activeSetId === next.activeSetId &&
        prev.restingSetId === next.restingSetId &&
        prev.isEditMode === next.isEditMode &&
        prev.isSelected === next.isSelected &&
        prev.showGroupIndicator === next.showGroupIndicator
    );
});
