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
import { type MetricChartPoint, resolveWorkoutDate, roundOneDecimal } from './metric-utils';

interface IntensityCardProps {
    history: ExerciseHistoryItem[];
    exercise: ExerciseSelect;
}

interface IntensityComputedData {
    points: MetricChartPoint[];
    periodAverageIntensity: number | null;
}

const INTENSITY_LOOKBACK_WORKOUTS = 5;

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

export const IntensityCard = ({ history, exercise }: IntensityCardProps) => {
    const { t } = useTranslation(['common', 'screens']);
    const { user } = useUser();

    const displayWeightUnits = user?.weightUnits ?? exercise.weightUnits ?? 'kg';

    const { points: intensityPoints, periodAverageIntensity } =
        useMemo<IntensityComputedData>(() => {
            type PreparedWorkout = {
                id: string;
                date: Date;
                label: string;
                sets: { weight: number; reps: number }[];
                workoutBestOneRm: number;
            };

            const workouts: PreparedWorkout[] = [];

            for (const historyItem of history) {
                let workoutBestOneRm = 0;
                const normalizedSets: { weight: number; reps: number }[] = [];
                const date = resolveWorkoutDate(historyItem);

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

                    const setOneRm = normalizedWeight * (1 + set.reps / 30);
                    if (Number.isFinite(setOneRm) && setOneRm > workoutBestOneRm) {
                        workoutBestOneRm = setOneRm;
                    }

                    normalizedSets.push({ weight: normalizedWeight, reps: set.reps });
                }

                if (normalizedSets.length === 0) continue;
                workouts.push({
                    id: historyItem.workoutExercise.id,
                    date,
                    label: dayjs(date).format('DD.MM'),
                    sets: normalizedSets,
                    workoutBestOneRm,
                });
            }

            workouts.sort((a, b) => {
                const timeDiff = a.date.getTime() - b.date.getTime();
                if (timeDiff !== 0) return timeDiff;
                return a.id.localeCompare(b.id);
            });

            const points: MetricChartPoint[] = [];
            let totalWeightedIntensitySum = 0;
            let totalTonnage = 0;

            for (let workoutIndex = 0; workoutIndex < workouts.length; workoutIndex++) {
                const workoutData = workouts[workoutIndex];
                const lookbackStart = Math.max(0, workoutIndex - INTENSITY_LOOKBACK_WORKOUTS);

                let referenceOneRm = 0;
                for (
                    let previousIndex = lookbackStart;
                    previousIndex < workoutIndex;
                    previousIndex++
                ) {
                    referenceOneRm = Math.max(
                        referenceOneRm,
                        workouts[previousIndex].workoutBestOneRm,
                    );
                }

                if (referenceOneRm <= 0) {
                    referenceOneRm = workoutData.workoutBestOneRm;
                }
                if (referenceOneRm <= 0) continue;

                let workoutWeightedIntensitySum = 0;
                let workoutTonnage = 0;

                for (const set of workoutData.sets) {
                    const setTonnage = set.weight * set.reps;
                    const setIntensity = (set.weight / referenceOneRm) * 100;

                    workoutTonnage += setTonnage;
                    workoutWeightedIntensitySum += setTonnage * setIntensity;
                }

                if (workoutTonnage <= 0) continue;

                const workoutAverageIntensity = workoutWeightedIntensitySum / workoutTonnage;

                points.push({
                    id: workoutData.id,
                    value: roundOneDecimal(workoutAverageIntensity),
                    date: workoutData.date,
                    label: workoutData.label,
                });

                totalWeightedIntensitySum += workoutWeightedIntensitySum;
                totalTonnage += workoutTonnage;
            }

            return {
                points,
                periodAverageIntensity:
                    totalTonnage > 0
                        ? roundOneDecimal(totalWeightedIntensitySum / totalTonnage)
                        : null,
            };
        }, [displayWeightUnits, exercise.weightUnits, history]);

    const latestPoint = useMemo(() => {
        if (intensityPoints.length === 0) return null;
        return intensityPoints[intensityPoints.length - 1];
    }, [intensityPoints]);

    const formatIntensityValue = (value: number): string =>
        `${t('number', { value: roundOneDecimal(value), ns: 'common' })}%`;

    const cardTitle = t('exercise.stats.intensity.cardTitle', { ns: 'screens' });
    const cardDescription = t('exercise.stats.intensity.description', { ns: 'screens' });

    if (intensityPoints.length === 0) {
        return (
            <MetricCardShell title={cardTitle} description={cardDescription}>
                <MetricCardEmptyState
                    title={t('exercise.stats.intensity.empty.title', { ns: 'screens' })}
                    description={t('exercise.stats.intensity.empty.description', {
                        ns: 'screens',
                    })}
                />
            </MetricCardShell>
        );
    }

    return (
        <MetricCardShell title={cardTitle} description={cardDescription}>
            <Text style={styles.bestValue}>
                {periodAverageIntensity != null
                    ? formatIntensityValue(periodAverageIntensity)
                    : '-'}
            </Text>
            <HStack style={styles.metricsRow}>
                <MetricStatCard
                    value={latestPoint ? formatIntensityValue(latestPoint.value) : '-'}
                    label={t('exercise.stats.intensity.latest', { ns: 'screens' })}
                />
                <MetricStatCard
                    value={t('number', { value: intensityPoints.length, ns: 'common' })}
                    label={t('exercise.stats.intensity.workoutsCount', { ns: 'screens' })}
                />
            </HStack>
            <MetricBarChart points={intensityPoints} formatTooltipValue={formatIntensityValue} />
        </MetricCardShell>
    );
};
