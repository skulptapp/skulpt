import { describe, expect, test } from '@jest/globals';
import { buildExerciseSetRestUpdate } from './updates';

describe('buildExerciseSetRestUpdate', () => {
    test('keeps an active rest pending when its duration changes', () => {
        const update = buildExerciseSetRestUpdate(
            {
                completedAt: new Date('2026-05-28T10:00:00.000Z'),
                restCompletedAt: null,
                finalRestTime: null,
            },
            120,
            { isCurrentActiveRest: true },
        );

        expect(update).toEqual({
            restTime: 120,
            restCompletedAt: null,
            finalRestTime: null,
        });
    });

    test('does not reopen a completed non-active rest when its duration changes', () => {
        const update = buildExerciseSetRestUpdate(
            {
                completedAt: new Date('2026-05-28T10:00:00.000Z'),
                restCompletedAt: null,
                finalRestTime: null,
            },
            120,
        );

        expect(update).toEqual({
            restTime: 120,
            restCompletedAt: null,
            finalRestTime: 120,
        });
    });

    test('does not overwrite final rest duration for already finalized rests', () => {
        const update = buildExerciseSetRestUpdate(
            {
                completedAt: new Date('2026-05-28T10:00:00.000Z'),
                restCompletedAt: new Date('2026-05-28T10:01:00.000Z'),
                finalRestTime: 60,
            },
            90,
        );

        expect(update).toEqual({
            restTime: 90,
        });
    });

    test('backfills final rest duration when finalized rest has no final value', () => {
        const update = buildExerciseSetRestUpdate(
            {
                completedAt: new Date('2026-05-28T10:00:00.000Z'),
                restCompletedAt: new Date('2026-05-28T10:01:00.000Z'),
                finalRestTime: null,
            },
            90,
        );

        expect(update).toEqual({
            restTime: 90,
            finalRestTime: 90,
        });
    });

    test('only changes rest time for sets that are not completed yet', () => {
        const update = buildExerciseSetRestUpdate(
            {
                completedAt: null,
                restCompletedAt: null,
                finalRestTime: null,
            },
            75,
        );

        expect(update).toEqual({
            restTime: 75,
        });
    });
});
