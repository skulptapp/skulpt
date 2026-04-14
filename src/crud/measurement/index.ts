import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/db';
import { MeasurementInsert, measurement, MeasurementSelect } from '@/db/schema';
import { nanoid } from '@/helpers/nanoid';
import { reportError } from '@/services/error-reporting';
import { MeasurementSource, MeasurementSourcePlatform } from '@/constants/measurement';

import { queueSyncOperations } from '../sync';
import { getCurrentUser } from '../user';

const HEALTH_INSERT_BATCH_SIZE = 150;

export interface CreateMeasurementInput {
    metric: string;
    value: number;
    unit: string;
    recordedAt: Date;
    source?: MeasurementSource;
    sourcePlatform?: MeasurementSourcePlatform | null;
    externalId?: string | null;
}

export interface HealthMeasurementImportInput {
    metric: string;
    value: number;
    unit: string;
    recordedAt: Date;
    sourcePlatform: MeasurementSourcePlatform;
    externalId: string;
}

export interface HealthMeasurementImportResult {
    inserted: number;
    skipped: number;
}

const resolveUserId = async (userId?: string) => {
    if (userId) {
        return userId;
    }

    const user = await getCurrentUser();
    if (!user?.id) {
        throw new Error('Current user not found');
    }

    return user.id;
};

const isValidDate = (value: Date): boolean =>
    value instanceof Date && Number.isFinite(value.getTime());

const normalizeExternalId = (externalId?: string | null): string | null => {
    if (typeof externalId !== 'string') return null;
    const trimmed = externalId.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const normalizeCreateInput = (
    input: CreateMeasurementInput,
): (Omit<CreateMeasurementInput, 'externalId'> & { externalId: string | null }) | null => {
    const metric = input.metric?.trim();
    const unit = input.unit?.trim();
    const value = Number(input.value);

    if (!metric || !unit || !Number.isFinite(value) || !isValidDate(input.recordedAt)) {
        return null;
    }

    return {
        ...input,
        metric,
        unit,
        value,
        externalId: normalizeExternalId(input.externalId),
    };
};

const queueCreateSyncForRows = async (rows: MeasurementInsert[]) => {
    if (rows.length === 0) return;

    await queueSyncOperations(
        rows.map((row) => ({
            tableName: 'measurement',
            recordId: row.id,
            operation: 'create',
            timestamp: row.updatedAt as Date,
            data: row,
        })),
    );
};

export const createMeasurements = async (
    inputs: CreateMeasurementInput[],
    userId?: string,
): Promise<MeasurementSelect[]> => {
    if (inputs.length === 0) {
        return [];
    }

    const resolvedUserId = await resolveUserId(userId);
    const now = new Date();

    const rows: MeasurementInsert[] = inputs
        .map((input) => normalizeCreateInput(input))
        .filter((input): input is NonNullable<typeof input> => input !== null)
        .map((input) => ({
            id: nanoid(),
            userId: resolvedUserId,
            metric: input.metric,
            value: input.value,
            unit: input.unit,
            recordedAt: input.recordedAt,
            source: input.source ?? 'manual',
            sourcePlatform: input.sourcePlatform ?? null,
            externalId: input.externalId,
            createdAt: now,
            updatedAt: now,
        }));

    if (rows.length === 0) {
        return [];
    }

    try {
        await db.insert(measurement).values(rows);
        await queueCreateSyncForRows(rows);

        return rows as MeasurementSelect[];
    } catch (error) {
        reportError(error, 'Failed to create measurements:', {
            extras: {
                count: rows.length,
            },
        });
        throw error;
    }
};

export const importHealthMeasurements = async (
    inputs: HealthMeasurementImportInput[],
    userId?: string,
): Promise<HealthMeasurementImportResult> => {
    if (inputs.length === 0) {
        return { inserted: 0, skipped: 0 };
    }

    const resolvedUserId = await resolveUserId(userId);
    const deduplicated = new Map<string, HealthMeasurementImportInput>();

    for (const input of inputs) {
        const normalized = normalizeCreateInput({
            ...input,
            source: 'health',
        });

        if (!normalized || !normalized.externalId) {
            continue;
        }

        const key = `${normalized.metric}:${normalized.externalId}`;
        const current = deduplicated.get(key);

        if (!current || normalized.recordedAt.getTime() > current.recordedAt.getTime()) {
            deduplicated.set(key, {
                metric: normalized.metric,
                value: normalized.value,
                unit: normalized.unit,
                recordedAt: normalized.recordedAt,
                sourcePlatform: input.sourcePlatform,
                externalId: normalized.externalId,
            });
        }
    }

    const candidates = Array.from(deduplicated.values());
    if (candidates.length === 0) {
        return { inserted: 0, skipped: inputs.length };
    }

    let inserted = 0;
    let skipped = 0;

    try {
        for (let offset = 0; offset < candidates.length; offset += HEALTH_INSERT_BATCH_SIZE) {
            const chunk = candidates.slice(offset, offset + HEALTH_INSERT_BATCH_SIZE);
            const externalIds = Array.from(new Set(chunk.map((entry) => entry.externalId)));
            const now = new Date();

            const existingRows = await db
                .select({
                    metric: measurement.metric,
                    externalId: measurement.externalId,
                })
                .from(measurement)
                .where(
                    and(
                        eq(measurement.userId, resolvedUserId),
                        eq(measurement.source, 'health'),
                        inArray(measurement.externalId, externalIds),
                    ),
                );

            const existingKeys = new Set(
                existingRows
                    .filter((row) => row.externalId != null)
                    .map((row) => `${row.metric}:${row.externalId}`),
            );

            const rowsToInsert: MeasurementInsert[] = chunk
                .filter((entry) => !existingKeys.has(`${entry.metric}:${entry.externalId}`))
                .map((entry) => ({
                    id: nanoid(),
                    userId: resolvedUserId,
                    metric: entry.metric,
                    value: entry.value,
                    unit: entry.unit,
                    recordedAt: entry.recordedAt,
                    source: 'health',
                    sourcePlatform: entry.sourcePlatform,
                    externalId: entry.externalId,
                    createdAt: now,
                    updatedAt: now,
                }));

            if (rowsToInsert.length === 0) {
                skipped += chunk.length;
                continue;
            }

            await db.insert(measurement).values(rowsToInsert);
            await queueCreateSyncForRows(rowsToInsert);

            inserted += rowsToInsert.length;
            skipped += chunk.length - rowsToInsert.length;

            await new Promise((resolve) => setTimeout(resolve, 0));
        }

        return { inserted, skipped };
    } catch (error) {
        reportError(error, 'Failed to import health measurements:', {
            extras: {
                candidateCount: candidates.length,
                inserted,
                skipped,
            },
        });
        throw error;
    }
};

export const getMeasurementTimeline = async (
    metric: string,
    userId?: string,
): Promise<MeasurementSelect[]> => {
    const resolvedUserId = await resolveUserId(userId);

    return await db
        .select()
        .from(measurement)
        .where(and(eq(measurement.userId, resolvedUserId), eq(measurement.metric, metric)))
        .orderBy(measurement.recordedAt);
};

export const getLatestMeasurementsByMetric = async (
    metrics: string[],
    userId?: string,
): Promise<Record<string, MeasurementSelect | null>> => {
    const resolvedUserId = await resolveUserId(userId);
    if (metrics.length === 0) return {};

    const uniqueMetrics = Array.from(new Set(metrics));

    const rows = await db
        .select()
        .from(measurement)
        .where(
            and(eq(measurement.userId, resolvedUserId), inArray(measurement.metric, uniqueMetrics)),
        )
        .orderBy(desc(measurement.recordedAt), desc(measurement.createdAt));

    const latest = new Map<string, MeasurementSelect>();

    for (const row of rows) {
        if (!latest.has(row.metric)) {
            latest.set(row.metric, row);
        }
    }

    return uniqueMetrics.reduce<Record<string, MeasurementSelect | null>>((acc, metricName) => {
        acc[metricName] = latest.get(metricName) ?? null;
        return acc;
    }, {});
};

export const getLatestHealthMeasurementDatesByMetric = async (
    userId?: string,
): Promise<Record<string, Date>> => {
    const resolvedUserId = await resolveUserId(userId);

    const rows = await db
        .select({
            metric: measurement.metric,
            latestRecordedAtMs: sql<number>`max(${measurement.recordedAt})`,
        })
        .from(measurement)
        .where(and(eq(measurement.userId, resolvedUserId), eq(measurement.source, 'health')))
        .groupBy(measurement.metric);

    const result: Record<string, Date> = {};

    for (const row of rows) {
        const value = Number(row.latestRecordedAtMs);
        if (!Number.isFinite(value) || value <= 0) continue;
        result[row.metric] = new Date(value);
    }

    return result;
};
