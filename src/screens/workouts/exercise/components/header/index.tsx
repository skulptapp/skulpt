import { FC, useCallback, useMemo } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Title } from '@/components/typography/title';
import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { ExerciseSelect, WorkoutExerciseSelect } from '@/db/schema';
import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { ChevronRight, ChevronsUp } from 'lucide-react-native';
import { Pressable } from '@/components/primitives/pressable';
import { router } from 'expo-router';
import { getPrimaryAnchorMuscleValue } from '@/constants/muscles';
import { PreviewThumbnail } from '@/components/layout/preview';

interface HeaderProps {
    exerciseInfo: {
        exercise: ExerciseSelect;
        workoutExercise: WorkoutExerciseSelect;
    } | null;
}

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        paddingHorizontal: theme.space(4),
        backgroundColor: theme.colors.lime[400],
        paddingBottom: theme.space(5),
        alignItems: 'center',
    },
    titleContainer: {
        paddingHorizontal: theme.space(6),
        alignItems: 'center',
    },
    title: {
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.neutral[950],
        textAlign: 'center',
    },
    subtitle: {
        fontSize: theme.fontSize.sm.fontSize,
        color: theme.colors.neutral[950],
    },
    muscleGroupContainer: {
        position: 'relative',
        marginTop: theme.headerContentTopOffset(theme.space(11)),
        marginBottom: theme.space(3.5),
        justifyContent: 'center',
        alignItems: 'center',
        height: theme.space(11),
    },
    muscleGroup: {
        fontWeight: theme.fontWeight.semibold.fontWeight,
        fontSize: theme.fontSize.default.fontSize,
        color: theme.colors.neutral[950],
    },
    actionsContainer: {
        marginTop: theme.space(2.5),
        width: '100%',
        minHeight: theme.space(12),
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
    },
    previewThumbnail: {
        position: 'absolute',
        left: 0,
        top: '50%',
        transform: [{ translateY: -theme.space(6) }],
        marginRight: 0,
    },
    leftActionsContainer: {
        flex: 1,
    },
    centerActionsContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rightActionsContainer: {
        flex: 1,
        alignItems: 'flex-end',
    },
    guideButton: {
        height: theme.space(11),
        width: theme.space(11),
        backgroundColor: theme.colors.lime[500],
        borderRadius: theme.radius.full,
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewThumbnailContainer: {
        borderWidth: theme.space(0),
        width: theme.space(11),
        height: theme.space(11),
    },
    exerciseLinkWrapper: {
        flexDirection: 'row',
        backgroundColor: theme.colors.lime[500],
        paddingRight: theme.space(1),
        paddingLeft: theme.space(2.5),
        paddingVertical: theme.space(0.25),
        borderRadius: theme.radius['full'],
        alignItems: 'center',
        gap: theme.space(0.5),
    },
    exerciseLink: {
        color: theme.colors.neutral[950],
        fontSize: theme.fontSize.xs.fontSize,
        fontWeight: theme.fontWeight.default.fontWeight,
    },
}));

export const Header: FC<HeaderProps> = ({ exerciseInfo }) => {
    const { t } = useTranslation(['common']);
    const { theme } = useUnistyles();

    const muscleGroup = useMemo(() => {
        const mg = getPrimaryAnchorMuscleValue(exerciseInfo?.exercise?.primaryMuscleGroups);
        return mg ? t(`muscleGroup.${mg}`, { ns: 'common' }) : '';
    }, [exerciseInfo?.exercise?.primaryMuscleGroups, t]);

    const handleExerciseLinkPress = () => {
        router.navigate(`/exercises/${exerciseInfo?.exercise.id}`);
    };

    const hasGuide = useMemo(() => {
        const exercise = exerciseInfo?.exercise;
        if (!exercise) return false;
        return (
            !!exercise.description ||
            (exercise.instructions && exercise.instructions.length > 0) ||
            (exercise.mistakes && exercise.mistakes.length > 0)
        );
    }, [exerciseInfo?.exercise]);

    const handleGuideOpen = useCallback(() => {
        if (!exerciseInfo?.exercise.id) return;
        router.navigate({
            pathname: '/guide',
            params: { exerciseId: exerciseInfo.exercise.id },
        });
    }, [exerciseInfo?.exercise.id]);

    const handlePreviewOpen = useCallback((name: string, gifFilename: string) => {
        router.navigate({
            pathname: '/preview',
            params: { name, gifFilename },
        });
    }, []);

    return (
        <VStack style={styles.container}>
            <Box style={styles.muscleGroupContainer}>
                <Text style={styles.muscleGroup}>{muscleGroup}</Text>
            </Box>
            <Box style={styles.titleContainer}>
                <Title type="h5" style={styles.title}>
                    {exerciseInfo?.exercise.name || 'Exercise'}
                </Title>
                <Text style={styles.subtitle}>
                    {exerciseInfo?.exercise.tracking
                        .map((v) => t(`exerciseTracking.${v}`, { ns: 'common' }))
                        .join(' + ')}
                </Text>
            </Box>
            <HStack style={styles.actionsContainer}>
                <Box style={styles.leftActionsContainer}>
                    <PreviewThumbnail
                        name={exerciseInfo?.exercise.name ?? ''}
                        gifFilename={exerciseInfo?.exercise.gifFilename}
                        onOpen={handlePreviewOpen}
                        containerStyle={styles.previewThumbnailContainer}
                    />
                </Box>
                <Box style={styles.centerActionsContainer}>
                    <Pressable style={styles.exerciseLinkWrapper} onPress={handleExerciseLinkPress}>
                        <Text style={styles.exerciseLink}>{t('exercise', { ns: 'common' })}</Text>
                        <ChevronRight size={theme.space(4)} color={theme.colors.neutral[950]} />
                    </Pressable>
                </Box>
                <Box style={styles.rightActionsContainer}>
                    {hasGuide && (
                        <Pressable onPress={handleGuideOpen}>
                            <Box style={styles.guideButton}>
                                <ChevronsUp
                                    size={theme.space(6)}
                                    color={theme.colors.neutral[950]}
                                />
                            </Box>
                        </Pressable>
                    )}
                </Box>
            </HStack>
        </VStack>
    );
};
