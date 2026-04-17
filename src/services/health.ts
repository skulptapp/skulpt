import { Platform } from 'react-native';
import {
    requestAuthorization,
    saveWorkoutSample,
    queryQuantitySamples,
    queryStatisticsForQuantity,
    queryWorkoutSamples,
    getBiologicalSex,
    getDateOfBirth,
    BiologicalSex,
    WorkoutTypeIdentifier,
    WorkoutActivityType,
} from '@kingstinct/react-native-healthkit';
import {
    initialize,
    requestPermission,
    getGrantedPermissions,
    insertRecords,
    readRecords,
    aggregateRecord,
} from 'react-native-health-connect';
import { MeasurementSourcePlatform } from '@/constants/measurement';
import { reportError } from './error-reporting';

export interface WorkoutSummaryMetrics {
    avgMets: number | null;
    activeCalories: number | null;
    totalCalories: number | null;
    distanceMeters: number | null;
    stepCount: number | null;
    workoutStartDate: Date | null;
    workoutEndDate: Date | null;
}

export interface HealthMeasurementSample {
    metric: string;
    value: number;
    unit: string;
    recordedAt: Date;
    externalId: string;
    sourcePlatform: MeasurementSourcePlatform;
}

export interface ReadHealthMeasurementSamplesResult {
    permissionGranted: boolean;
    samples: HealthMeasurementSample[];
}

const logHealthError = (scope: string, error: unknown) => {
    if (isBenignHealthAccessError(error)) {
        return;
    }

    reportError(error, `[health] ${scope} failed:`, {
        tags: {
            scope: 'health',
        },
    });
};

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message.toLowerCase();
    }

    if (typeof error === 'string') {
        return error.toLowerCase();
    }

    if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as { message?: unknown }).message;
        if (typeof message === 'string') {
            return message.toLowerCase();
        }
    }

    return '';
};

const isHealthAuthorizationNotDeterminedError = (error: unknown) => {
    if (!(error instanceof Error)) {
        return false;
    }

    const message = error.message.toLowerCase();

    return (
        message.includes('authorization is not determined') ||
        message.includes('authorization not determined')
    );
};

const isHealthProtectedDataInaccessibleError = (error: unknown) => {
    if (!(error instanceof Error)) {
        return false;
    }

    return error.message.toLowerCase().includes('protected health data is inaccessible');
};

const isHealthNotAuthorizedError = (error: unknown) => {
    const message = getErrorMessage(error);

    return message.includes('not authorized') || message.includes('code=4');
};

const isHealthServiceUnavailableError = (error: unknown) => {
    const message = getErrorMessage(error);

    return (
        message.includes('service not available') ||
        message.includes('health connect is unavailable') ||
        message.includes('health connect is not available')
    );
};

// iOS Guided Access locks the device to a single app. When HealthKit tries to
// open com.apple.HealthPrivacyService for the permissions dialog it gets denied
// with FBSOpenApplicationErrorDomain "Guided Access active". This is a device
// configuration issue, not a code bug — suppress it from Sentry.
const isGuidedAccessHealthError = (error: unknown) => {
    const message = getErrorMessage(error);

    return message.includes('guided access active') || message.includes('healthprivacyservice');
};

const isBenignHealthAccessError = (error: unknown) =>
    isHealthAuthorizationNotDeterminedError(error) ||
    isHealthProtectedDataInaccessibleError(error) ||
    isHealthNotAuthorizedError(error) ||
    isHealthServiceUnavailableError(error) ||
    isGuidedAccessHealthError(error);

const IOS_HEALTH_READ_TYPES = [
    WorkoutTypeIdentifier,
    'HKCharacteristicTypeIdentifierDateOfBirth',
    'HKCharacteristicTypeIdentifierBiologicalSex',
    'HKQuantityTypeIdentifierHeartRate',
    'HKQuantityTypeIdentifierActiveEnergyBurned',
    'HKQuantityTypeIdentifierBasalEnergyBurned',
    'HKQuantityTypeIdentifierStepCount',
    'HKQuantityTypeIdentifierDistanceWalkingRunning',
    'HKQuantityTypeIdentifierBodyMass',
    'HKQuantityTypeIdentifierBodyFatPercentage',
    'HKQuantityTypeIdentifierLeanBodyMass',
    'HKQuantityTypeIdentifierBodyMassIndex',
    'HKQuantityTypeIdentifierWaistCircumference',
] as const;

const ANDROID_HEALTH_PERMISSIONS = [
    { accessType: 'write', recordType: 'ExerciseSession' as const },
    { accessType: 'read', recordType: 'HeartRate' as const },
    { accessType: 'read', recordType: 'ActiveCaloriesBurned' as const },
    { accessType: 'read', recordType: 'BasalMetabolicRate' as const },
    { accessType: 'read', recordType: 'Steps' as const },
    { accessType: 'read', recordType: 'Distance' as const },
    { accessType: 'read', recordType: 'Weight' as const },
    { accessType: 'read', recordType: 'BodyFat' as const },
    { accessType: 'read', recordType: 'LeanBodyMass' as const },
    { accessType: 'read', recordType: 'BoneMass' as const },
    { accessType: 'read', recordType: 'BodyWaterMass' as const },
] as const;

const ANDROID_ESSENTIAL_PERMISSION_KEYS = new Set([
    'write:ExerciseSession',
    'read:HeartRate',
    'read:Weight',
] as const);

let healthConnectInitPromise: Promise<boolean> | null = null;

const HEALTH_IMPORT_OVERLAP_MS = 24 * 60 * 60 * 1000;

const getPermissionKey = (permission: { accessType: string; recordType: string }) =>
    `${permission.accessType}:${permission.recordType}`;

const ensureHealthConnectReady = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return false;

    if (!healthConnectInitPromise) {
        healthConnectInitPromise = initialize().catch((error) => {
            healthConnectInitPromise = null;
            throw error;
        });
    }

    return await healthConnectInitPromise;
};

const requireHealthConnectReady = async (scope: string): Promise<boolean> => {
    const isReady = await ensureHealthConnectReady();
    return isReady;
};

const quantityToMeters = (
    value?: {
        unit: string;
        quantity: number;
    } | null,
): number | null => {
    if (!value) return null;

    switch (value.unit) {
        case 'm':
            return value.quantity;
        case 'km':
            return value.quantity * 1000;
        case 'mi':
            return value.quantity * 1609.344;
        default:
            return null;
    }
};

const normalizeBodyFatPercentage = (value: number): number => {
    if (!Number.isFinite(value)) return value;
    if (value >= 0 && value <= 1) {
        return value * 100;
    }
    return value;
};

const resolveImportStartDate = (
    sinceByMetric: Record<string, Date> | undefined,
    metric: string,
): Date | null => {
    if (!sinceByMetric) return null;
    const since = sinceByMetric[metric];
    if (!(since instanceof Date) || !Number.isFinite(since.getTime())) return null;

    return new Date(Math.max(0, since.getTime() - HEALTH_IMPORT_OVERLAP_MS));
};

export async function requestHealthPermissions(): Promise<boolean> {
    try {
        if (Platform.OS === 'ios') {
            return await requestAuthorization({
                toShare: [WorkoutTypeIdentifier],
                toRead: [...IOS_HEALTH_READ_TYPES],
            });
        }

        if (Platform.OS === 'android') {
            if (!(await requireHealthConnectReady('requestHealthPermissions'))) {
                return false;
            }
            await requestPermission([...ANDROID_HEALTH_PERMISSIONS]);
            const granted = await getGrantedPermissions();
            const grantedKeys = new Set(granted.map(getPermissionKey));

            return [...ANDROID_ESSENTIAL_PERMISSION_KEYS].every((key) => grantedKeys.has(key));
        }
    } catch (error) {
        logHealthError('requestHealthPermissions', error);
    }

    return false;
}

export async function readHealthMeasurementSamples(
    options: {
        sinceByMetric?: Record<string, Date>;
    } = {},
): Promise<ReadHealthMeasurementSamplesResult> {
    if (Platform.OS === 'ios') {
        const configs: {
            identifier:
                | 'HKQuantityTypeIdentifierBodyMass'
                | 'HKQuantityTypeIdentifierBodyFatPercentage'
                | 'HKQuantityTypeIdentifierLeanBodyMass'
                | 'HKQuantityTypeIdentifierBodyMassIndex'
                | 'HKQuantityTypeIdentifierWaistCircumference';
            metric: string;
            unit: string;
            queryUnit?: 'count' | '%' | 'kg' | 'cm';
            resolveValue: (value: number) => number;
        }[] = [
            {
                identifier: 'HKQuantityTypeIdentifierBodyMass',
                metric: 'body_weight',
                unit: 'kg',
                queryUnit: 'kg',
                resolveValue: (value) => value,
            },
            {
                identifier: 'HKQuantityTypeIdentifierBodyFatPercentage',
                metric: 'body_fat_percentage',
                unit: 'percent',
                queryUnit: '%',
                resolveValue: (value) => normalizeBodyFatPercentage(value),
            },
            {
                identifier: 'HKQuantityTypeIdentifierLeanBodyMass',
                metric: 'lean_body_mass',
                unit: 'kg',
                queryUnit: 'kg',
                resolveValue: (value) => value,
            },
            {
                identifier: 'HKQuantityTypeIdentifierBodyMassIndex',
                metric: 'body_mass_index',
                unit: 'bmi',
                queryUnit: 'count',
                resolveValue: (value) => value,
            },
            {
                identifier: 'HKQuantityTypeIdentifierWaistCircumference',
                metric: 'waist_circumference',
                unit: 'cm',
                queryUnit: 'cm',
                resolveValue: (value) => value,
            },
        ];

        const samples: HealthMeasurementSample[] = [];
        let permissionDenied = false;

        for (const config of configs) {
            const startDate = resolveImportStartDate(options.sinceByMetric, config.metric);
            const queryOptions = {
                limit: 0,
                ascending: true,
                unit: config.queryUnit,
                filter: startDate
                    ? {
                          date: {
                              startDate,
                              endDate: new Date(),
                          },
                      }
                    : undefined,
            };

            try {
                const quantitySamples = await queryQuantitySamples(config.identifier, queryOptions);

                for (const quantitySample of quantitySamples) {
                    const value = config.resolveValue(quantitySample.quantity);
                    if (!Number.isFinite(value)) continue;

                    const recordedAt = quantitySample.endDate ?? quantitySample.startDate;
                    if (!(recordedAt instanceof Date) || !Number.isFinite(recordedAt.getTime())) {
                        continue;
                    }

                    const externalId = `${config.identifier}:${quantitySample.uuid}`;
                    samples.push({
                        metric: config.metric,
                        value,
                        unit: config.unit,
                        recordedAt,
                        externalId,
                        sourcePlatform: 'ios_healthkit',
                    });
                }
            } catch (error) {
                if (isBenignHealthAccessError(error)) {
                    permissionDenied = true;
                    continue;
                }
                logHealthError(`readHealthMeasurementSamples/${config.identifier}`, error);
            }
        }

        return {
            permissionGranted: !permissionDenied,
            samples,
        };
    }

    if (Platform.OS === 'android') {
        if (!(await requireHealthConnectReady('readHealthMeasurementSamples'))) {
            return {
                permissionGranted: false,
                samples: [],
            };
        }

        const configs: {
            recordType: 'Weight' | 'BodyFat' | 'LeanBodyMass' | 'BoneMass' | 'BodyWaterMass';
            metric: string;
            unit: string;
            resolveValue: (record: any) => number | null;
        }[] = [
            {
                recordType: 'Weight',
                metric: 'body_weight',
                unit: 'kg',
                resolveValue: (record) => record?.weight?.inKilograms ?? null,
            },
            {
                recordType: 'BodyFat',
                metric: 'body_fat_percentage',
                unit: 'percent',
                resolveValue: (record) => {
                    const percentage = record?.percentage;
                    if (typeof percentage !== 'number' || !Number.isFinite(percentage)) {
                        return null;
                    }
                    return normalizeBodyFatPercentage(percentage);
                },
            },
            {
                recordType: 'LeanBodyMass',
                metric: 'lean_body_mass',
                unit: 'kg',
                resolveValue: (record) => record?.mass?.inKilograms ?? null,
            },
            {
                recordType: 'BoneMass',
                metric: 'bone_mass',
                unit: 'kg',
                resolveValue: (record) => record?.mass?.inKilograms ?? null,
            },
            {
                recordType: 'BodyWaterMass',
                metric: 'body_water_mass',
                unit: 'kg',
                resolveValue: (record) => record?.mass?.inKilograms ?? null,
            },
        ];

        const samples: HealthMeasurementSample[] = [];
        let permissionDenied = false;

        for (const config of configs) {
            const startDate = resolveImportStartDate(options.sinceByMetric, config.metric);
            const startTime = (startDate ?? new Date(0)).toISOString();
            let pageToken: string | undefined;
            let pageIndex = 0;

            do {
                try {
                    const result = await readRecords(config.recordType, {
                        timeRangeFilter: {
                            operator: 'after',
                            startTime,
                        },
                        ascendingOrder: true,
                        pageSize: 250,
                        pageToken,
                    });

                    for (const row of result.records as any[]) {
                        const value = config.resolveValue(row);
                        if (typeof value !== 'number' || !Number.isFinite(value)) continue;

                        const timeRaw = row?.time;
                        const recordedAt = new Date(timeRaw);
                        if (!Number.isFinite(recordedAt.getTime())) continue;

                        const externalId =
                            row?.metadata?.id ??
                            row?.metadata?.clientRecordId ??
                            `${config.recordType}:${timeRaw}:${pageIndex}`;

                        samples.push({
                            metric: config.metric,
                            value,
                            unit: config.unit,
                            recordedAt,
                            externalId: String(externalId),
                            sourcePlatform: 'android_health_connect',
                        });
                    }

                    pageToken = result.pageToken;
                    pageIndex += 1;

                    if (pageToken) {
                        await new Promise((resolve) => setTimeout(resolve, 0));
                    }
                } catch (error) {
                    if (isBenignHealthAccessError(error)) {
                        permissionDenied = true;
                    } else {
                        logHealthError(`readHealthMeasurementSamples/${config.recordType}`, error);
                    }
                    pageToken = undefined;
                }
            } while (pageToken);
        }

        return {
            permissionGranted: !permissionDenied,
            samples,
        };
    }

    return {
        permissionGranted: false,
        samples: [],
    };
}

export async function saveWorkoutToHealth(params: {
    name: string;
    startDate: Date;
    endDate: Date;
}): Promise<void> {
    const { name, startDate, endDate } = params;

    try {
        if (Platform.OS === 'ios') {
            await saveWorkoutSample(
                WorkoutActivityType.traditionalStrengthTraining,
                [],
                startDate,
                endDate,
            );
            return;
        }

        if (Platform.OS === 'android') {
            if (!(await requireHealthConnectReady('saveWorkoutToHealth'))) {
                return;
            }
            await insertRecords([
                {
                    recordType: 'ExerciseSession',
                    exerciseType: 44,
                    title: name,
                    startTime: startDate.toISOString(),
                    endTime: endDate.toISOString(),
                },
            ]);
        }
    } catch (error) {
        logHealthError('saveWorkoutToHealth', error);
    }
}

export async function readHeartRateSamples(
    startDate: Date,
    endDate: Date,
): Promise<{ timestamp: number; bpm: number }[]> {
    try {
        if (Platform.OS === 'ios') {
            const samples = await queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', {
                limit: 0,
                ascending: true,
                unit: 'count/min',
                filter: {
                    date: { startDate, endDate },
                },
            });
            return samples.map((s) => ({
                timestamp: s.startDate.getTime(),
                bpm: s.quantity,
            }));
        }

        if (Platform.OS === 'android') {
            if (!(await requireHealthConnectReady('readHeartRateSamples'))) {
                return [];
            }
            const result = await readRecords('HeartRate', {
                timeRangeFilter: {
                    operator: 'between',
                    startTime: startDate.toISOString(),
                    endTime: endDate.toISOString(),
                },
            });
            const samples: { timestamp: number; bpm: number }[] = [];
            for (const record of result.records) {
                for (const sample of record.samples) {
                    samples.push({
                        timestamp: new Date(sample.time).getTime(),
                        bpm: sample.beatsPerMinute,
                    });
                }
            }
            return samples.sort((a, b) => a.timestamp - b.timestamp);
        }
    } catch (error) {
        logHealthError('readHeartRateSamples', error);
    }
    return [];
}

export async function readActiveCalories(startDate: Date, endDate: Date): Promise<number | null> {
    try {
        if (Platform.OS === 'ios') {
            const result = await queryStatisticsForQuantity(
                'HKQuantityTypeIdentifierActiveEnergyBurned',
                ['cumulativeSum'],
                {
                    filter: { date: { startDate, endDate } },
                    unit: 'kcal',
                },
            );
            return result.sumQuantity?.quantity ?? null;
        }

        if (Platform.OS === 'android') {
            if (!(await requireHealthConnectReady('readActiveCalories'))) {
                return null;
            }
            const result = await aggregateRecord({
                recordType: 'ActiveCaloriesBurned',
                timeRangeFilter: {
                    operator: 'between',
                    startTime: startDate.toISOString(),
                    endTime: endDate.toISOString(),
                },
            });
            return result.ACTIVE_CALORIES_TOTAL.inKilocalories || null;
        }
    } catch (error) {
        logHealthError('readActiveCalories', error);
    }
    return null;
}

async function readBasalCalories(startDate: Date, endDate: Date): Promise<number | null> {
    try {
        if (Platform.OS === 'ios') {
            const result = await queryStatisticsForQuantity(
                'HKQuantityTypeIdentifierBasalEnergyBurned',
                ['cumulativeSum'],
                {
                    filter: { date: { startDate, endDate } },
                    unit: 'kcal',
                },
            );
            return result.sumQuantity?.quantity ?? null;
        }

        if (Platform.OS === 'android') {
            if (!(await requireHealthConnectReady('readBasalCalories'))) {
                return null;
            }
            const result = await aggregateRecord({
                recordType: 'BasalMetabolicRate',
                timeRangeFilter: {
                    operator: 'between',
                    startTime: startDate.toISOString(),
                    endTime: endDate.toISOString(),
                },
            });
            return result.BASAL_CALORIES_TOTAL.inKilocalories || null;
        }
    } catch (error) {
        logHealthError('readBasalCalories', error);
    }
    return null;
}

const sumNullableNumbers = (...values: (number | null)[]): number | null => {
    let sum = 0;
    let hasValue = false;

    for (const value of values) {
        if (value == null) continue;
        sum += value;
        hasValue = true;
    }

    return hasValue ? sum : null;
};

const chooseClosestWorkout = async (startDate: Date, endDate: Date) => {
    const workouts = await queryWorkoutSamples({
        limit: 10,
        ascending: false,
        filter: {
            date: {
                startDate: new Date(startDate.getTime() - 10 * 60 * 1000),
                endDate: new Date(endDate.getTime() + 10 * 60 * 1000),
            },
        },
    });

    const targetStartMs = startDate.getTime();
    const targetEndMs = endDate.getTime();

    return workouts.reduce<(typeof workouts)[number] | null>((best, candidate) => {
        const candidateDataScore =
            (candidate.totalDistance ? 1 : 0) + (candidate.metadata?.HKAverageMETs ? 1 : 0);
        const candidateDelta =
            Math.abs(candidate.startDate.getTime() - targetStartMs) +
            Math.abs(candidate.endDate.getTime() - targetEndMs);

        if (!best) return candidate;

        const bestDataScore = (best.totalDistance ? 1 : 0) + (best.metadata?.HKAverageMETs ? 1 : 0);
        const bestDelta =
            Math.abs(best.startDate.getTime() - targetStartMs) +
            Math.abs(best.endDate.getTime() - targetEndMs);

        if (candidateDataScore > bestDataScore) return candidate;
        if (candidateDataScore < bestDataScore) return best;
        return candidateDelta < bestDelta ? candidate : best;
    }, null);
};

async function readDistanceMeters(startDate: Date, endDate: Date): Promise<number | null> {
    try {
        if (Platform.OS === 'ios') {
            const result = await queryStatisticsForQuantity(
                'HKQuantityTypeIdentifierDistanceWalkingRunning',
                ['cumulativeSum'],
                {
                    filter: { date: { startDate, endDate } },
                    unit: 'm',
                },
            );
            return result.sumQuantity?.quantity ?? null;
        }

        if (Platform.OS === 'android') {
            if (!(await requireHealthConnectReady('readDistanceMeters'))) {
                return null;
            }
            const result = await aggregateRecord({
                recordType: 'Distance',
                timeRangeFilter: {
                    operator: 'between',
                    startTime: startDate.toISOString(),
                    endTime: endDate.toISOString(),
                },
            });
            return result.DISTANCE?.inMeters ?? null;
        }
    } catch (error) {
        logHealthError('readDistanceMeters', error);
    }

    return null;
}

async function readStepCount(startDate: Date, endDate: Date): Promise<number | null> {
    try {
        if (Platform.OS === 'ios') {
            const result = await queryStatisticsForQuantity(
                'HKQuantityTypeIdentifierStepCount',
                ['cumulativeSum'],
                {
                    filter: { date: { startDate, endDate } },
                    unit: 'count',
                },
            );
            return result.sumQuantity?.quantity ?? null;
        }

        if (Platform.OS === 'android') {
            if (!(await requireHealthConnectReady('readStepCount'))) {
                return null;
            }
            const result = await aggregateRecord({
                recordType: 'Steps',
                timeRangeFilter: {
                    operator: 'between',
                    startTime: startDate.toISOString(),
                    endTime: endDate.toISOString(),
                },
            });
            return result.COUNT_TOTAL ?? null;
        }
    } catch (error) {
        logHealthError('readStepCount', error);
    }

    return null;
}

export async function readWorkoutSummaryMetrics(
    startDate: Date,
    endDate: Date,
): Promise<WorkoutSummaryMetrics> {
    try {
        if (Platform.OS === 'ios') {
            const workout = await chooseClosestWorkout(startDate, endDate);

            const metricsStartDate = workout?.startDate ?? startDate;
            const metricsEndDate = workout?.endDate ?? endDate;

            const [distanceMeters, stepCount, activeCaloriesFromQuantitySamples, basalCalories] =
                await Promise.all([
                    readDistanceMeters(metricsStartDate, metricsEndDate),
                    readStepCount(metricsStartDate, metricsEndDate),
                    readActiveCalories(metricsStartDate, metricsEndDate),
                    readBasalCalories(metricsStartDate, metricsEndDate),
                ]);

            const activeCaloriesFromWorkout = workout?.totalEnergyBurned?.quantity ?? null;

            const resolvedActiveCalories =
                activeCaloriesFromWorkout ?? activeCaloriesFromQuantitySamples;
            const resolvedTotalCalories = sumNullableNumbers(
                activeCaloriesFromQuantitySamples,
                basalCalories,
            );

            return {
                avgMets: workout?.metadata?.HKAverageMETs?.quantity ?? null,
                activeCalories: resolvedActiveCalories,
                totalCalories: resolvedTotalCalories,
                distanceMeters: quantityToMeters(workout?.totalDistance) ?? distanceMeters,
                stepCount,
                workoutStartDate: workout?.startDate ?? null,
                workoutEndDate: workout?.endDate ?? null,
            };
        }

        const [distanceMeters, stepCount, activeCalories, basalCalories] = await Promise.all([
            readDistanceMeters(startDate, endDate),
            readStepCount(startDate, endDate),
            readActiveCalories(startDate, endDate),
            readBasalCalories(startDate, endDate),
        ]);

        return {
            avgMets: null,
            activeCalories,
            totalCalories: sumNullableNumbers(activeCalories, basalCalories),
            distanceMeters,
            stepCount,
            workoutStartDate: null,
            workoutEndDate: null,
        };
    } catch (error) {
        logHealthError('readWorkoutSummaryMetrics', error);
    }

    return {
        avgMets: null,
        activeCalories: null,
        totalCalories: null,
        distanceMeters: null,
        stepCount: null,
        workoutStartDate: null,
        workoutEndDate: null,
    };
}

export async function readHeartRateRecovery(workoutEndDate: Date): Promise<number | null> {
    try {
        if (Platform.OS === 'ios') {
            const samples = await queryQuantitySamples(
                'HKQuantityTypeIdentifierHeartRateRecoveryOneMinute',
                {
                    limit: 1,
                    ascending: false,
                    unit: 'count/min',
                    filter: {
                        date: {
                            startDate: new Date(workoutEndDate.getTime() - 5 * 60 * 1000),
                            endDate: new Date(workoutEndDate.getTime() + 10 * 60 * 1000),
                        },
                    },
                },
            );
            return samples[0]?.quantity ?? null;
        }
    } catch (error) {
        logHealthError('readHeartRateRecovery', error);
    }
    return null;
}

export async function readDateOfBirth(): Promise<Date | null> {
    // Profile fields are sourced from HealthKit only; Android is intentionally not implemented yet.
    if (Platform.OS === 'android') {
        return null;
    }

    if (Platform.OS !== 'ios') {
        return null;
    }

    try {
        return getDateOfBirth() ?? null;
    } catch (error) {
        logHealthError('readDateOfBirth', error);
        return null;
    }
}

export async function readBiologicalSex(): Promise<'female' | 'male' | 'other' | null> {
    // Profile fields are sourced from HealthKit only; Android is intentionally not implemented yet.
    if (Platform.OS === 'android') {
        return null;
    }

    if (Platform.OS !== 'ios') {
        return null;
    }

    try {
        const biologicalSex = getBiologicalSex();

        switch (biologicalSex) {
            case BiologicalSex.female:
                return 'female';
            case BiologicalSex.male:
                return 'male';
            case BiologicalSex.other:
                return 'other';
            default:
                return null;
        }
    } catch (error) {
        logHealthError('readBiologicalSex', error);
        return null;
    }
}
