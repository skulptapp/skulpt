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

interface OneRmCardProps {
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

export const OneRmCard = ({ history, exercise }: OneRmCardProps) => {
    const { t } = useTranslation(['common', 'screens']);
    const { user } = useUser();

    const displayWeightUnits = user?.weightUnits ?? exercise.weightUnits ?? 'kg';

    const oneRmPoints = useMemo<MetricChartPoint[]>(() => {
        const points: MetricChartPoint[] = [];

        for (const historyItem of history) {
            let workoutExerciseOneRm = 0;

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
                const oneRm = normalizedWeight * (1 + set.reps / 30);

                if (Number.isFinite(oneRm) && oneRm > workoutExerciseOneRm) {
                    workoutExerciseOneRm = oneRm;
                }
            }

            if (workoutExerciseOneRm <= 0) continue;

            const date = resolveWorkoutDate(historyItem);

            points.push({
                id: historyItem.workoutExercise.id,
                value: roundOneDecimal(workoutExerciseOneRm),
                date,
                label: dayjs(date).format('DD.MM'),
            });
        }

        return sortMetricPoints(points);
    }, [displayWeightUnits, exercise.weightUnits, history]);

    const bestPoint = useMemo(() => {
        if (oneRmPoints.length === 0) return null;
        return oneRmPoints.reduce(
            (best, point) => (point.value > best.value ? point : best),
            oneRmPoints[0],
        );
    }, [oneRmPoints]);

    const latestPoint = useMemo(() => {
        if (oneRmPoints.length === 0) return null;
        return oneRmPoints[oneRmPoints.length - 1];
    }, [oneRmPoints]);

    const formatWeightValue = (value: number): string =>
        t('weight.weight', {
            value: roundOneDecimal(value),
            context: displayWeightUnits,
            ns: 'common',
        });

    const cardTitle = t('exercise.stats.oneRm.cardTitle', { ns: 'screens' });
    const cardDescription = t('exercise.stats.oneRm.description', { ns: 'screens' });

    if (oneRmPoints.length === 0) {
        return (
            <MetricCardShell title={cardTitle} description={cardDescription}>
                <MetricCardEmptyState
                    title={t('exercise.stats.empty.title', { ns: 'screens' })}
                    description={t('exercise.stats.empty.description', { ns: 'screens' })}
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
                    label={t('exercise.stats.oneRm.latest', { ns: 'screens' })}
                />
                <MetricStatCard
                    value={t('number', { value: oneRmPoints.length, ns: 'common' })}
                    label={t('exercise.stats.oneRm.workoutsCount', { ns: 'screens' })}
                />
            </HStack>
            <MetricBarChart points={oneRmPoints} formatTooltipValue={formatWeightValue} />
        </MetricCardShell>
    );
};
