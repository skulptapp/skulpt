import type { UserSelect } from '@/db/schema';
import {
    readHeartRateSamples,
    readActiveCalories,
    readDateOfBirth,
    readWorkoutSummaryMetrics,
} from './health';
import {
    computeHeartRateRecovery,
    computeWorkoutHealthStats,
    resolveMhrFromProfile,
} from '@/helpers/heart-rate-zones';
import { reportError } from '@/services/error-reporting';
import { type HealthStatsDisplay } from '@/types/health-stats';

type WorkoutStatsUserProfile = Pick<UserSelect, 'mhrFormula' | 'mhrManualValue' | 'birthday'>;

type WorkoutHealthStats = Partial<
    Pick<
        HealthStatsDisplay,
        | 'avgHeartRate'
        | 'minHeartRate'
        | 'maxHeartRate'
        | 'mhrUsed'
        | 'avgIntensity'
        | 'minIntensity'
        | 'maxIntensity'
        | 'activeCalories'
        | 'totalCalories'
        | 'heartRateRecovery'
        | 'heartRateRecoveryTwoMinutes'
        | 'activeScore'
        | 'avgMets'
        | 'distanceMeters'
        | 'paceSecondsPerKm'
        | 'cadence'
        | 'zone1Seconds'
        | 'zone2Seconds'
        | 'zone3Seconds'
        | 'zone4Seconds'
        | 'zone5Seconds'
        | 'zone1Minutes'
        | 'zone2Minutes'
        | 'zone3Minutes'
        | 'zone4Minutes'
        | 'zone5Minutes'
        | 'hrTimeSeries'
        | 'hrRecoverySeries'
    >
>;

export type WorkoutStatsComputationResult = {
    status: 'completed' | 'waiting_recovery';
    stats: WorkoutHealthStats;
    nextRunAt?: Date;
};

export async function computeWorkoutStats(
    startDate: Date,
    endDate: Date,
    user: WorkoutStatsUserProfile,
): Promise<WorkoutStatsComputationResult> {
    try {
        const summaryMetrics = await readWorkoutSummaryMetrics(startDate, endDate);
        const effectiveWorkoutStartDate = summaryMetrics.workoutStartDate ?? startDate;
        const effectiveWorkoutEndDate = summaryMetrics.workoutEndDate ?? endDate;
        const hrReadStartDate = new Date(effectiveWorkoutStartDate.getTime() - 30 * 1000);
        const hrReadEndDate = new Date(effectiveWorkoutEndDate.getTime() + 2 * 60 * 1000);
        const recoveryWindowStartDate = effectiveWorkoutEndDate;
        const hasRecoveryWindowElapsed = Date.now() >= hrReadEndDate.getTime();
        const workoutDurationSeconds = Math.max(
            0,
            Math.round(
                (effectiveWorkoutEndDate.getTime() - effectiveWorkoutStartDate.getTime()) / 1000,
            ),
        );

        const [hrSamples, activeCaloriesFallback] = await Promise.all([
            readHeartRateSamples(hrReadStartDate, hrReadEndDate),
            summaryMetrics.activeCalories == null
                ? readActiveCalories(effectiveWorkoutStartDate, effectiveWorkoutEndDate)
                : Promise.resolve<number | null>(summaryMetrics.activeCalories),
        ]);

        const workoutOnlyHeartRateSamples = hrSamples.filter(
            (sample) =>
                sample.timestamp >= effectiveWorkoutStartDate.getTime() &&
                sample.timestamp <= effectiveWorkoutEndDate.getTime(),
        );
        const recoveryHeartRateSamples = hrSamples.filter(
            (sample) =>
                sample.timestamp >= recoveryWindowStartDate.getTime() &&
                sample.timestamp <= hrReadEndDate.getTime(),
        );

        const stats: WorkoutHealthStats = {
            hrTimeSeries: JSON.stringify(workoutOnlyHeartRateSamples),
        };

        if (hasRecoveryWindowElapsed) {
            stats.hrRecoverySeries = JSON.stringify(recoveryHeartRateSamples);
        }

        if (summaryMetrics.avgMets != null) {
            stats.avgMets = Math.round(summaryMetrics.avgMets * 10) / 10;
        }

        if (summaryMetrics.distanceMeters != null) {
            stats.distanceMeters = Math.round(summaryMetrics.distanceMeters * 10) / 10;
        }

        if (
            summaryMetrics.distanceMeters != null &&
            summaryMetrics.distanceMeters > 0 &&
            workoutDurationSeconds > 0
        ) {
            stats.paceSecondsPerKm =
                Math.round((workoutDurationSeconds / (summaryMetrics.distanceMeters / 1000)) * 10) /
                10;
        }

        if (summaryMetrics.stepCount != null && workoutDurationSeconds > 0) {
            stats.cadence = Math.round(summaryMetrics.stepCount / (workoutDurationSeconds / 60));
        }

        const birthday = user.birthday ?? (await readDateOfBirth());
        const mhr = resolveMhrFromProfile({
            mhrFormula: user.mhrFormula,
            mhrManualValue: user.mhrManualValue,
            birthday,
        });

        if (mhr) {
            stats.mhrUsed = Math.floor(mhr);
        }

        if (mhr && hrSamples.length > 0) {
            const heartStats = computeWorkoutHealthStats(
                hrSamples,
                mhr,
                effectiveWorkoutStartDate,
                effectiveWorkoutEndDate,
            );

            if (heartStats) {
                stats.avgHeartRate = heartStats.avgHeartRate;
                stats.minHeartRate = heartStats.minHeartRate;
                stats.maxHeartRate = heartStats.maxHeartRate;
                stats.mhrUsed = heartStats.mhrUsed;
                stats.avgIntensity = heartStats.avgIntensity;
                stats.minIntensity = heartStats.minIntensity;
                stats.maxIntensity = heartStats.maxIntensity;
                stats.activeScore = heartStats.activeScore;
                stats.zone1Seconds = heartStats.zone1Seconds;
                stats.zone2Seconds = heartStats.zone2Seconds;
                stats.zone3Seconds = heartStats.zone3Seconds;
                stats.zone4Seconds = heartStats.zone4Seconds;
                stats.zone5Seconds = heartStats.zone5Seconds;
                stats.zone1Minutes = heartStats.zone1Minutes;
                stats.zone2Minutes = heartStats.zone2Minutes;
                stats.zone3Minutes = heartStats.zone3Minutes;
                stats.zone4Minutes = heartStats.zone4Minutes;
                stats.zone5Minutes = heartStats.zone5Minutes;

                if (hasRecoveryWindowElapsed) {
                    stats.heartRateRecovery =
                        computeHeartRateRecovery(
                            hrSamples,
                            effectiveWorkoutEndDate,
                            heartStats.mhrUsed,
                        ) ?? null;
                    stats.heartRateRecoveryTwoMinutes =
                        computeHeartRateRecovery(
                            hrSamples,
                            effectiveWorkoutEndDate,
                            heartStats.mhrUsed,
                            2,
                        ) ?? null;
                }
            }
        } else if (hasRecoveryWindowElapsed) {
            stats.heartRateRecovery = null;
            stats.heartRateRecoveryTwoMinutes = null;
        }

        const resolvedActiveCalories = summaryMetrics.activeCalories ?? activeCaloriesFallback;
        if (resolvedActiveCalories != null) {
            stats.activeCalories = resolvedActiveCalories;
        }

        if (summaryMetrics.totalCalories != null) {
            stats.totalCalories = summaryMetrics.totalCalories;
        }

        if (
            stats.activeCalories != null &&
            stats.totalCalories != null &&
            stats.totalCalories < stats.activeCalories
        ) {
            stats.totalCalories = stats.activeCalories;
        }

        if (!hasRecoveryWindowElapsed) {
            return {
                status: 'waiting_recovery',
                stats,
                nextRunAt: new Date(hrReadEndDate.getTime() + 1_000),
            };
        }

        return {
            status: 'completed',
            stats,
        };
    } catch (error) {
        reportError(error, 'computeWorkoutStats failed:');
        throw error;
    }
}
