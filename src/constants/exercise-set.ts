export const MAX_EXERCISE_SET_REPS = 9999;

export const clampExerciseSetReps = (value: number): number => {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(MAX_EXERCISE_SET_REPS, Math.trunc(value)));
};
