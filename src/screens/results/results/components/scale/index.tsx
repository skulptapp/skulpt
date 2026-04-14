import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Plus } from 'lucide-react-native';

import { HStack } from '@/components/primitives/hstack';
import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';
import { useLatestMeasurementsByMetric, useMeasurementTimeline } from '@/hooks/use-measurements';
import { useEditor } from '@/hooks/use-editor';
import { useUser } from '@/hooks/use-user';
import { WeightChart } from './components/weight-chart';
import { type MeasurementWithDisplayValue } from './types';
import { convertToDisplayWeight } from './utils';
import { Button } from '@/components/buttons/base';

const styles = StyleSheet.create((theme, rt) => ({
    section: {
        gap: theme.space(3),
    },
    sectionTitle: {
        ...theme.fontSize['2xl'],
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    card: {
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['4xl'],
        padding: theme.space(4),
        gap: theme.space(4),
    },
    summaryRow: {
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    summaryColumn: {
        flex: 1,
        gap: theme.space(0.5),
    },
    metricTitle: {
        ...theme.fontSize.sm,
        color: theme.colors.typography,
        opacity: 0.6,
    },
    metricValue: {
        ...theme.fontSize['3xl'],
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    prefixBox: {
        backgroundColor: rt.themeName === 'dark' ? theme.colors.white : theme.colors.neutral[950],
        borderRadius: theme.radius.full,
        justifyContent: 'center',
        alignItems: 'center',
        height: theme.space(8),
        width: theme.space(8),
        marginTop: theme.space(1.5),
    },
}));

const Scale = () => {
    const { t, i18n } = useTranslation(['common', 'screens']);
    const { navigate } = useEditor();
    const { user } = useUser();
    const { theme, rt } = useUnistyles();
    const weightTimeline = useMeasurementTimeline('body_weight');
    const latestByMetric = useLatestMeasurementsByMetric(['body_weight', 'body_fat_percentage']);
    const [weightUnits, setWeightUnits] = useState<'kg' | 'lb'>(user?.bodyWeightUnits ?? 'kg');

    useEffect(() => {
        setWeightUnits(user?.bodyWeightUnits ?? 'kg');
    }, [user?.bodyWeightUnits]);

    const latestWeight = latestByMetric['body_weight'];

    const numberFormatter = useMemo(
        () =>
            new Intl.NumberFormat(i18n.language, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 1,
            }),
        [i18n.language],
    );

    const latestWeightDisplay = useMemo(() => {
        if (!latestWeight) return '-';
        const converted = convertToDisplayWeight(
            latestWeight.value,
            latestWeight.unit,
            weightUnits,
        );
        if (converted == null) return '-';
        return `${numberFormatter.format(converted)} ${weightUnits}`;
    }, [latestWeight, numberFormatter, weightUnits]);

    const timelineWithDisplayValues = useMemo(() => {
        return weightTimeline
            .map((entry) => {
                const converted = convertToDisplayWeight(entry.value, entry.unit, weightUnits);
                if (converted == null) return null;
                return {
                    ...entry,
                    displayValue: converted,
                };
            })
            .filter(
                (entry): entry is MeasurementWithDisplayValue =>
                    entry !== null && Number.isFinite(entry.displayValue),
            );
    }, [weightTimeline, weightUnits]);

    const handleOpenMeasurementEditor = useCallback(() => {
        navigate({
            type: 'measurement__create',
        });
    }, [navigate]);

    return (
        <VStack style={styles.section}>
            <Text style={styles.sectionTitle}>{t('results.scale.title', { ns: 'screens' })}</Text>
            <VStack style={styles.card}>
                <HStack style={styles.summaryRow}>
                    <VStack style={styles.summaryColumn}>
                        <Text style={styles.metricValue}>{latestWeightDisplay}</Text>
                        <Text style={styles.metricTitle}>
                            {t('results.scale.metrics.currentWeight', { ns: 'screens' })}
                        </Text>
                    </VStack>
                    <Button
                        type="link"
                        prefix={
                            <Box style={styles.prefixBox}>
                                <Plus
                                    size={theme.space(5.5)}
                                    color={
                                        rt.themeName === 'dark'
                                            ? theme.colors.neutral[950]
                                            : theme.colors.white
                                    }
                                />
                            </Box>
                        }
                        onPress={handleOpenMeasurementEditor}
                    />
                </HStack>
                <WeightChart
                    timeline={timelineWithDisplayValues}
                    weightUnits={weightUnits}
                    numberFormatter={numberFormatter}
                />
            </VStack>
        </VStack>
    );
};

export { Scale };
