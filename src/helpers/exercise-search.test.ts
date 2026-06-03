import { describe, expect, test } from '@jest/globals';

import type { ExerciseListSelect } from '@/crud/exercise';

import {
    createExerciseSearchIndex,
    filterGroupedExercisesByName,
    groupExercises,
    type ExerciseListItem,
} from './exercise-search';

const makeExercise = (
    id: string,
    name: string,
    primaryMuscleGroups: string[],
): ExerciseListSelect => ({
    id,
    name,
    category: 'strength',
    tracking: ['weight', 'reps'],
    primaryMuscleGroups,
    gifFilename: null,
    userId: 'skulpt',
    source: 'system',
});

const getExerciseNames = (items: ExerciseListItem[]) =>
    items
        .filter(
            (item): item is Extract<ExerciseListItem, { type: 'exercise' }> =>
                item.type === 'exercise',
        )
        .map((item) => item.exercise.name);

describe('exercise fuzzy search', () => {
    test('requires every word to match for cable row queries', () => {
        const grouped = groupExercises([
            makeExercise('front-raise', 'Cable Front Raise', ['front_deltoid']),
            makeExercise('shoulder-rotation', 'Cable Seated Shoulder Internal Rotation', [
                'rotator_cuff',
            ]),
            makeExercise('rear-delt-row', 'Cable Rear Delt Row (with Rope)', ['rear_deltoid']),
            makeExercise('seated-row', 'Cable Straight Back Seated Row', ['lats']),
        ]);

        const result = filterGroupedExercisesByName(
            grouped,
            'Cable row',
            createExerciseSearchIndex(grouped),
        );
        const names = getExerciseNames(result);

        expect(names).toEqual(
            expect.arrayContaining([
                'Cable Straight Back Seated Row',
                'Cable Rear Delt Row (with Rope)',
            ]),
        );
        expect(names).not.toContain('Cable Front Raise');
        expect(names).not.toContain('Cable Seated Shoulder Internal Rotation');
    });

    test('ranks typo-tolerant barbell press matches above dumbbell press matches', () => {
        const grouped = groupExercises([
            makeExercise('dumbbell-decline', 'Dumbbell One Arm Decline Chest Press', [
                'pectoralis_major',
            ]),
            makeExercise('dumbbell-incline', 'Dumbbell Incline Hammer Press', ['pectoralis_major']),
            makeExercise('barbell-bench', 'Barbell Bench Press', ['pectoralis_major']),
            makeExercise('barbell-incline', 'Barbell Incline Press', ['pectoralis_major']),
        ]);

        const result = filterGroupedExercisesByName(
            grouped,
            'Barbel press',
            createExerciseSearchIndex(grouped),
        );
        const names = getExerciseNames(result);

        expect(names).toEqual(['Barbell Bench Press', 'Barbell Incline Press']);
    });
});
