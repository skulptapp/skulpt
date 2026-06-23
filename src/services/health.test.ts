import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const mockReportError = jest.fn();
const mockGetDateOfBirth = jest.fn<() => Date | null>();
const mockGetBiologicalSex = jest.fn<() => number | null>();
const mockQueryQuantitySamples = jest.fn<(...args: unknown[]) => Promise<unknown[]>>();

jest.mock('react-native', () => ({
    Platform: {
        OS: 'ios',
    },
}));

jest.mock('@kingstinct/react-native-healthkit', () => ({
    requestAuthorization: jest.fn(),
    saveWorkoutSample: jest.fn(),
    queryQuantitySamples: (...args: unknown[]) => mockQueryQuantitySamples(...args),
    queryStatisticsForQuantity: jest.fn(),
    queryWorkoutSamples: jest.fn(),
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
});
