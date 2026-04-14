import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { ExerciseSetSelect } from '@/db/schema';

dayjs.extend(duration);

const toMs = (value: unknown) => {
    if (!value) return null;
    if (typeof value === 'number') return value;
    if (value instanceof Date) return value.getTime();
    const parsed = new Date(value as any).getTime();
    return Number.isNaN(parsed) ? null : parsed;
};

export const getCompletedAtMs = (set: Pick<ExerciseSetSelect, 'completedAt'>) => {
    return toMs(set.completedAt);
};

export const getRestSecondsPlanned = (set: Pick<ExerciseSetSelect, 'restTime'>) =>
    Math.max(0, set.restTime ?? 0);

export const isRestFinalized = (set: Pick<ExerciseSetSelect, 'restCompletedAt'>) =>
    Boolean(set.restCompletedAt);

export const getRestEndMs = (
    set: Pick<ExerciseSetSelect, 'completedAt' | 'restTime' | 'restCompletedAt'>,
) => {
    const planned = getRestSecondsPlanned(set);
    const completedAtMs = getCompletedAtMs(set);
    if (planned <= 0 || completedAtMs == null) return null;
    const finalizedMs = toMs(set.restCompletedAt);
    return finalizedMs ?? completedAtMs + planned * 1000;
};

export const getRemainingRestSeconds = (
    set: Pick<ExerciseSetSelect, 'completedAt' | 'restTime' | 'restCompletedAt'>,
    nowMs: number,
) => {
    const endMs = getRestEndMs(set);
    if (endMs == null) return null;
    if (isRestFinalized(set)) return null;

    // Calculate remaining milliseconds
    const remainingMs = endMs - nowMs;
    if (remainingMs <= 0) return 0;

    // Convert to seconds with proper rounding
    // Add 999ms to ensure we round up partial seconds correctly
    const remainingSeconds = Math.floor((remainingMs + 999) / 1000);

    return remainingSeconds;
};

export const isRestActive = (
    set: Pick<ExerciseSetSelect, 'completedAt' | 'restTime' | 'restCompletedAt'>,
    nowMs: number,
) => {
    if (isRestFinalized(set)) return false;
    const completedAtMs = getCompletedAtMs(set);
    if (completedAtMs == null) return false;

    const planned = getRestSecondsPlanned(set);
    if (planned <= 0) return false;

    const elapsedMs = nowMs - completedAtMs;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);

    return elapsedSeconds < planned;
};

export const needsAutoFinalize = (
    set: Pick<ExerciseSetSelect, 'completedAt' | 'restTime' | 'restCompletedAt'>,
    nowMs: number,
) => {
    if (isRestFinalized(set)) return false;
    const completedAtMs = getCompletedAtMs(set);
    if (completedAtMs == null) return false;

    const planned = getRestSecondsPlanned(set);
    if (planned <= 0) return false;

    const elapsedMs = nowMs - completedAtMs;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);

    return elapsedSeconds >= planned;
};

export const computeFinalRestSeconds = (
    set: Pick<ExerciseSetSelect, 'completedAt' | 'restTime'>,
    restEndMs: number,
) => {
    const planned = getRestSecondsPlanned(set);
    const completedAtMs = getCompletedAtMs(set) ?? restEndMs;
    const diffSec = Math.floor((restEndMs - completedAtMs) / 1000);
    return Math.max(0, Math.min(planned, diffSec));
};

export const buildFinalizeRestUpdate = (
    set: Pick<ExerciseSetSelect, 'completedAt' | 'restTime'>,
    restEndMs: number,
) => {
    const finalRestTime = computeFinalRestSeconds(set, restEndMs);
    return {
        restCompletedAt: new Date(restEndMs),
        finalRestTime,
    } as const;
};

/**
 * Formats rest time in MM:SS format
 * @param set - Exercise set with rest time information
 * @param initialSeconds - Initial/planned rest time in seconds (fallback if finalRestTime is not available)
 * @param remainingSeconds - Current remaining seconds (for active rest timers, optional)
 * @returns Formatted time string in MM:SS format
 */
export const formatRestTime = (
    set: Pick<ExerciseSetSelect, 'restCompletedAt' | 'finalRestTime' | 'restTime'>,
    initialSeconds: number,
    remainingSeconds?: number | null,
): string => {
    let seconds = remainingSeconds ?? initialSeconds;

    // Only show final/initial value when rest is actually completed
    if (set.restCompletedAt != null) {
        seconds = set.finalRestTime ?? initialSeconds;
    }

    const d = dayjs.duration(seconds, 'seconds');
    const total = Math.max(0, Math.floor(d.asSeconds()));
    const mm = Math.floor(total / 60).toString();
    const ss = (total % 60).toString().padStart(2, '0');

    return `${mm}:${ss}`;
};
