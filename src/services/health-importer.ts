import {
    getLatestHealthMeasurementDatesByMetric,
    importHealthMeasurements,
} from '@/crud/measurement';

import { readHealthMeasurementSamples } from './health';
import { reportError } from './error-reporting';

export interface MeasurementHealthImportSummary {
    permissionGranted: boolean;
    importedCount: number;
    skippedCount: number;
    sampledCount: number;
}

const isHealthServiceUnavailableError = (error: unknown): boolean => {
    if (error instanceof Error) {
        return error.message.toLowerCase().includes('service not available');
    }

    if (typeof error === 'string') {
        return error.toLowerCase().includes('service not available');
    }

    if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as { message?: unknown }).message;
        return (
            typeof message === 'string' && message.toLowerCase().includes('service not available')
        );
    }

    return false;
};

export const importLatestHealthForUser = async (
    userId: string,
): Promise<MeasurementHealthImportSummary> => {
    try {
        const sinceByMetric = await getLatestHealthMeasurementDatesByMetric(userId);
        const readResult = await readHealthMeasurementSamples({ sinceByMetric });

        if (!readResult.permissionGranted) {
            return {
                permissionGranted: false,
                importedCount: 0,
                skippedCount: 0,
                sampledCount: 0,
            };
        }

        if (readResult.samples.length === 0) {
            return {
                permissionGranted: true,
                importedCount: 0,
                skippedCount: 0,
                sampledCount: 0,
            };
        }

        const importResult = await importHealthMeasurements(readResult.samples, userId);

        return {
            permissionGranted: true,
            importedCount: importResult.inserted,
            skippedCount: importResult.skipped,
            sampledCount: readResult.samples.length,
        };
    } catch (error) {
        if (!isHealthServiceUnavailableError(error)) {
            reportError(error, 'Failed to import latest health measurements:');
        }
        return {
            permissionGranted: false,
            importedCount: 0,
            skippedCount: 0,
            sampledCount: 0,
        };
    }
};
