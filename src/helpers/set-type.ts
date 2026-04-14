export type ExerciseSetType = 'working' | 'warmup' | 'dropset' | 'failure';

export const normalizeSetType = (value: unknown): ExerciseSetType => {
    if (typeof value !== 'string') return 'working';

    const normalized = value.toLowerCase();
    if (normalized === 'warmup') return 'warmup';
    if (normalized === 'dropset') return 'dropset';
    if (normalized === 'failure') return 'failure';
    return 'working';
};

export const isWarmupSetType = (value: unknown): boolean => normalizeSetType(value) === 'warmup';

export const isWorkingLikeSetType = (value: unknown): boolean => !isWarmupSetType(value);
