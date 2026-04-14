import { eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { exercise, ExerciseSelect } from '@/db/schema/exercise';
import { workoutExercise } from '@/db/schema/workout';

export interface WorkoutOverviewExerciseMetaRow {
    workoutId: string;
    category: ExerciseSelect['category'];
    primaryMuscleGroups: ExerciseSelect['primaryMuscleGroups'];
}

export const getWorkoutOverviewExerciseMetaRows = async (
    workoutIds: string[],
): Promise<WorkoutOverviewExerciseMetaRow[]> => {
    if (workoutIds.length === 0) {
        return [];
    }

    const uniqueWorkoutIds = Array.from(new Set(workoutIds));

    return db
        .select({
            workoutId: workoutExercise.workoutId,
            category: exercise.category,
            primaryMuscleGroups: exercise.primaryMuscleGroups,
        })
        .from(workoutExercise)
        .innerJoin(exercise, eq(workoutExercise.exerciseId, exercise.id))
        .where(inArray(workoutExercise.workoutId, uniqueWorkoutIds));
};
