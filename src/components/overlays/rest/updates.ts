import { ExerciseSetSelect } from '@/db/schema';
import { isRestFinalized } from '@/helpers/rest';

type RestEditableSet = Pick<ExerciseSetSelect, 'completedAt' | 'restCompletedAt' | 'finalRestTime'>;

type RestUpdate = Partial<
    Pick<ExerciseSetSelect, 'restTime' | 'restCompletedAt' | 'finalRestTime'>
>;

export const buildExerciseSetRestUpdate = (
    set: RestEditableSet,
    restValue: number | null,
): RestUpdate => {
    const restTime = restValue == null ? null : Math.max(0, Math.trunc(restValue));

    if (!set.completedAt) {
        return { restTime };
    }

    if (restTime == null || restTime <= 0) {
        return {
            restTime: null,
            restCompletedAt: null,
            finalRestTime: null,
        };
    }

    if (isRestFinalized(set)) {
        return set.finalRestTime == null
            ? {
                  restTime,
                  finalRestTime: restTime,
              }
            : { restTime };
    }

    return {
        restTime,
        restCompletedAt: null,
        finalRestTime: null,
    };
};
