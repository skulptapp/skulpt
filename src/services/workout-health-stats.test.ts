import { beforeEach, describe, expect, jest, test } from '@jest/globals';

type HeartRateSample = { timestamp: number; bpm: number };
type WorkoutSummaryMetricsMock = {
    avgMets: number | null;
    activeCalories: number | null;
    totalCalories: number | null;
    distanceMeters: number | null;
    stepCount: number | null;
    workoutStartDate: Date | null;
    workoutEndDate: Date | null;
};
type HeartRateRecoveryWindowMock = {
    oneMinuteRecovery: number | null;
    twoMinuteRecovery: number;
    series: HeartRateSample[];
    startTimestamp: number;
    endTimestamp: number;
};
type WorkoutHealthStatsMock = {
    mhrUsed: number;
    avgHeartRate: number;
    minHeartRate: number;
    maxHeartRate: number;
    avgIntensity: number;
    minIntensity: number;
    maxIntensity: number;
    activeScore: number;
    totalTrackedSeconds: number;
    zone1Seconds: number;
    zone2Seconds: number;
    zone3Seconds: number;
    zone4Seconds: number;
    zone5Seconds: number;
    zone1Minutes: number;
    zone2Minutes: number;
    zone3Minutes: number;
    zone4Minutes: number;
    zone5Minutes: number;
};

const mockReadHeartRateSamples =
    jest.fn<(startDate: Date, endDate: Date) => Promise<HeartRateSample[]>>();
const mockReadActiveCalories =
    jest.fn<(startDate: Date, endDate: Date) => Promise<number | null>>();
const mockReadDateOfBirth = jest.fn<() => Promise<Date | null>>();
const mockReadWorkoutSummaryMetrics =
    jest.fn<(startDate: Date, endDate: Date) => Promise<WorkoutSummaryMetricsMock>>();
const mockComputeHeartRateRecoveryWindow =
    jest.fn<
        (
            samples: HeartRateSample[],
            startDate: Date,
            endDate: Date,
        ) => HeartRateRecoveryWindowMock | null
    >();
const mockComputeWorkoutHealthStats =
    jest.fn<
        (
            samples: HeartRateSample[],
            mhr: number,
            startDate: Date,
            endDate: Date,
        ) => WorkoutHealthStatsMock | null
    >();
const mockResolveMhrFromProfile = jest.fn<(...args: unknown[]) => number | null>();
const mockReportError = jest.fn();

jest.mock('./health', () => ({
    readHeartRateSamples: (...args: Parameters<typeof mockReadHeartRateSamples>) =>
        mockReadHeartRateSamples(...args),
    readActiveCalories: (...args: Parameters<typeof mockReadActiveCalories>) =>
        mockReadActiveCalories(...args),
    readDateOfBirth: () => mockReadDateOfBirth(),
    readWorkoutSummaryMetrics: (...args: Parameters<typeof mockReadWorkoutSummaryMetrics>) =>
        mockReadWorkoutSummaryMetrics(...args),
}));

jest.mock('@/helpers/heart-rate-zones', () => ({
    computeHeartRateRecoveryWindow: (
        ...args: Parameters<typeof mockComputeHeartRateRecoveryWindow>
    ) => mockComputeHeartRateRecoveryWindow(...args),
    computeWorkoutHealthStats: (...args: Parameters<typeof mockComputeWorkoutHealthStats>) =>
        mockComputeWorkoutHealthStats(...args),
    resolveMhrFromProfile: (...args: unknown[]) => mockResolveMhrFromProfile(...args),
}));

jest.mock('@/services/error-reporting', () => ({
    reportError: (...args: unknown[]) => mockReportError(...args),
}));

const loadWorkoutHealthStatsModule = () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./workout-health-stats') as typeof import('./workout-health-stats');
};

describe('computeWorkoutStats', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('uses app workout boundaries for heart-rate charts when HealthKit returns a split workout segment', async () => {
        const startDate = new Date('2026-05-29T06:15:00.000Z');
        const endDate = new Date('2026-05-29T07:50:00.000Z');
        const healthSegmentStartDate = new Date('2026-05-29T06:38:00.000Z');
        const healthSegmentEndDate = new Date('2026-05-29T06:40:00.000Z');
        const preWorkoutSample = { timestamp: startDate.getTime() - 10_000, bpm: 90 };
        const firstWorkoutSample = { timestamp: startDate.getTime() + 10_000, bpm: 110 };
        const lastWorkoutSample = { timestamp: endDate.getTime() - 10_000, bpm: 140 };
        const hrSamples = [preWorkoutSample, firstWorkoutSample, lastWorkoutSample];

        mockReadWorkoutSummaryMetrics.mockResolvedValue({
            avgMets: null,
            activeCalories: null,
            totalCalories: null,
            distanceMeters: null,
            stepCount: null,
            workoutStartDate: healthSegmentStartDate,
            workoutEndDate: healthSegmentEndDate,
        });
        mockReadHeartRateSamples.mockResolvedValue(hrSamples);
        mockReadActiveCalories.mockResolvedValue(123);
        mockResolveMhrFromProfile.mockReturnValue(190);
        mockComputeHeartRateRecoveryWindow.mockReturnValue({
            oneMinuteRecovery: 12,
            twoMinuteRecovery: 24,
            series: [firstWorkoutSample, lastWorkoutSample],
            startTimestamp: firstWorkoutSample.timestamp,
            endTimestamp: lastWorkoutSample.timestamp,
        });
        mockComputeWorkoutHealthStats.mockReturnValue({
            mhrUsed: 190,
            avgHeartRate: 125,
            minHeartRate: 110,
            maxHeartRate: 140,
            avgIntensity: 66,
            minIntensity: 58,
            maxIntensity: 74,
            activeScore: 10,
            totalTrackedSeconds: 100,
            zone1Seconds: 10,
            zone2Seconds: 20,
            zone3Seconds: 30,
            zone4Seconds: 40,
            zone5Seconds: 0,
            zone1Minutes: 0.2,
            zone2Minutes: 0.3,
            zone3Minutes: 0.5,
            zone4Minutes: 0.7,
            zone5Minutes: 0,
        });

        const { computeWorkoutStats } = loadWorkoutHealthStatsModule();
        const result = await computeWorkoutStats(startDate, endDate, {
            mhrFormula: null,
            mhrManualValue: null,
            birthday: new Date('1990-01-01T00:00:00.000Z'),
        });

        expect(mockReadHeartRateSamples).toHaveBeenCalledWith(
            new Date(startDate.getTime() - 30_000),
            endDate,
        );
        expect(mockReadActiveCalories).toHaveBeenCalledWith(startDate, endDate);
        expect(mockComputeHeartRateRecoveryWindow).toHaveBeenCalledWith(
            [firstWorkoutSample, lastWorkoutSample],
            startDate,
            endDate,
        );
        expect(mockComputeWorkoutHealthStats).toHaveBeenCalledWith(
            hrSamples,
            190,
            startDate,
            endDate,
        );
        expect(JSON.parse(result.stats.hrTimeSeries ?? '[]')).toEqual([
            firstWorkoutSample,
            lastWorkoutSample,
        ]);
    });
});
