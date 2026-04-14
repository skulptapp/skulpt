import { FC } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { XIcon } from 'lucide-react-native';

import { Box } from '@/components/primitives/box';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { ExerciseSelect } from '@/db/schema';
import { HStack } from '@/components/primitives/hstack';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        paddingHorizontal: theme.space(4),
        gap: theme.space(10),
    },
    section: {
        gap: theme.space(4),
    },
    sectionContent: {
        gap: theme.space(4),
    },
    sectionTitle: {
        color: theme.colors.typography,
        fontSize: theme.fontSize['2xl'].fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
    },
    description: {
        color: theme.colors.typography,
        lineHeight: 22,
    },
    instructionSection: {
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['4xl'],
        padding: theme.space(5),
    },
    instructionRow: {
        flexDirection: 'row',
    },
    instructionContent: {
        flex: 1,
        flexShrink: 1,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
        marginTop: theme.space(4),
    },
    instructionNumber: {
        color: theme.colors.typography,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        lineHeight: 22,
        width: theme.space(8),
    },
    instructionText: {
        color: theme.colors.typography,
        lineHeight: 22,
    },
    mistakeSection: {
        backgroundColor: theme.colors.red[500],
        borderRadius: theme.radius['4xl'],
        padding: theme.space(5),
    },
    mistakeRow: {
        alignItems: 'center',
    },
    mistakeIconContainer: {
        width: theme.space(8),
        alignItems: 'flex-start',
    },
    mistakeBullet: {
        color: theme.colors.white,
        fontWeight: theme.fontWeight.bold.fontWeight,
        lineHeight: 22,
    },
    mistakeTitle: {
        color: theme.colors.white,
    },
    mistakeText: {
        color: theme.colors.white,
        lineHeight: 22,
        flex: 1,
        flexShrink: 1,
    },
    mistakeDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.red[100],
        opacity: 0.3,
        marginTop: theme.space(4),
        marginLeft: theme.space(8),
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: theme.space(8),
        paddingTop: theme.space(10),
        paddingBottom: rt.insets.bottom === 0 ? theme.space(10) : rt.insets.bottom,
        gap: theme.space(2),
    },
    emptyTitle: {
        color: theme.colors.typography,
        fontSize: theme.fontSize.xl.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
    },
    emptyDescription: {
        color: theme.colors.typography,
        opacity: 0.6,
        textAlign: 'center',
    },
}));

interface GuideProps {
    exercise: ExerciseSelect;
}

export const Guide: FC<GuideProps> = ({ exercise }) => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();

    const hasDescription = !!exercise.description;
    const hasInstructions = exercise.instructions && exercise.instructions.length > 0;
    const hasMistakes = exercise.mistakes && exercise.mistakes.length > 0;
    const hasContent = hasDescription || hasInstructions || hasMistakes;

    if (!hasContent) {
        return (
            <VStack style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>
                    {t('exercise.guide.empty.title', { ns: 'screens' })}
                </Text>
                <Text style={styles.emptyDescription}>
                    {t('exercise.guide.empty.description', { ns: 'screens' })}
                </Text>
            </VStack>
        );
    }

    return (
        <VStack style={styles.container}>
            {hasDescription && (
                <VStack style={styles.section}>
                    <Text style={styles.description}>{exercise.description}</Text>
                </VStack>
            )}

            {hasInstructions && (
                <VStack style={[styles.section, styles.instructionSection]}>
                    <Text style={styles.sectionTitle}>
                        {t('exercise.guide.instructions', { ns: 'screens' })}
                    </Text>
                    <VStack style={styles.sectionContent}>
                        {exercise.instructions!.map((instruction, index, arr) => (
                            <Box key={index} style={styles.instructionRow}>
                                <Text style={styles.instructionNumber}>{index + 1}.</Text>
                                <VStack style={styles.instructionContent}>
                                    <Text style={styles.instructionText}>{instruction}</Text>
                                    {index < arr.length - 1 && <Box style={styles.divider} />}
                                </VStack>
                            </Box>
                        ))}
                    </VStack>
                </VStack>
            )}

            {hasMistakes && (
                <VStack style={[styles.section, styles.mistakeSection]}>
                    <Text style={[styles.sectionTitle, styles.mistakeTitle]}>
                        {t('exercise.guide.mistakes', { ns: 'screens' })}
                    </Text>
                    <VStack style={styles.sectionContent}>
                        {exercise.mistakes!.map((mistake, index, arr) => (
                            <VStack key={index}>
                                <HStack style={styles.mistakeRow}>
                                    <Box style={styles.mistakeIconContainer}>
                                        <XIcon size={18} color={theme.colors.white} />
                                    </Box>
                                    <Text style={styles.mistakeText}>
                                        {mistake.endsWith('.') ? mistake : `${mistake}.`}
                                    </Text>
                                </HStack>
                                {index < arr.length - 1 && <Box style={styles.mistakeDivider} />}
                            </VStack>
                        ))}
                    </VStack>
                </VStack>
            )}
        </VStack>
    );
};
