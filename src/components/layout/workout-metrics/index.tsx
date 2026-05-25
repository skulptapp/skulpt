import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { MetricGrid, type MetricGridItem } from '@/components/layout/metric-grid';
import { formatWorkoutDuration } from '@/helpers/times';
import { useUser } from '@/hooks/use-user';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export interface WorkoutStatsDisplay {
    workoutsCount?: number;
    workoutDurationSeconds: number;
    totalSetTimeSeconds: number;
    totalRestTimeSeconds: number;
    volume: number;
    exercisesCount: number;
    setsCount: number;
    repsCount: number;
}

export const hasWorkoutMetrics = (values: WorkoutStatsDisplay): boolean => {
    return (
        (values.workoutsCount ?? 0) > 0 ||
        values.workoutDurationSeconds > 0 ||
        values.totalSetTimeSeconds > 0 ||
        values.totalRestTimeSeconds > 0 ||
        values.volume > 0 ||
        values.exercisesCount > 0 ||
        values.setsCount > 0 ||
        values.repsCount > 0
    );
};

export const buildWorkoutMetrics = (
    values: WorkoutStatsDisplay,
    t: Translate,
    weightUnits: 'kg' | 'lb' | null | undefined,
): MetricGridItem[] => {
    const formatNumber = (value: number) => t('number', { value, ns: 'common' });

    return [
        values.workoutsCount != null && values.workoutsCount > 0
            ? {
                  key: 'workoutsCount',
                  label: t('results.daySummary.stats.workoutsCount', { ns: 'screens' }),
                  value: formatNumber(values.workoutsCount),
              }
            : null,
        values.workoutDurationSeconds > 0
            ? {
                  key: 'workoutDuration',
                  label: t('results.daySummary.stats.totalWorkoutDuration', { ns: 'screens' }),
                  value: formatWorkoutDuration(values.workoutDurationSeconds),
              }
            : null,
        values.totalSetTimeSeconds > 0
            ? {
                  key: 'totalActiveTime',
                  label: t('results.daySummary.stats.totalActiveTime', { ns: 'screens' }),
                  value: formatWorkoutDuration(values.totalSetTimeSeconds),
              }
            : null,
        values.totalRestTimeSeconds > 0
            ? {
                  key: 'totalRestTime',
                  label: t('results.daySummary.stats.totalRestTime', { ns: 'screens' }),
                  value: formatWorkoutDuration(values.totalRestTimeSeconds),
              }
            : null,
        values.volume > 0
            ? {
                  key: 'volume',
                  label: t('results.daySummary.stats.volume', { ns: 'screens' }),
                  value: t('weight.weight', {
                      value: values.volume,
                      context: weightUnits ?? undefined,
                      ns: 'common',
                  }),
              }
            : null,
        values.exercisesCount > 0
            ? {
                  key: 'exercisesCount',
                  label: t('results.daySummary.stats.exercisesCount', { ns: 'screens' }),
                  value: formatNumber(values.exercisesCount),
              }
            : null,
        values.setsCount > 0
            ? {
                  key: 'setsCount',
                  label: t('results.daySummary.stats.setsCount', { ns: 'screens' }),
                  value: formatNumber(values.setsCount),
              }
            : null,
        values.repsCount > 0
            ? {
                  key: 'repsCount',
                  label: t('results.daySummary.stats.repsCount', { ns: 'screens' }),
                  value: formatNumber(values.repsCount),
              }
            : null,
    ].filter((metric): metric is MetricGridItem => metric != null);
};

interface WorkoutMetricsGridProps {
    values: WorkoutStatsDisplay;
}

export const WorkoutMetricsGrid: FC<WorkoutMetricsGridProps> = ({ values }) => {
    const { t } = useTranslation(['common', 'screens']);
    const { user } = useUser();

    const metrics = useMemo(
        () => buildWorkoutMetrics(values, t, user?.weightUnits),
        [values, t, user?.weightUnits],
    );

    if (metrics.length === 0) return null;

    return <MetricGrid metrics={metrics} />;
};
