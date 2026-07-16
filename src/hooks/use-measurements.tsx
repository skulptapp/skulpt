import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
    createMeasurements,
    CreateMeasurementInput,
    getLatestMeasurementsByMetric,
    getMeasurementTimeline,
    importHealthMeasurements,
    HealthMeasurementImportInput,
} from '@/crud/measurement';
import { MeasurementSelect } from '@/db/schema';

import { useUser } from './use-user';
import { useAnalytics } from './use-analytics';

export const useMeasurementTimeline = (metric: string): MeasurementSelect[] => {
    const { user } = useUser();

    const { data = [] } = useQuery({
        queryKey: ['measurements', 'timeline', user?.id, metric],
        queryFn: () => getMeasurementTimeline(metric, user!.id),
        enabled: !!user?.id && metric.length > 0,
        placeholderData: [],
        staleTime: 60_000 * 5,
    });

    return data;
};

export const useLatestMeasurementsByMetric = (
    metrics: string[],
): Record<string, MeasurementSelect | null> => {
    const { user } = useUser();
    const stableMetrics = useMemo(() => Array.from(new Set(metrics)).sort(), [metrics]);

    const { data = {} } = useQuery({
        queryKey: ['measurements', 'latest', user?.id, stableMetrics],
        queryFn: () => getLatestMeasurementsByMetric(stableMetrics, user!.id),
        enabled: !!user?.id && stableMetrics.length > 0,
        placeholderData: {},
        staleTime: 60_000 * 2,
    });

    return data;
};

export const useCreateMeasurements = () => {
    const queryClient = useQueryClient();
    const { user } = useUser();
    const { track } = useAnalytics();

    return useMutation({
        mutationFn: (inputs: CreateMeasurementInput[]) => createMeasurements(inputs, user!.id),
        onSuccess: (created) => {
            queryClient.invalidateQueries({ queryKey: ['measurements'] });
            const counts = new Map<
                string,
                { metric: string; source: 'manual' | 'health'; count: number }
            >();
            created.forEach((measurement) => {
                const source = measurement.source === 'health' ? 'health' : 'manual';
                const key = `${measurement.metric}\u0000${source}`;
                const current = counts.get(key);
                counts.set(key, {
                    metric: measurement.metric,
                    source,
                    count: (current?.count ?? 0) + 1,
                });
            });
            counts.forEach(({ metric, source, count }) => {
                track('measurement:created', {
                    metric,
                    source,
                    count,
                });
            });
        },
    });
};

export const useImportHealthMeasurements = () => {
    const queryClient = useQueryClient();
    const { user } = useUser();

    return useMutation({
        mutationFn: (inputs: HealthMeasurementImportInput[]) =>
            importHealthMeasurements(inputs, user!.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['measurements'] });
        },
    });
};
