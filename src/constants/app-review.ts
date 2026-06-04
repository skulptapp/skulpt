export const APP_REVIEW_PROMPT_KEY = 'post_workout_review';
export const APP_REVIEW_CURRENT_CYCLE_INDEX = 0;
export const APP_REVIEW_MIN_COMPLETED_WORKOUTS = 5;
export const APP_REVIEW_MIN_DURATION_SECONDS = 15 * 60;
export const APP_STORE_REVIEW_FOREGROUND_DELAY_MS = 60_000;
export const APP_STORE_REVIEW_ROUTE_STABILITY_MS = 2_000;
export const APP_STORE_REVIEW_RETRY_DELAY_MS = 10_000;

export const APP_REVIEW_RESPONSES = ['bad', 'not_bad', 'good'] as const;

export type AppReviewResponse = (typeof APP_REVIEW_RESPONSES)[number];
export type AppReviewCompletionSource = 'phone' | 'watch';
