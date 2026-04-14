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

interface AverageWeightCardProps {
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

export const AverageWeightCard = ({ history, exercise }: AverageWeightCardProps) => {
    const { t } = useTranslation(['common', 'screens']);
    const { user } = useUser();

    const displayWeightUnits = user?.weightUnits ?? exercise.weightUnits ?? 'kg';

    const averageWeightPoints = useMemo<MetricChartPoint[]>(() => {
        const points: MetricChartPoint[] = [];

        for (const historyItem of history) {
            let totalWeightByReps = 0;
            let totalReps = 0;

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

                totalWeightByReps += normalizedWeight * set.reps;
                totalReps += set.reps;
            }

            if (totalReps <= 0) continue;

            const date = resolveWorkoutDate(historyItem);
            const averageWeight = totalWeightByReps / totalReps;

            points.push({
                id: historyItem.workoutExercise.id,
                value: roundOneDecimal(averageWeight),
                date,
                label: dayjs(date).format('DD.MM'),
            });
        }

        return sortMetricPoints(points);
    }, [displayWeightUnits, exercise.weightUnits, history]);

    const periodAverageWeight = useMemo(() => {
        let totalWeightByReps = 0;
        let totalReps = 0;

        for (const historyItem of history) {
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

                totalWeightByReps += normalizedWeight * set.reps;
                totalReps += set.reps;
            }
        }

        if (totalReps <= 0) return null;
        return roundOneDecimal(totalWeightByReps / totalReps);
    }, [displayWeightUnits, exercise.weightUnits, history]);

    const latestPoint = useMemo(() => {
        if (averageWeightPoints.length === 0) return null;
        return averageWeightPoints[averageWeightPoints.length - 1];
    }, [averageWeightPoints]);

    const formatWeightValue = (value: number): string =>
        t('weight.weight', {
            value: roundOneDecimal(value),
            context: displayWeightUnits,
            ns: 'common',
        });

    const cardTitle = t('exercise.stats.averageWeight.cardTitle', { ns: 'screens' });
    const cardDescription = t('exercise.stats.averageWeight.description', { ns: 'screens' });

    if (averageWeightPoints.length === 0) {
        return (
            <MetricCardShell title={cardTitle} description={cardDescription}>
                <MetricCardEmptyState
                    title={t('exercise.stats.averageWeight.empty.title', { ns: 'screens' })}
                    description={t('exercise.stats.averageWeight.empty.description', {
                        ns: 'screens',
                    })}
                />
            </MetricCardShell>
        );
    }

    return (
        <MetricCardShell title={cardTitle} description={cardDescription}>
            <Text style={styles.bestValue}>
                {periodAverageWeight != null ? formatWeightValue(periodAverageWeight) : '-'}
            </Text>
            <HStack style={styles.metricsRow}>
                <MetricStatCard
                    value={latestPoint ? formatWeightValue(latestPoint.value) : '-'}
                    label={t('exercise.stats.averageWeight.latest', { ns: 'screens' })}
                />
                <MetricStatCard
                    value={t('number', { value: averageWeightPoints.length, ns: 'common' })}
                    label={t('exercise.stats.averageWeight.workoutsCount', { ns: 'screens' })}
                />
            </HStack>
            <MetricBarChart points={averageWeightPoints} formatTooltipValue={formatWeightValue} />
        </MetricCardShell>
    );
};
