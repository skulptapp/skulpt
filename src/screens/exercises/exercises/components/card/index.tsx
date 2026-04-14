import { memo, ReactNode, useCallback, useMemo } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Trash2 } from 'lucide-react-native';

import { Text } from '@/components/primitives/text';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Pressable } from '@/components/primitives/pressable';
import { stableOutlineWidth } from '@/helpers/styles';
import { ExerciseListItem } from '@/hooks/use-exercises';

const styles = StyleSheet.create((theme) => ({
    categoryHeaderContainer: {
        paddingVertical: theme.space(3),
        paddingHorizontal: theme.space(4),
        backgroundColor: theme.colors.background,
    },
    sectionDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
    },
    categoryHeaderWrapper: {
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    categoryTitle: {
        color: theme.colors.typography,
    },
    categoryCount: {
        color: theme.colors.typography,
        opacity: 0.6,
    },
    muscleGroupHeaderContainer: {
        paddingVertical: theme.space(2),
        paddingHorizontal: theme.space(4),
    },
    muscleGroupHeaderWrapper: {
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    muscleGroupTitle: {
        color: theme.colors.typography,
    },
    muscleGroupCount: {
        color: theme.colors.typography,
        opacity: 0.6,
    },
    exerciseItemContainer: (left: boolean, right: boolean) => ({
        paddingVertical: theme.space(2),
        paddingLeft: left ? theme.space(0) : theme.space(4),
        paddingRight: right ? theme.space(0) : theme.space(4),
    }),
    exerciseName: {
        color: theme.colors.typography,
    },
    exerciseTracking: {
        color: theme.colors.typography,
        opacity: 0.6,
        marginTop: theme.space(1),
    },
    exerciseItemSeparator: (borderStyle: 'default' | 'wide' | 'none') => ({
        height: borderStyle === 'none' ? 0 : StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
        marginHorizontal: borderStyle === 'wide' ? 0 : theme.space(4),
    }),
    selectCircle: (selected: boolean) => ({
        width: theme.space(6),
        height: theme.space(6),
        borderRadius: theme.space(5),
        borderWidth: stableOutlineWidth,
        borderColor: selected ? theme.colors.typography : theme.colors.border,
        backgroundColor: selected ? theme.colors.typography : 'transparent',
    }),
    selectPressable: {
        paddingHorizontal: 16,
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
    exerciseRow: {
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    exerciseContentFlex: {
        flex: 1,
    },
}));

interface ExerciseListItemProps {
    item: ExerciseListItem;
    onPress?: (item: ExerciseListItem) => void;
    onDelete?: (exerciseId: string) => void;
    index: number;
    data: ExerciseListItem[];
    renderRightAccessory?: (item: ExerciseListItem & { type: 'exercise' }) => ReactNode | null;
    renderLeftAccessory?: (item: ExerciseListItem & { type: 'exercise' }) => ReactNode | null;
    selectable?: boolean;
    selected?: boolean;
    onSelectToggle?: (exerciseId: string) => void;
    selectionPosition?: 'left' | 'right';
}

interface RightActionProps {
    prog: SharedValue<number>;
    drag: SharedValue<number>;
    handleDelete: () => void;
}

interface SelectionAccessoryProps {
    selected: boolean;
    onToggle: () => void;
}

const CategoryHeaderComponent = ({ item }: { item: ExerciseListItem & { type: 'category' } }) => {
    const { t } = useTranslation(['common']);

    return (
        <Box>
            <Box style={styles.categoryHeaderContainer}>
                <HStack style={styles.categoryHeaderWrapper}>
                    <Text fontSize="xl" fontWeight="bold" style={styles.categoryTitle}>
                        {t(`exerciseCategory.${item.name}`, { ns: 'common' })}
                    </Text>
                    <Text fontSize="sm" fontWeight="medium" style={styles.categoryCount}>
                        {item.count}
                    </Text>
                </HStack>
            </Box>
            <Box style={styles.sectionDivider} />
        </Box>
    );
};

const CategoryHeader = memo(CategoryHeaderComponent);

const MuscleGroupHeaderComponent = ({
    item,
}: {
    item: ExerciseListItem & { type: 'muscle-group' };
}) => {
    const { t } = useTranslation(['common']);

    return (
        <Box>
            <Box style={styles.muscleGroupHeaderContainer}>
                <HStack style={styles.muscleGroupHeaderWrapper}>
                    <Text fontWeight="bold" style={styles.muscleGroupTitle}>
                        {t(`muscleGroup.${item.name}`, { ns: 'common' })}
                    </Text>
                    <Text fontSize="xs" fontWeight="medium" style={styles.muscleGroupCount}>
                        {item.count}
                    </Text>
                </HStack>
            </Box>
            <Box style={styles.sectionDivider} />
        </Box>
    );
};

const MuscleGroupHeader = memo(MuscleGroupHeaderComponent);

const RightActionComponent = ({ prog, drag, handleDelete }: RightActionProps) => {
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

const RightAction = memo(RightActionComponent);

const SelectionAccessoryComponent = ({ selected, onToggle }: SelectionAccessoryProps) => (
    <Pressable onPress={onToggle} style={styles.selectPressable}>
        <Box style={styles.selectCircle(!!selected)} />
    </Pressable>
);

const SelectionAccessory = memo(SelectionAccessoryComponent);

const ExerciseCardComponent = ({
    item,
    onPress,
    onDelete,
    index,
    data,
    renderRightAccessory,
    renderLeftAccessory,
    selectable,
    selected,
    onSelectToggle,
    selectionPosition = 'left',
}: {
    item: ExerciseListItem & { type: 'exercise' };
    onPress?: (item: ExerciseListItem) => void;
    onDelete?: (exerciseId: string) => void;
    index: number;
    data: ExerciseListItem[];
    renderRightAccessory?: (item: ExerciseListItem & { type: 'exercise' }) => ReactNode | null;
    renderLeftAccessory?: (item: ExerciseListItem & { type: 'exercise' }) => ReactNode | null;
    selectable?: boolean;
    selected?: boolean;
    onSelectToggle?: (exerciseId: string) => void;
    selectionPosition?: 'left' | 'right';
}) => {
    const { t } = useTranslation(['common']);

    const handlePress = useCallback(() => {
        onPress?.(item);
    }, [onPress, item]);

    const borderStyle = useMemo(() => {
        if (index === data.length - 1) {
            return 'none';
        }

        const nextItem = data[index + 1];
        if (nextItem && (nextItem.type === 'category' || nextItem.type === 'muscle-group')) {
            return 'wide';
        }

        return 'default';
    }, [data, index]);

    const handleSelectToggle = useCallback(() => {
        onSelectToggle?.(item.exercise.id);
    }, [onSelectToggle, item.exercise.id]);

    const showLeftSelection = selectable && selectionPosition === 'left';
    const showRightSelection = selectable && selectionPosition === 'right';

    const handleDelete = useCallback(() => {
        onDelete?.(item.exercise.id);
    }, [onDelete, item.exercise.id]);

    const renderRightActions = useCallback(
        (prog: SharedValue<number>, drag: SharedValue<number>) => (
            <RightAction prog={prog} drag={drag} handleDelete={handleDelete} />
        ),
        [handleDelete],
    );

    const leftAccessory = !showLeftSelection ? renderLeftAccessory?.(item) : null;
    const rightAccessory = !showRightSelection ? renderRightAccessory?.(item) : null;
    const hasLeft = showLeftSelection || !!leftAccessory;
    const hasRight = showRightSelection || !!rightAccessory;

    const exerciseRow = (
        <HStack style={styles.exerciseRow}>
            {showLeftSelection ? (
                <SelectionAccessory selected={!!selected} onToggle={handleSelectToggle} />
            ) : leftAccessory ? (
                leftAccessory
            ) : null}
            <VStack
                style={[
                    styles.exerciseItemContainer(hasLeft, hasRight),
                    styles.exerciseContentFlex,
                ]}
            >
                <Text style={styles.exerciseName}>{item.exercise.name}</Text>
                <Text fontSize="xs" style={styles.exerciseTracking}>
                    {item.exercise.tracking
                        .map((v) => t(`exerciseTracking.${v}`, { ns: 'common' }))
                        .join(' + ')}
                </Text>
            </VStack>
            {showRightSelection ? (
                <SelectionAccessory selected={!!selected} onToggle={handleSelectToggle} />
            ) : rightAccessory ? (
                rightAccessory
            ) : null}
        </HStack>
    );

    return (
        <Pressable onPress={handlePress}>
            {onDelete ? (
                <Swipeable
                    containerStyle={styles.swipeable}
                    childrenContainerStyle={styles.swipeableContainer}
                    friction={2}
                    enableTrackpadTwoFingerGesture
                    rightThreshold={40}
                    renderRightActions={renderRightActions}
                >
                    {exerciseRow}
                </Swipeable>
            ) : (
                exerciseRow
            )}
            <Box style={styles.exerciseItemSeparator(borderStyle)} />
        </Pressable>
    );
};

const ExerciseCard = memo(ExerciseCardComponent);

const ExerciseListItemComponentInner = ({
    item,
    onPress,
    onDelete,
    index,
    data,
    renderRightAccessory,
    renderLeftAccessory,
    selectable,
    selected,
    onSelectToggle,
    selectionPosition,
}: ExerciseListItemProps) => {
    switch (item.type) {
        case 'category':
            return <CategoryHeader item={item} />;
        case 'muscle-group':
            return <MuscleGroupHeader item={item} />;
        case 'exercise':
            return (
                <ExerciseCard
                    item={item}
                    onPress={onPress}
                    onDelete={onDelete}
                    index={index}
                    data={data}
                    renderRightAccessory={renderRightAccessory}
                    renderLeftAccessory={renderLeftAccessory}
                    selectable={selectable}
                    selected={selected}
                    onSelectToggle={onSelectToggle}
                    selectionPosition={selectionPosition}
                />
            );
        default:
            return null;
    }
};

export const ExerciseListItemComponent = memo(ExerciseListItemComponentInner);
