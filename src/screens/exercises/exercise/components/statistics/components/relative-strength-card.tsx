import { useMemo } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';

import type { ExerciseHistoryItem } from '@/crud/exercise';
import type { ExerciseSelect } from '@/db/schema';
import { isWarmupSetType } from '@/helpers/set-type';
import { convertWeight } from '@/helpers/units';
import { useMeasurementTimeline } from '@/hooks/use-measurements';
import { useUser } from '@/hooks/use-user';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { MetricBarChart } from './metric-bar-chart';
import { MetricCardEmptyState } from './metric-card-empty-state';
import { MetricCardShell } from './metric-card-shell';
import { MetricStatCard } from './metric-stat-card';
import {
    type MetricChartPoint,
    isWeightUnit,
    resolveWorkoutDate,
    roundTwoDecimals,
    sortMetricPoints,
} from './metric-utils';

interface RelativeStrengthCardProps {
    history: ExerciseHistoryItem[];
    exercise: ExerciseSelect;
}

type StrengthClassification = 'novice' | 'beginner' | 'intermediate' | 'advanced' | 'elite';

interface BodyWeightMeasurement {
    recordedAt: Date;
    value: number;
    dayStartMs: number;
    dayKey: string;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

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

const resolveClassification = (value: number): StrengthClassification => {
    if (value < 0.75) return 'novice';
    if (value <= 1.0) return 'beginner';
    if (value <= 1.5) return 'intermediate';
    if (value <= 2.0) return 'advanced';
    return 'elite';
};

const getDayKey = (date: Date): string => dayjs(date).format('YYYY-MM-DD');

export const RelativeStrengthCard = ({ history, exercise }: RelativeStrengthCardProps) => {
    const { t } = useTranslation(['common', 'screens']);
    const { user } = useUser();
    const bodyWeightTimeline = useMeasurementTimeline('body_weight');

    const displayWeightUnits = user?.weightUnits ?? exercise.weightUnits ?? 'kg';

    const oneRmWorkouts = useMemo<
        { id: string; date: Date; label: string; oneRm: number }[]
    >(() => {
        const workouts: { id: string; date: Date; label: string; oneRm: number }[] = [];

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

            workouts.push({
                id: historyItem.workoutExercise.id,
                date,
                label: dayjs(date).format('DD.MM'),
                oneRm: workoutExerciseOneRm,
            });
        }

        workouts.sort((a, b) => {
            const timeDiff = a.date.getTime() - b.date.getTime();
            if (timeDiff !== 0) return timeDiff;
            return a.id.localeCompare(b.id);
        });

        return workouts;
    }, [displayWeightUnits, exercise.weightUnits, history]);

    const normalizedBodyWeightTimeline = useMemo<BodyWeightMeasurement[]>(() => {
        return bodyWeightTimeline
            .map((entry) => {
                if (!Number.isFinite(entry.value) || entry.value <= 0) return null;
                if (!isWeightUnit(entry.unit)) return null;

                const normalizedValue =
                    entry.unit === displayWeightUnits
                        ? entry.value
                        : convertWeight(entry.value, entry.unit, displayWeightUnits);
                if (!Number.isFinite(normalizedValue) || normalizedValue <= 0) return null;

                return {
                    recordedAt: entry.recordedAt,
                    value: normalizedValue,
                    dayStartMs: dayjs(entry.recordedAt).startOf('day').valueOf(),
                    dayKey: getDayKey(entry.recordedAt),
                };
            })
            .filter((entry): entry is BodyWeightMeasurement => entry !== null)
            .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
    }, [bodyWeightTimeline, displayWeightUnits]);

    const relativeStrengthPoints = useMemo<MetricChartPoint[]>(() => {
        if (oneRmWorkouts.length === 0 || normalizedBodyWeightTimeline.length === 0) return [];

        const points: MetricChartPoint[] = [];

        const latestMeasurementByDay = new Map<string, BodyWeightMeasurement>();
        for (const measurement of normalizedBodyWeightTimeline) {
            const existingMeasurement = latestMeasurementByDay.get(measurement.dayKey);
            if (
                !existingMeasurement ||
                existingMeasurement.recordedAt.getTime() < measurement.recordedAt.getTime()
            ) {
                latestMeasurementByDay.set(measurement.dayKey, measurement);
            }
        }

        const measurementByDayStart = new Map<number, number>();
        for (const measurement of latestMeasurementByDay.values()) {
            measurementByDayStart.set(measurement.dayStartMs, measurement.value);
        }

        const firstMeasurementDayStartMs = normalizedBodyWeightTimeline[0]?.dayStartMs ?? null;
        const lastMeasurementDayStartMs =
            normalizedBodyWeightTimeline[normalizedBodyWeightTimeline.length - 1]?.dayStartMs ??
            null;
        const todayDayStartMs = dayjs().startOf('day').valueOf();

        for (const workout of oneRmWorkouts) {
            const workoutDayKey = getDayKey(workout.date);
            const workoutDayStartMs = dayjs(workout.date).startOf('day').valueOf();

            const sameDayMeasurement = latestMeasurementByDay.get(workoutDayKey);
            let bodyWeightForWorkout: number | null = sameDayMeasurement?.value ?? null;

            if (
                bodyWeightForWorkout == null &&
                firstMeasurementDayStartMs != null &&
                lastMeasurementDayStartMs != null
            ) {
                const maxForwardDayStartMs = Math.min(lastMeasurementDayStartMs, todayDayStartMs);
                const maxForwardDistanceDays =
                    maxForwardDayStartMs > workoutDayStartMs
                        ? Math.ceil((maxForwardDayStartMs - workoutDayStartMs) / DAY_IN_MS)
                        : 0;
                const maxDistanceDays = Math.max(
                    Math.ceil(Math.abs(workoutDayStartMs - firstMeasurementDayStartMs) / DAY_IN_MS),
                    maxForwardDistanceDays,
                );

                for (let dayOffset = 1; dayOffset <= maxDistanceDays; dayOffset += 1) {
                    const previousDayWeight = measurementByDayStart.get(
                        workoutDayStartMs - dayOffset * DAY_IN_MS,
                    );
                    if (previousDayWeight != null) {
                        bodyWeightForWorkout = previousDayWeight;
                        break;
                    }

                    const nextDayStartMs = workoutDayStartMs + dayOffset * DAY_IN_MS;
                    if (nextDayStartMs > todayDayStartMs) {
                        continue;
                    }

                    const nextDayWeight = measurementByDayStart.get(nextDayStartMs);
                    if (nextDayWeight != null) {
                        bodyWeightForWorkout = nextDayWeight;
                        break;
                    }
                }
            }

            if (bodyWeightForWorkout == null || bodyWeightForWorkout <= 0) continue;

            const relativeStrength = workout.oneRm / bodyWeightForWorkout;
            if (!Number.isFinite(relativeStrength) || relativeStrength <= 0) continue;

            points.push({
                id: workout.id,
                value: roundTwoDecimals(relativeStrength),
                date: workout.date,
                label: workout.label,
            });
        }

        return sortMetricPoints(points);
    }, [normalizedBodyWeightTimeline, oneRmWorkouts]);

    const bestPoint = useMemo(() => {
        if (relativeStrengthPoints.length === 0) return null;
        return relativeStrengthPoints.reduce(
            (best, point) => (point.value > best.value ? point : best),
            relativeStrengthPoints[0],
        );
    }, [relativeStrengthPoints]);

    const latestPoint = useMemo(() => {
        if (relativeStrengthPoints.length === 0) return null;
        return relativeStrengthPoints[relativeStrengthPoints.length - 1];
    }, [relativeStrengthPoints]);

    const latestClassification = useMemo(() => {
        if (!latestPoint) return null;
        return resolveClassification(latestPoint.value);
    }, [latestPoint]);

    const relativeStrengthChartMaxValue = useMemo(() => {
        const rawMaxValue = relativeStrengthPoints.reduce(
            (maxValue, point) => Math.max(maxValue, point.value),
            0,
        );
        if (rawMaxValue <= 0) return 1;
        if (rawMaxValue <= 1) return 1;
        return Math.ceil(rawMaxValue * 4) / 4;
    }, [relativeStrengthPoints]);

    const formatStrengthValue = (value: number): string =>
        t('number', {
            value: roundTwoDecimals(value),
            ns: 'common',
        });

    const formatStrengthAxisValue = (value: number): string =>
        t('number', {
            value: roundTwoDecimals(value),
            ns: 'common',
        });

    const cardTitle = t('exercise.stats.relativeStrength.cardTitle', { ns: 'screens' });
    const cardDescription = t('exercise.stats.relativeStrength.description', { ns: 'screens' });

    if (oneRmWorkouts.length === 0) {
        return (
            <MetricCardShell title={cardTitle} description={cardDescription}>
                <MetricCardEmptyState
                    title={t('exercise.stats.relativeStrength.empty.noTraining.title', {
                        ns: 'screens',
                    })}
                    description={t('exercise.stats.relativeStrength.empty.noTraining.description', {
                        ns: 'screens',
                    })}
                />
            </MetricCardShell>
        );
    }

    if (normalizedBodyWeightTimeline.length === 0 || relativeStrengthPoints.length === 0) {
        return (
            <MetricCardShell title={cardTitle} description={cardDescription}>
                <MetricCardEmptyState
                    title={t('exercise.stats.relativeStrength.empty.noBodyWeight.title', {
                        ns: 'screens',
                    })}
                    description={t(
                        'exercise.stats.relativeStrength.empty.noBodyWeight.description',
                        {
                            ns: 'screens',
                        },
                    )}
                />
            </MetricCardShell>
        );
    }

    return (
        <MetricCardShell title={cardTitle} description={cardDescription}>
            <Text style={styles.bestValue}>
                {bestPoint ? formatStrengthValue(bestPoint.value) : '-'}
            </Text>
            <HStack style={styles.metricsRow}>
                <MetricStatCard
                    value={latestPoint ? formatStrengthValue(latestPoint.value) : '-'}
                    label={t('exercise.stats.relativeStrength.latest', { ns: 'screens' })}
                />
                <MetricStatCard
                    value={
                        latestClassification
                            ? t(
                                  `exercise.stats.relativeStrength.classification.${latestClassification}`,
                                  { ns: 'screens' },
                              )
                            : '-'
                    }
                    label={t('exercise.stats.relativeStrength.classificationLabel', {
                        ns: 'screens',
                    })}
                />
            </HStack>
            <MetricBarChart
                points={relativeStrengthPoints}
                formatTooltipValue={formatStrengthValue}
                formatAxisValue={formatStrengthAxisValue}
                maxValue={relativeStrengthChartMaxValue}
            />
        </MetricCardShell>
    );
};
