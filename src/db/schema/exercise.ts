import { sql, relations } from 'drizzle-orm';
import { index, integer, sqliteTable, text, real } from 'drizzle-orm/sqlite-core';
import { user } from './user';
import { workoutExercise } from './workout';

export type ExerciseSelect = typeof exercise.$inferSelect;
export type ExerciseInsert = typeof exercise.$inferInsert;

export type ExerciseSetSelect = typeof exerciseSet.$inferSelect;
export type ExerciseSetInsert = typeof exerciseSet.$inferInsert;

export const exercise = sqliteTable('exercise', {
    id: text('id', { length: 21 }).primaryKey(),
    name: text('name').notNull(),
    category: text('category', {
        enum: ['strength', 'cardio', 'flexibility', 'yoga', 'pilates', 'other'],
    }).notNull(),
    tracking: text('tracking', { mode: 'json' })
        .$type<('weight' | 'reps' | 'time' | 'distance')[]>()
        .notNull(),
    weightUnits: text('weight_units', { enum: ['kg', 'lb'] }),
    weightAssisted: integer('weight_assisted', { mode: 'boolean' }),
    weightDoubleInStats: integer('weight_double_in_stats', { mode: 'boolean' }),
    distanceUnits: text('distance_units', { enum: ['km', 'mi'] }),
    distanceActivityType: text('distance_activity_type', {
        enum: [
            'outdoor_running',
            'indoor_running',
            'outdoor_walking',
            'indoor_walking',
            'stationary_bike',
            'bike',
            'elliptical',
            'cardio',
        ],
    }),
    distanceTrackAW: integer('distance_track_aw', { mode: 'boolean' }),
    timeOptions: text('time_options', { enum: ['log', 'timer', 'stopwatch'] }),
    timeHalfwayAlert: integer('time_halfway_alert', { mode: 'boolean' }),
    source: text('source', { enum: ['user', 'system'] })
        .notNull()
        .default('user'),
    skulptSourceId: text('skulpt_source_id'),
    primaryMuscleGroups: text('primary_muscle_groups', { mode: 'json' }).$type<string[]>(),
    secondaryMuscleGroups: text('secondary_muscle_groups', { mode: 'json' }).$type<string[]>(),
    equipment: text('equipment', { mode: 'json' }).$type<string[]>(),
    mistakes: text('mistakes', { mode: 'json' }).$type<string[]>(),
    instructions: text('instructions', { mode: 'json' }).$type<string[]>(),
    description: text('description'),
    difficulty: text('difficulty'),
    gifFilename: text('gif_filename'),
    userId: text('user_id', { length: 21 }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
        .notNull()
        .default(sql`(strftime('%s','now') * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
        .notNull()
        .default(sql`(strftime('%s','now') * 1000)`)
        .$onUpdate(() => new Date()),
});

export const exerciseRelations = relations(exercise, ({ one, many }) => ({
    user: one(user, {
        fields: [exercise.userId],
        references: [user.id],
    }),
    workoutExercises: many(workoutExercise),
}));

export const exerciseSet = sqliteTable(
    'exercise_set',
    {
        id: text('id', { length: 21 }).primaryKey(),
        workoutExerciseId: text('workout_exercise_id', { length: 21 }).notNull(),
        order: integer('order').notNull(),
        type: text('type', {
            enum: ['warmup', 'working', 'dropset', 'failure'],
        })
            .notNull()
            .default('working'),
        round: integer('round'),
        weight: real('weight'),
        weightUnits: text('weight_units', { enum: ['kg', 'lb'] }),
        reps: integer('reps'),
        time: integer('time'),
        distance: real('distance'),
        distanceUnits: text('distance_units', { enum: ['km', 'mi'] }),
        rpe: integer('rpe'),
        restTime: integer('rest_time'),
        restCompletedAt: integer('rest_completed_at', { mode: 'timestamp_ms' }),
        finalRestTime: integer('final_rest_time'),
        startedAt: integer('started_at', { mode: 'timestamp_ms' }),
        completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
        createdAt: integer('created_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`),
        updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`)
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index('exercise_set_workout_exercise_completed_type_idx').on(
            table.workoutExerciseId,
            table.completedAt,
            table.type,
        ),
    ],
);

export const exerciseSetRelations = relations(exerciseSet, ({ one }) => ({
    workoutExercise: one(workoutExercise, {
        fields: [exerciseSet.workoutExerciseId],
        references: [workoutExercise.id],
    }),
}));
