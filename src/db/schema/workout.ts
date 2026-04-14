import { sql, relations } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { user } from './user';
import { exercise, exerciseSet } from './exercise';

export type WorkoutSelect = typeof workout.$inferSelect;
export type WorkoutInsert = typeof workout.$inferInsert;

export type WorkoutExerciseSelect = typeof workoutExercise.$inferSelect;
export type WorkoutExerciseInsert = typeof workoutExercise.$inferInsert;

export type WorkoutGroupSelect = typeof workoutGroup.$inferSelect;
export type WorkoutGroupInsert = typeof workoutGroup.$inferInsert;

export const workout = sqliteTable(
    'workout',
    {
        id: text('id', { length: 21 }).primaryKey(),
        name: text('name').notNull(),
        status: text('status', {
            enum: ['planned', 'in_progress', 'completed', 'cancelled'],
        })
            .notNull()
            .default('planned'),
        startAt: integer('start_at', { mode: 'timestamp_ms' }),
        startedAt: integer('started_at', { mode: 'timestamp_ms' }),
        completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
        duration: integer('duration'),
        remind: text('remind', {
            enum: ['start', '5m', '10m', '15m', '30m', '1h', '2h'],
        }),
        userId: text('user_id', { length: 21 }).notNull(),
        createdAt: integer('created_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`),
        updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`)
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index('workout_user_status_idx').on(table.userId, table.status),
        index('workout_user_created_at_idx').on(table.userId, table.createdAt),
        index('workout_status_idx').on(table.status),
    ],
);

export const workoutGroup = sqliteTable('workout_group', {
    id: text('id', { length: 21 }).primaryKey(),
    workoutId: text('workout_id', { length: 21 }).notNull(),
    type: text('type', { enum: ['single', 'superset', 'triset', 'circuit'] })
        .notNull()
        .default('single'),
    order: integer('order').notNull(),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
        .notNull()
        .default(sql`(strftime('%s','now') * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
        .notNull()
        .default(sql`(strftime('%s','now') * 1000)`)
        .$onUpdate(() => new Date()),
});

export const workoutExercise = sqliteTable(
    'workout_exercise',
    {
        id: text('id', { length: 21 }).primaryKey(),
        workoutId: text('workout_id', { length: 21 }).notNull(),
        exerciseId: text('exercise_id', { length: 21 }).notNull(),
        groupId: text('group_id', { length: 21 }),
        orderInGroup: integer('order_in_group'),
        createdAt: integer('created_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`),
        updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`)
            .$onUpdate(() => new Date()),
    },
    (table) => [index('workout_exercise_workout_idx').on(table.workoutId)],
);

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
