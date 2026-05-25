import { and, eq, exists, inArray, isNotNull, ne, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import { exercise, exerciseSet, ExerciseSelect } from '@/db/schema/exercise';
import { workout, workoutExercise } from '@/db/schema/workout';

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
        .innerJoin(workout, eq(workoutExercise.workoutId, workout.id))
        .innerJoin(exercise, eq(workoutExercise.exerciseId, exercise.id))
        .where(
            and(
                inArray(workoutExercise.workoutId, uniqueWorkoutIds),
                or(
                    ne(workout.status, 'completed'),
                    exists(
                        db
                            .select({ one: sql`1` })
                            .from(exerciseSet)
                            .where(
                                and(
                                    eq(exerciseSet.workoutExerciseId, workoutExercise.id),
                                    isNotNull(exerciseSet.completedAt),
                                ),
                            ),
                    ),
                ),
            ),
        );
};
