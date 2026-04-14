import dayjs from 'dayjs';

import { convertWeight } from '@/helpers/units';
import { type MeasurementWithDisplayValue, type XAxisTick } from './types';

const convertToDisplayWeight = (
    value: number,
    sourceUnit: string,
    targetUnit: 'kg' | 'lb',
): number | null => {
    if (!Number.isFinite(value)) return null;

    if (sourceUnit === targetUnit) return value;
    if (sourceUnit === 'kg' && targetUnit === 'lb') return convertWeight(value, 'kg', 'lb');
    if (sourceUnit === 'lb' && targetUnit === 'kg') return convertWeight(value, 'lb', 'kg');

    return value;
};

const buildPageXAxisTicks = (points: MeasurementWithDisplayValue[]): XAxisTick[] => {
    if (points.length === 0) return [];

    if (points.length === 1) {
        return [
            {
                label: dayjs(points[0].recordedAt).format('D MMM YYYY'),
                align: 'start',
            },
        ];
    }

    if (points.length === 2) {
        return [
            {
                label: dayjs(points[0].recordedAt).format('D MMM YYYY'),
                align: 'start',
            },
            {
                label: dayjs(points[1].recordedAt).format('D MMM YYYY'),
                align: 'end',
            },
        ];
    }

    const middleIndex = Math.floor((points.length - 1) / 2);
    return [
        {
            label: dayjs(points[0].recordedAt).format('D MMM YYYY'),
            align: 'start',
        },
        {
            label: dayjs(points[middleIndex].recordedAt).format('D MMM YYYY'),
            align: 'center',
        },
        {
            label: dayjs(points[points.length - 1].recordedAt).format('D MMM YYYY'),
            align: 'end',
        },
    ];
};

export { buildPageXAxisTicks, convertToDisplayWeight };
