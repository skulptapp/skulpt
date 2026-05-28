import { relations } from 'drizzle-orm';
import { exercise, exerciseSet } from './exercise';
import { user } from './user';
import { workout, workoutExercise, workoutGroup } from './workout';

export const userRelations = relations(user, ({ many }) => ({
    exercises: many(exercise),
    workouts: many(workout),
}));

export const exerciseRelations = relations(exercise, ({ one, many }) => ({
    user: one(user, {
        fields: [exercise.userId],
        references: [user.id],
    }),
    workoutExercises: many(workoutExercise),
}));

export const exerciseSetRelations = relations(exerciseSet, ({ one }) => ({
    workoutExercise: one(workoutExercise, {
        fields: [exerciseSet.workoutExerciseId],
        references: [workoutExercise.id],
    }),
}));

export const workoutRelations = relations(workout, ({ one, many }) => ({
    user: one(user, {
        fields: [workout.userId],
        references: [user.id],
    }),
    workoutExercises: many(workoutExercise),
    groups: many(workoutGroup),
}));

export const workoutExerciseRelations = relations(workoutExercise, ({ one, many }) => ({
    workout: one(workout, {
        fields: [workoutExercise.workoutId],
        references: [workout.id],
    }),
    exercise: one(exercise, {
        fields: [workoutExercise.exerciseId],
        references: [exercise.id],
    }),
    group: one(workoutGroup, {
        fields: [workoutExercise.groupId],
        references: [workoutGroup.id],
    }),
    sets: many(exerciseSet),
}));

export const workoutGroupRelations = relations(workoutGroup, ({ one, many }) => ({
    workout: one(workout, {
        fields: [workoutGroup.workoutId],
        references: [workout.id],
    }),
    exercises: many(workoutExercise),
}));
