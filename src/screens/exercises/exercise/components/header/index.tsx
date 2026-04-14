import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { Image as ExpoImage } from 'expo-image';

import { Title } from '@/components/typography/title';
import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { ExerciseSelect } from '@/db/schema';
import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { normalizeMuscleValues } from '@/constants/muscles';
import { buildExerciseGifUrl } from '@/constants/skulpt';

interface HeaderProps {
    exercise: ExerciseSelect;
}

const styles = StyleSheet.create((theme, rt) => ({
    wrapper: {
        paddingHorizontal: theme.space(4),
    },
    container: {
        padding: theme.space(5),
        backgroundColor: theme.colors.white,
        borderRadius: theme.radius['4xl'],
        borderColor: theme.colors.border,
        borderWidth: rt.themeName === 'dark' ? 0 : StyleSheet.hairlineWidth,
        gap: theme.space(5),
    },
    title: {
        color: theme.colors.neutral[950],
    },
    infoContainer: {
        gap: theme.space(2),
    },
    muscleGroupsContainer: {
        flexWrap: 'wrap',
        gap: theme.space(2),
    },
    muscleGroupValueContainer: {
        paddingHorizontal: theme.space(3),
        paddingVertical: theme.space(0.5),
        backgroundColor: theme.colors.neutral[950],
        borderRadius: theme.radius['full'],
    },
    muscleGroupValue: {
        color: theme.colors.white,
        fontSize: theme.fontSize.sm.fontSize,
        fontWeight: theme.fontWeight.default.fontWeight,
    },
    exerciseTrackingGroupValue: {
        color: theme.colors.neutral[950],
        fontSize: theme.fontSize.sm.fontSize,
        fontWeight: theme.fontWeight.default.fontWeight,
    },
    gifImage: {
        width: '100%',
    },
}));

export const Header = ({ exercise }: HeaderProps) => {
    const { t } = useTranslation(['common']);
    const primaryMuscleGroups = normalizeMuscleValues(exercise.primaryMuscleGroups) || [];
    const [aspectRatio, setAspectRatio] = useState<number>(1);

    const gifUrl = useMemo(() => {
        if (!exercise.gifFilename) return null;
        return buildExerciseGifUrl(exercise.gifFilename, 1080);
    }, [exercise.gifFilename]);

    return (
        <Box style={styles.wrapper}>
            <VStack style={styles.container}>
                <Box>
                    <Title type="h3" style={styles.title}>
                        {exercise.name}
                    </Title>
                </Box>
                {gifUrl && (
                    <ExpoImage
                        source={{ uri: gifUrl }}
                        style={[styles.gifImage, { aspectRatio }]}
                        contentFit="contain"
                        autoplay
                        onLoad={(e) => setAspectRatio(e.source.width / e.source.height)}
                    />
                )}
                {(exercise.tracking || primaryMuscleGroups.length > 0) && (
                    <VStack style={styles.infoContainer}>
                        {exercise.tracking && (
                            <Box>
                                <Text style={styles.exerciseTrackingGroupValue}>
                                    {exercise.tracking
                                        .map((v) => t(`exerciseTracking.${v}`, { ns: 'common' }))
                                        .join(' + ')}
                                </Text>
                            </Box>
                        )}
                        {primaryMuscleGroups.length > 0 && (
                            <HStack style={styles.muscleGroupsContainer}>
                                {primaryMuscleGroups.map((muscleGroup) => (
                                    <Box key={muscleGroup} style={styles.muscleGroupValueContainer}>
                                        <Text style={styles.muscleGroupValue}>
                                            {t(`muscleGroup.${muscleGroup}`, { ns: 'common' })}
                                        </Text>
                                    </Box>
                                ))}
                            </HStack>
                        )}
                    </VStack>
                )}
            </VStack>
        </Box>
    );
};
