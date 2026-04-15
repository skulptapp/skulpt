import { type MetricGridItem } from '@/components/layout/metric-grid';
import { type WorkoutStatsDisplay } from '@/components/layout/workout-metrics';
import { type ExerciseSelect, type ExerciseSetSelect, type WorkoutSelect } from '@/db/schema';
import { convertDistance, convertWeight, formatDistance } from '@/helpers/units';
import { type HealthStatsDisplay } from '@/types/health-stats';

type Translate = (key: string, options?: Record<string, unknown>) => string;

type HealthStatsSnapshot = Partial<HealthStatsDisplay>;

interface BuildOverviewMetricsParams {
    snapshot: HealthStatsSnapshot;
    shouldShowLocomotionMetrics: boolean;
    distanceUnits: 'km' | 'mi';
    t: Translate;
}

interface BuildHeartRateMetricsParams {
    snapshot: HealthStatsSnapshot;
    t: Translate;
}

interface BuildRecoveryStatsParams {
    snapshot: HealthStatsSnapshot;
    t: Translate;
}

export interface WorkoutMetricsExerciseContext {
    exercise: Pick<ExerciseSelect, 'weightDoubleInStats'>;
    sets?: readonly Pick<
        ExerciseSetSelect,
        | 'type'
        | 'weight'
        | 'weightUnits'
        | 'reps'
        | 'time'
        | 'restTime'
        | 'finalRestTime'
        | 'startedAt'
        | 'completedAt'
        | 'restCompletedAt'
    >[];
}

interface BuildWorkoutMetricsValuesParams {
    workout: Pick<WorkoutSelect, 'status' | 'duration' | 'startedAt' | 'completedAt'>;
    exercises: readonly WorkoutMetricsExerciseContext[];
    userWeightUnits: 'kg' | 'lb' | null | undefined;
}

export const formatCompactDuration = (totalSeconds: number): string => {
    const safeSeconds = Math.max(0, Math.round(totalSeconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }

    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }

    return `${seconds}s`;
};

export const formatRecoveryDelta = (value: number | null | undefined): string | null => {
    if (value == null) return null;
    return value > 0 ? `-${value} bpm` : `${value} bpm`;
};

const formatPace = (secondsPerKm: number, distanceUnits: 'km' | 'mi', t: Translate): string => {
    const secondsPerUnit =
        distanceUnits === 'mi' ? secondsPerKm * convertDistance(1, 'mi', 'km') : secondsPerKm;
    const safeSeconds = Math.max(0, Math.round(secondsPerUnit));
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    const distanceUnitLabel = t(`distanceUnit.${distanceUnits}`, { ns: 'common' });

    return `${minutes}:${String(seconds).padStart(2, '0')} /${distanceUnitLabel}`;
};

export const buildOverviewMetrics = ({
    snapshot,
    shouldShowLocomotionMetrics,
    distanceUnits,
    t,
}: BuildOverviewMetricsParams): MetricGridItem[] => {
    return [
        snapshot.activeCalories != null
            ? {
                  key: 'activeCalories',
                  value: `${Math.round(snapshot.activeCalories)} kcal`,
                  label: t('workout.stats.activeCalories', { ns: 'screens' }),
              }
            : null,
        snapshot.totalCalories != null
            ? {
                  key: 'totalCalories',
                  value: `${Math.round(snapshot.totalCalories)} kcal`,
                  label: t('workout.stats.totalCalories', { ns: 'screens' }),
              }
            : null,
        snapshot.avgIntensity != null
            ? {
                  key: 'avgIntensity',
                  value: `${snapshot.avgIntensity}%`,
                  label: t('workout.stats.avgIntensity', { ns: 'screens' }),
              }
            : null,
        snapshot.minIntensity != null && snapshot.maxIntensity != null
            ? {
                  key: 'intensityRange',
                  value: `${snapshot.minIntensity}-${snapshot.maxIntensity}%`,
                  label: t('workout.stats.intensityRange', { ns: 'screens' }),
              }
            : null,
        shouldShowLocomotionMetrics && snapshot.distanceMeters != null
            ? {
                  key: 'distance',
                  value: formatDistance(snapshot.distanceMeters / 1000, distanceUnits),
                  label: t('workout.stats.distance', { ns: 'screens' }),
              }
            : null,
        shouldShowLocomotionMetrics && snapshot.paceSecondsPerKm != null
            ? {
                  key: 'pace',
                  value: formatPace(snapshot.paceSecondsPerKm, distanceUnits, t),
                  label: t('workout.stats.pace', { ns: 'screens' }),
              }
            : null,
        shouldShowLocomotionMetrics && snapshot.cadence != null
            ? {
                  key: 'cadence',
                  value: `${snapshot.cadence} spm`,
                  label: t('workout.stats.cadence', { ns: 'screens' }),
              }
            : null,
        snapshot.avgMets != null
            ? {
                  key: 'avgMets',
                  value: `${snapshot.avgMets}`,
                  label: t('workout.stats.avgMets', { ns: 'screens' }),
              }
            : null,
        snapshot.activeScore != null
            ? {
                  key: 'activeScore',
                  value: `${snapshot.activeScore}`,
                  label: t('workout.stats.activeScore', { ns: 'screens' }),
              }
            : null,
        snapshot.mhrUsed != null
            ? {
                  key: 'mhrUsed',
                  value: `${snapshot.mhrUsed} bpm`,
                  label: t('workout.stats.mhrUsed', { ns: 'screens' }),
              }
            : null,
    ].filter((metric): metric is MetricGridItem => metric != null);
};

export const buildHeartRateMetrics = ({
    snapshot,
    t,
}: BuildHeartRateMetricsParams): MetricGridItem[] => {
    return [
        snapshot.avgHeartRate != null
            ? {
                  key: 'avgHeartRate',
                  value: `${snapshot.avgHeartRate} bpm`,
                  label: t('workout.stats.avgHeartRate', { ns: 'screens' }),
              }
            : null,
        snapshot.minHeartRate != null && snapshot.maxHeartRate != null
            ? {
                  key: 'heartRateRange',
                  value: `${snapshot.minHeartRate}-${snapshot.maxHeartRate} bpm`,
                  label: t('workout.stats.heartRateRange', { ns: 'screens' }),
              }
            : null,
    ].filter((metric): metric is MetricGridItem => metric != null);
};

export const buildRecoveryMetrics = ({
    snapshot,
    t,
}: BuildRecoveryStatsParams): MetricGridItem[] => {
    const metrics: MetricGridItem[] = [];

    const oneMinuteRecovery = formatRecoveryDelta(snapshot.heartRateRecovery);
    if (oneMinuteRecovery != null) {
        metrics.push({
            key: 'heart-rate-recovery',
            value: oneMinuteRecovery,
            label: t('workout.stats.afterOneMinute', {
                ns: 'screens',
            }),
        });
    }

    const twoMinuteRecovery = formatRecoveryDelta(snapshot.heartRateRecoveryTwoMinutes);
    if (twoMinuteRecovery != null) {
        metrics.push({
            key: 'heart-rate-recovery-two-minutes',
            value: twoMinuteRecovery,
            label: t('workout.stats.afterTwoMinutes', {
                ns: 'screens',
            }),
        });
    }

    return metrics;
};

const FORECAST_SET_DURATION_SECONDS = 30;

export const buildWorkoutMetricsValues = ({
    workout,
    exercises,
    userWeightUnits,
}: BuildWorkoutMetricsValuesParams): WorkoutStatsDisplay | null => {
    if (exercises.length === 0) return null;

    const { status } = workout;

    let setsCount = 0;
    let repsCount = 0;
    let totalSetTimeSeconds = 0;
    let totalRestTimeSeconds = 0;
    let totalVolumeKg = 0;

    for (const item of exercises) {
        for (const set of item.sets ?? []) {
            const isCompleted = !!set.completedAt;

            if (status === 'completed' && !isCompleted) continue;

            setsCount += 1;
            repsCount += set.reps ?? 0;

            if (isCompleted) {
                if (
                    set.startedAt &&
                    set.completedAt &&
                    set.completedAt.getTime() >= set.startedAt.getTime()
                ) {
                    totalSetTimeSeconds += Math.floor(
                        (set.completedAt.getTime() - set.startedAt.getTime()) / 1000,
                    );
                } else if ((set.time ?? 0) > 0) {
                    totalSetTimeSeconds += set.time ?? 0;
                }

                if ((set.restTime ?? 0) > 0) {
                    if (set.finalRestTime != null) {
                        totalRestTimeSeconds += Math.max(0, set.finalRestTime);
                    } else if (
                        set.restCompletedAt &&
                        set.completedAt &&
                        set.restCompletedAt.getTime() >= set.completedAt.getTime()
                    ) {
                        totalRestTimeSeconds += Math.max(
                            0,
                            Math.min(
                                set.restTime ?? 0,
                                Math.floor(
                                    (set.restCompletedAt.getTime() - set.completedAt.getTime()) /
                                        1000,
                                ),
                            ),
                        );
                    }
                }
            } else {
                // Forecast: use set's configured time if available, otherwise 30 seconds
                totalSetTimeSeconds +=
                    (set.time ?? 0) > 0 ? set.time! : FORECAST_SET_DURATION_SECONDS;
                // Rest: use configured rest time if available, otherwise 0
                totalRestTimeSeconds += set.restTime ?? 0;
            }

            if (
                set.type !== 'warmup' &&
                set.weight != null &&
                set.reps != null &&
                set.weight !== 0 &&
                set.reps !== 0
            ) {
                const weightInKg =
                    set.weightUnits === 'lb' ? convertWeight(set.weight, 'lb', 'kg') : set.weight;
                const multiplier = item.exercise.weightDoubleInStats ? 2 : 1;
                totalVolumeKg += weightInKg * multiplier * set.reps;
            }
        }
    }

    const workoutDurationSeconds = (() => {
        if (status === 'completed') {
            if (workout.duration != null) {
                return Math.max(0, Math.round(workout.duration));
            }

            if (workout.startedAt && workout.completedAt) {
                const durationMs = workout.completedAt.getTime() - workout.startedAt.getTime();
                return Math.max(0, Math.round(durationMs / 1000));
            }

            return 0;
        }

        // For planned/in_progress: estimate from set + rest totals
        return totalSetTimeSeconds + totalRestTimeSeconds;
    })();

    const totalVolume =
        userWeightUnits === 'lb' ? convertWeight(totalVolumeKg, 'kg', 'lb') : totalVolumeKg;

    return {
        workoutDurationSeconds,
        totalSetTimeSeconds,
        totalRestTimeSeconds,
        volume: Math.round(totalVolume * 10) / 10,
        exercisesCount: exercises.length,
        setsCount,
        repsCount,
    };
};
