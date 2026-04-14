import { MeasurementSelect } from '@/db/schema';

export type MeasurementWithDisplayValue = {
    id: MeasurementSelect['id'];
    userId: MeasurementSelect['userId'];
    metric: MeasurementSelect['metric'];
    value: MeasurementSelect['value'];
    unit: MeasurementSelect['unit'];
    recordedAt: MeasurementSelect['recordedAt'];
    source: MeasurementSelect['source'];
    sourcePlatform: MeasurementSelect['sourcePlatform'];
    externalId: MeasurementSelect['externalId'];
    createdAt: MeasurementSelect['createdAt'];
    updatedAt: MeasurementSelect['updatedAt'];
    displayValue: number;
};

export type XAxisTick = {
    label: string;
    align: 'start' | 'center' | 'end';
};

export type WeightChartPage = {
    key: string;
    startIndex: number;
    endIndex: number;
    leftInset: number;
    rightInset: number;
    segmentSpacing: number;
    points: MeasurementWithDisplayValue[];
    xAxisTicks: XAxisTick[];
};
