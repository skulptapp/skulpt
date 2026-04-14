import { FC, memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';

import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { HStack } from '@/components/primitives/hstack';
import { formatSet } from '@/helpers/workouts';
import { normalizeSetType } from '@/helpers/set-type';
import { ExerciseSetSelect } from '@/db/schema';

import { WorkoutItem } from '../../types';

const styles = StyleSheet.create((theme, rt) => ({
    setContainer: (isActive: boolean, isTimerActive: boolean) => ({
        backgroundColor:
            isActive || isTimerActive ? theme.colors.lime[400] : theme.colors.foreground,
        paddingVertical: theme.space(0.25),
        paddingHorizontal: theme.space(1.5),
        borderRadius: theme.radius.lg,
    }),
    row: {
        alignItems: 'center',
        gap: theme.space(2),
    },
    typeBadge: (isActive: boolean, isFinished: boolean, isTimerActive: boolean) => ({
        fontSize: theme.fontSize.xs.fontSize,
        color: isActive || isTimerActive ? theme.colors.neutral[950] : theme.colors.typography,
        opacity: isActive || isTimerActive ? 1 : isFinished ? 1 : 0.45,
        fontWeight: theme.fontWeight.medium.fontWeight,
    }),
    setContent: (isActive: boolean, isFinished: boolean, isTimerActive: boolean) => ({
        color: isActive || isTimerActive ? theme.colors.neutral[950] : theme.colors.typography,
        fontSize: theme.fontSize.sm.fontSize,
        opacity: isActive || isTimerActive ? 1 : isFinished ? 1 : 0.45,
        fontWeight: theme.fontWeight.default.fontWeight,
    }),
}));

interface ExerciseSetProps {
    set: ExerciseSetSelect;
    workout: WorkoutItem;
    activeSetId: string | null;
    restingSetId: string | null;
}

const ExerciseSetComponent: FC<ExerciseSetProps> = ({
    set,
    workout,
    activeSetId,
    restingSetId,
}) => {
    const { t } = useTranslation(['common']);
    const isActive = useMemo(() => set.id === activeSetId, [set.id, activeSetId]);

    const isFinished = useMemo(() => !!set.completedAt, [set.completedAt]);

    const isTimerActive = useMemo(() => set.id === restingSetId, [set.id, restingSetId]);
    const setTypeShort = t(`setTypeShort.${normalizeSetType(set.type)}`, { ns: 'common' });

    return (
        <Box style={styles.setContainer(isActive, isTimerActive)} key={set.id}>
            <HStack style={styles.row}>
                <Text style={styles.typeBadge(isActive, isFinished, isTimerActive)}>
                    {setTypeShort}
                </Text>
                <Text style={styles.setContent(isActive, isFinished, isTimerActive)}>
                    {formatSet(workout.exercise, set)}
                </Text>
            </HStack>
        </Box>
    );
};

export const ExerciseSet = memo(ExerciseSetComponent, (prev, next) => {
    return (
        prev.set === next.set &&
        prev.workout === next.workout &&
        prev.activeSetId === next.activeSetId &&
        prev.restingSetId === next.restingSetId
    );
});
