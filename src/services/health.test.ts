import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const mockReportError = jest.fn();
const mockGetDateOfBirth = jest.fn<() => Date | null>();
const mockGetBiologicalSex = jest.fn<() => number | null>();
const mockQueryQuantitySamples = jest.fn<(...args: unknown[]) => Promise<unknown[]>>();
const mockQueryStatisticsForQuantity = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockQueryWorkoutSamples = jest.fn<(...args: unknown[]) => Promise<unknown[]>>();

jest.mock('react-native', () => ({
    Platform: {
        OS: 'ios',
    },
}));

jest.mock('@kingstinct/react-native-healthkit', () => ({
    requestAuthorization: jest.fn(),
    saveWorkoutSample: jest.fn(),
    queryQuantitySamples: (...args: unknown[]) => mockQueryQuantitySamples(...args),
    queryStatisticsForQuantity: (...args: unknown[]) => mockQueryStatisticsForQuantity(...args),
    queryWorkoutSamples: (...args: unknown[]) => mockQueryWorkoutSamples(...args),
    getBiologicalSex: () => mockGetBiologicalSex(),
    getDateOfBirth: () => mockGetDateOfBirth(),
    BiologicalSex: {
        female: 1,
        male: 2,
        other: 3,
    },
    WorkoutTypeIdentifier: 'HKWorkoutTypeIdentifier',
    WorkoutActivityType: {},
}));

jest.mock('react-native-health-connect', () => ({
    initialize: jest.fn(),
    requestPermission: jest.fn(),
    getGrantedPermissions: jest.fn(),
    insertRecords: jest.fn(),
    readRecords: jest.fn(),
    aggregateRecord: jest.fn(),
}));

jest.mock('@/services/error-reporting', () => ({
    reportError: (...args: unknown[]) => mockReportError(...args),
}));

const loadHealthModule = () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./health') as typeof import('./health');
};

describe('health benign access errors', () => {
    beforeEach(() => {
        mockReportError.mockReset();
        mockGetDateOfBirth.mockReset();
        mockGetBiologicalSex.mockReset();
        mockQueryQuantitySamples.mockReset();
        mockQueryStatisticsForQuantity.mockReset();
        mockQueryWorkoutSamples.mockReset();
    });

    test('does not report HealthKit data unavailable errors while reading profile fields', async () => {
        const healthUnavailableError = new Error(
            'Error Domain=com.apple.healthkit Code=1 "Health data is unavailable on this device" UserInfo={NSLocalizedDescription=Health data is unavailable on this device}',
        );

        mockGetDateOfBirth.mockImplementation(() => {
            throw healthUnavailableError;
        });
        mockGetBiologicalSex.mockImplementation(() => {
            throw healthUnavailableError;
        });

        const { readBiologicalSex, readDateOfBirth } = loadHealthModule();

        await expect(readDateOfBirth()).resolves.toBeNull();
        await expect(readBiologicalSex()).resolves.toBeNull();
        expect(mockReportError).not.toHaveBeenCalled();
    });

    test('treats HealthKit data unavailable as missing measurement permission', async () => {
        mockQueryQuantitySamples.mockRejectedValue(
            new Error(
                'Error Domain=com.apple.healthkit Code=1 "Health data is unavailable on this device" UserInfo={NSLocalizedDescription=Health data is unavailable on this device}',
            ),
        );

        const { readHealthMeasurementSamples } = loadHealthModule();

        await expect(readHealthMeasurementSamples()).resolves.toEqual({
            permissionGranted: false,
            samples: [],
        });
        expect(mockReportError).not.toHaveBeenCalled();
    });

    test('still reports unexpected HealthKit measurement errors', async () => {
        mockQueryQuantitySamples.mockRejectedValue(new Error('Unexpected HealthKit failure'));

        const { readHealthMeasurementSamples } = loadHealthModule();

        await expect(readHealthMeasurementSamples()).resolves.toEqual({
            permissionGranted: true,
            samples: [],
        });
        expect(mockReportError).toHaveBeenCalled();
    });

    test('reads summary metrics over the full app workout interval when HealthKit has split workouts', async () => {
        const startDate = new Date('2026-05-29T06:15:00.000Z');
        const endDate = new Date('2026-05-29T07:50:00.000Z');
        const firstSegmentStartDate = new Date('2026-05-29T06:15:00.000Z');
        const firstSegmentEndDate = new Date('2026-05-29T06:35:00.000Z');
        const secondSegmentStartDate = new Date('2026-05-29T06:40:00.000Z');
        const secondSegmentEndDate = new Date('2026-05-29T07:50:00.000Z');

        mockQueryWorkoutSamples.mockResolvedValue([
            {
                startDate: firstSegmentStartDate,
                endDate: firstSegmentEndDate,
                totalEnergyBurned: { quantity: 100 },
                totalDistance: { unit: 'm', quantity: 900 },
                metadata: { HKAverageMETs: { quantity: 4 } },
            },
            {
                startDate: secondSegmentStartDate,
                endDate: secondSegmentEndDate,
                totalEnergyBurned: { quantity: 220 },
                totalDistance: { unit: 'm', quantity: 2100 },
                metadata: { HKAverageMETs: { quantity: 8 } },
            },
        ]);
        mockQueryStatisticsForQuantity.mockImplementation(async (identifier) => {
            if (identifier === 'HKQuantityTypeIdentifierDistanceWalkingRunning') {
                return { sumQuantity: { quantity: 3300 } };
            }
            if (identifier === 'HKQuantityTypeIdentifierStepCount') {
                return { sumQuantity: { quantity: 5000 } };
            }
            if (identifier === 'HKQuantityTypeIdentifierActiveEnergyBurned') {
                return { sumQuantity: { quantity: 360 } };
            }
            if (identifier === 'HKQuantityTypeIdentifierBasalEnergyBurned') {
                return { sumQuantity: { quantity: 80 } };
            }

            return { sumQuantity: null };
        });

        const { readWorkoutSummaryMetrics } = loadHealthModule();
        const result = await readWorkoutSummaryMetrics(startDate, endDate);

        expect(result).toMatchObject({
            activeCalories: 360,
            totalCalories: 440,
            distanceMeters: 3300,
            stepCount: 5000,
            workoutStartDate: firstSegmentStartDate,
            workoutEndDate: secondSegmentEndDate,
        });
        expect(result.avgMets).toBeCloseTo((4 * 20 + 8 * 70) / 90, 3);
        expect(mockQueryStatisticsForQuantity).toHaveBeenCalledWith(
            'HKQuantityTypeIdentifierDistanceWalkingRunning',
            ['cumulativeSum'],
            {
                filter: { date: { startDate, endDate } },
                unit: 'm',
            },
        );
        expect(mockQueryStatisticsForQuantity).toHaveBeenCalledWith(
            'HKQuantityTypeIdentifierStepCount',
            ['cumulativeSum'],
            {
                filter: { date: { startDate, endDate } },
                unit: 'count',
            },
        );
        expect(mockQueryStatisticsForQuantity).toHaveBeenCalledWith(
            'HKQuantityTypeIdentifierActiveEnergyBurned',
            ['cumulativeSum'],
            {
                filter: { date: { startDate, endDate } },
                unit: 'kcal',
            },
        );
        expect(mockQueryStatisticsForQuantity).toHaveBeenCalledWith(
            'HKQuantityTypeIdentifierBasalEnergyBurned',
            ['cumulativeSum'],
            {
                filter: { date: { startDate, endDate } },
                unit: 'kcal',
            },
        );
    });
});
