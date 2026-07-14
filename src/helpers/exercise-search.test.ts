import { describe, expect, jest, test } from '@jest/globals';

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

    test('uses Fuse matches for short Han substrings', () => {
        const grouped = groupExercises([
            makeExercise('barbell-bench', '杠铃卧推', ['pectoralis_major']),
            makeExercise('barbell-close-grip', '杠铃窄握卧推', ['pectoralis_major']),
            makeExercise('dumbbell-bench', '哑铃卧推', ['pectoralis_major']),
            makeExercise('barbell-deadlift', '杠铃硬拉', ['glutes']),
        ]);

        const result = filterGroupedExercisesByName(
            grouped,
            '卧推',
            createExerciseSearchIndex(grouped),
        );

        expect(getExerciseNames(result)).toEqual(['杠铃卧推', '杠铃窄握卧推', '哑铃卧推']);
    });

    test('keeps exact Han substrings when Fuse returns no results for a filtered list', () => {
        const grouped = groupExercises([
            makeExercise('band-straight-leg-deadlift', '弹力带直腿硬拉', ['hamstrings']),
            makeExercise('barbell-side-deadlift', '杠铃单臂侧向硬拉', ['glutes']),
            makeExercise('barbell-deadlift', '杠铃硬拉', ['glutes']),
            makeExercise('barbell-romanian-deadlift', '杠铃罗马尼亚硬拉', ['hamstrings']),
            makeExercise('barbell-rack-pull', '杠铃架上拉', ['glutes']),
            makeExercise('barbell-good-morning', '杠铃早安式体前屈', ['hamstrings']),
            makeExercise('barbell-single-leg-deadlift', '杠铃单腿硬拉', ['hamstrings']),
            makeExercise('barbell-straight-leg-deadlift', '杠铃直腿硬拉', ['hamstrings']),
        ]);
        const searchIndex = createExerciseSearchIndex(grouped)!;
        jest.spyOn(searchIndex.fuse, 'search').mockReturnValue([]);

        const result = filterGroupedExercisesByName(grouped, '硬拉', searchIndex);

        expect(getExerciseNames(result)).toEqual([
            '弹力带直腿硬拉',
            '杠铃单臂侧向硬拉',
            '杠铃硬拉',
            '杠铃罗马尼亚硬拉',
            '杠铃单腿硬拉',
            '杠铃直腿硬拉',
        ]);
    });

    test('uses Chinese search rules from locale before inspecting the query characters', () => {
        const grouped = groupExercises([
            makeExercise('barbell-rdl', '杠铃RDL', ['hamstrings']),
            makeExercise('barbell-deadlift', '杠铃硬拉', ['glutes']),
        ]);
        const searchIndex = createExerciseSearchIndex(grouped)!;
        jest.spyOn(searchIndex.fuse, 'search').mockReturnValue([]);

        const result = filterGroupedExercisesByName(grouped, 'RDL', searchIndex, 'zh-CN');

        expect(getExerciseNames(result)).toEqual(['杠铃RDL']);
    });
});
