export const APP_REVIEW_PROMPT_KEY = 'post_workout_review';
export const APP_REVIEW_CURRENT_CYCLE_INDEX = 0;
export const APP_REVIEW_MIN_COMPLETED_WORKOUTS = 5;
export const APP_REVIEW_MIN_DURATION_SECONDS = 15 * 60;

export const APP_REVIEW_RESPONSES = ['bad', 'not_bad', 'good'] as const;

export type AppReviewResponse = (typeof APP_REVIEW_RESPONSES)[number];
export type AppReviewCompletionSource = 'phone' | 'watch';
