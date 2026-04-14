export const SKULPT_EXERCISES_USER_ID = '__skulpt__';

export const isSkulptExerciseUserId = (userId: string | null | undefined): boolean =>
    userId === SKULPT_EXERCISES_USER_ID;

const DEFAULT_EXERCISE_GIF_BASE_URL =
    'https://storage.yandexcloud.net/skulpt-storage/images/exercises';
const EXERCISE_GIF_BASE_URL =
    process.env.EXPO_PUBLIC_EXERCISE_GIF_BASE_URL || DEFAULT_EXERCISE_GIF_BASE_URL;

export const EXERCISE_GIF_THUMBNAIL_RESOLUTION = 180;
export const EXERCISE_GIF_PREVIEW_RESOLUTION = 1080;

export const buildExerciseGifUrl = (gifFilename: string, resolution: number): string => {
    const normalizedFilename = gifFilename.trim();
    if (!normalizedFilename) return '';

    const normalizedBaseUrl = EXERCISE_GIF_BASE_URL.replace(/\/+$/, '');
    return `${normalizedBaseUrl}/${encodeURIComponent(normalizedFilename)}-${resolution}.gif`;
};
