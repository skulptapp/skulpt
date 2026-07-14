import { describe, expect, jest, test } from '@jest/globals';
import {
    BuildTimerChainParams,
    buildTimerChainEvents,
    TIMER_WARNING_SECONDS,
} from './workout-notification-chain';

jest.mock('@/helpers/times', () => ({
    toMs: (value: Date | number | null | undefined) => {
        if (value == null) return null;
        return value instanceof Date ? value.getTime() : value;
    },
}));

describe('buildTimerChainEvents', () => {
    test('schedules work and rest alerts before their timers end', () => {
        const startedAtMs = 100_000;
        const workDurationSeconds = 20;
        const restDurationSeconds = 10;
        const set = {
            id: 'set-1',
            workoutExerciseId: 'workout-exercise-1',
            order: 0,
            type: 'working',
            time: workDurationSeconds,
            restTime: restDurationSeconds,
            startedAt: new Date(startedAtMs),
            completedAt: null,
        };
        const orderedExercises = [
            {
                id: 'workout-exercise-1',
                createdAt: new Date(0),
                sets: [set],
            },
        ] as unknown as BuildTimerChainParams['orderedExercises'];
        const details = {
            workout: { id: 'workout-1' },
            exercises: [
                {
                    workoutExercise: { id: 'workout-exercise-1' },
                    exercise: { name: 'Plank', timeOptions: 'timer' },
                    sets: [set],
                },
            ],
            groups: [],
        } as unknown as NonNullable<BuildTimerChainParams['details']>;

        const events = buildTimerChainEvents({
            nowMs: startedAtMs + 1000,
            workoutId: 'workout-1',
            details,
            orderedExercises,
            maxEvents: 10,
        });
        const warningLeadMs = TIMER_WARNING_SECONDS * 1000;
        const workEndMs = startedAtMs + workDurationSeconds * 1000;
        const restEndMs = workEndMs + restDurationSeconds * 1000;

        expect(events).toEqual([
            {
                kind: 'work-timer',
                setId: 'set-1',
                workoutExerciseId: 'workout-exercise-1',
                fireAtMs: workEndMs - warningLeadMs,
            },
            {
                kind: 'rest-timer',
                fromSetId: 'set-1',
                fireAtMs: restEndMs - warningLeadMs,
                nextSetId: null,
                nextWorkoutExerciseId: null,
            },
        ]);
    });

    test('does not schedule an alert before a short timer starts', () => {
        const startedAtMs = 100_000;
        const set = {
            id: 'set-1',
            workoutExerciseId: 'workout-exercise-1',
            order: 0,
            type: 'working',
            time: 10,
            restTime: 3,
            startedAt: new Date(startedAtMs),
            completedAt: null,
        };
        const orderedExercises = [
            {
                id: 'workout-exercise-1',
                createdAt: new Date(0),
                sets: [set],
            },
        ] as unknown as BuildTimerChainParams['orderedExercises'];
        const details = {
            workout: { id: 'workout-1' },
            exercises: [
                {
                    workoutExercise: { id: 'workout-exercise-1' },
                    exercise: { name: 'Plank', timeOptions: 'timer' },
                    sets: [set],
                },
            ],
            groups: [],
        } as unknown as NonNullable<BuildTimerChainParams['details']>;

        const events = buildTimerChainEvents({
            nowMs: startedAtMs + 1000,
            workoutId: 'workout-1',
            details,
            orderedExercises,
            maxEvents: 10,
        });
        const workEndMs = startedAtMs + 10_000;

        expect(events.find((event) => event.kind === 'rest-timer')?.fireAtMs).toBe(workEndMs);
    });
});
