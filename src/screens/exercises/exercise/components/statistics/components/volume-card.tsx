import { useMemo } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';

import type { ExerciseHistoryItem } from '@/crud/exercise';
import type { ExerciseSelect } from '@/db/schema';
import { isWarmupSetType } from '@/helpers/set-type';
import { convertWeight } from '@/helpers/units';
import { useUser } from '@/hooks/use-user';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { MetricBarChart } from './metric-bar-chart';
import { MetricCardEmptyState } from './metric-card-empty-state';
import { MetricCardShell } from './metric-card-shell';
import { MetricStatCard } from './metric-stat-card';
import {
    type MetricChartPoint,
    resolveWorkoutDate,
    roundOneDecimal,
    sortMetricPoints,
} from './metric-utils';

interface VolumeCardProps {
    history: ExerciseHistoryItem[];
    exercise: ExerciseSelect;
}

const styles = StyleSheet.create((theme) => ({
    bestValue: {
        ...theme.fontSize['3xl'],
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    metricsRow: {
        gap: theme.space(4),
        marginTop: theme.space(1.5),
    },
}));

export const VolumeCard = ({ history, exercise }: VolumeCardProps) => {
    const { t } = useTranslation(['common', 'screens']);
    const { user } = useUser();

    const displayWeightUnits = user?.weightUnits ?? exercise.weightUnits ?? 'kg';

    const volumePoints = useMemo<MetricChartPoint[]>(() => {
        const points: MetricChartPoint[] = [];

        for (const historyItem of history) {
            let workoutExerciseVolume = 0;

            for (const set of historyItem.sets) {
                if (isWarmupSetType(set.type)) continue;
                if (set.weight == null || set.reps == null) continue;
                if (set.weight <= 0 || set.reps <= 0) continue;

                const sourceWeightUnits =
                    set.weightUnits ?? exercise.weightUnits ?? displayWeightUnits;
                const normalizedWeight =
                    sourceWeightUnits === displayWeightUnits
                        ? set.weight
                        : convertWeight(set.weight, sourceWeightUnits, displayWeightUnits);

                workoutExerciseVolume += normalizedWeight * set.reps;
            }

            if (workoutExerciseVolume <= 0) continue;

            const date = resolveWorkoutDate(historyItem);

            points.push({
                id: historyItem.workoutExercise.id,
                value: roundOneDecimal(workoutExerciseVolume),
                date,
                label: dayjs(date).format('DD.MM'),
            });
        }

        return sortMetricPoints(points);
    }, [displayWeightUnits, exercise.weightUnits, history]);

    const bestPoint = useMemo(() => {
        if (volumePoints.length === 0) return null;
        return volumePoints.reduce(
            (best, point) => (point.value > best.value ? point : best),
            volumePoints[0],
        );
    }, [volumePoints]);

    const latestPoint = useMemo(() => {
        if (volumePoints.length === 0) return null;
        return volumePoints[volumePoints.length - 1];
    }, [volumePoints]);

    const progressFromPrevious = useMemo(() => {
        if (volumePoints.length < 2) return null;

        const latestValue = volumePoints[volumePoints.length - 1].value;
        const previousValue = volumePoints[volumePoints.length - 2].value;

        if (previousValue <= 0) return null;

        return ((latestValue - previousValue) / previousValue) * 100;
    }, [volumePoints]);

    const formatWeightValue = (value: number): string =>
        t('weight.weight', {
            value: roundOneDecimal(value),
            context: displayWeightUnits,
            ns: 'common',
        });

    const formatProgressValue = (value: number | null): string => {
        if (value == null || !Number.isFinite(value)) return '-';
        const roundedValue = roundOneDecimal(value);
        const sign = roundedValue > 0 ? '+' : '';

        return `${sign}${t('number', { value: roundedValue, ns: 'common' })}%`;
    };

    const cardTitle = t('exercise.stats.volume.cardTitle', { ns: 'screens' });
    const cardDescription = t('exercise.stats.volume.description', { ns: 'screens' });

    if (volumePoints.length === 0) {
        return (
            <MetricCardShell title={cardTitle} description={cardDescription}>
                <MetricCardEmptyState
                    title={t('exercise.stats.volume.empty.title', { ns: 'screens' })}
                    description={t('exercise.stats.volume.empty.description', { ns: 'screens' })}
                />
            </MetricCardShell>
        );
    }

    return (
        <MetricCardShell title={cardTitle} description={cardDescription}>
            <Text style={styles.bestValue}>
                {bestPoint ? formatWeightValue(bestPoint.value) : '-'}
            </Text>
            <HStack style={styles.metricsRow}>
                <MetricStatCard
                    value={latestPoint ? formatWeightValue(latestPoint.value) : '-'}
                    label={t('exercise.stats.volume.latest', { ns: 'screens' })}
                />
                <MetricStatCard
                    value={formatProgressValue(progressFromPrevious)}
                    label={t('exercise.stats.volume.progress', { ns: 'screens' })}
                />
            </HStack>
            <MetricBarChart points={volumePoints} formatTooltipValue={formatWeightValue} />
        </MetricCardShell>
    );
};
