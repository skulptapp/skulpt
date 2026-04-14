import type { ExerciseHistoryItem } from '@/crud/exercise';

export interface MetricChartPoint {
    id: string;
    value: number;
    date: Date;
    label: string;
}

export const roundOneDecimal = (value: number): number => Math.round(value * 10) / 10;

export const resolveWorkoutDate = (historyItem: ExerciseHistoryItem): Date => {
    return (
        historyItem.workout.completedAt ??
        historyItem.workout.startedAt ??
        historyItem.workout.createdAt
    );
};

export const sortMetricPoints = <T extends MetricChartPoint>(points: T[]): T[] => {
    return points.sort((a, b) => {
        const timeDiff = a.date.getTime() - b.date.getTime();
        if (timeDiff !== 0) return timeDiff;
        return a.id.localeCompare(b.id);
    });
};
