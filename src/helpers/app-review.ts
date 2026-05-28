import {
    APP_REVIEW_MIN_COMPLETED_WORKOUTS,
    APP_REVIEW_MIN_DURATION_SECONDS,
} from '@/constants/app-review';

export const isQualifyingWorkoutDuration = (durationSeconds?: number | null): boolean =>
    typeof durationSeconds === 'number' &&
    Number.isFinite(durationSeconds) &&
    durationSeconds > APP_REVIEW_MIN_DURATION_SECONDS;

export const isEligibleWorkoutCount = (count: number): boolean =>
    count >= APP_REVIEW_MIN_COMPLETED_WORKOUTS;
