import Fuse, { type IFuseOptions } from 'fuse.js';

import type { ExerciseListSelect } from '@/crud/exercise';
import { getPrimaryAnchorMuscleValue } from '@/constants/muscles';

export interface ExerciseCategory {
    type: 'category';
    name: string;
    count: number;
}

export interface ExerciseMuscleGroup {
    type: 'muscle-group';
    name: string;
    category: string;
    count: number;
}

export interface ExerciseCard {
    type: 'exercise';
    exercise: ExerciseListSelect;
}

export type ExerciseListItem = ExerciseCategory | ExerciseMuscleGroup | ExerciseCard;

type ExerciseSearchDocument = {
    id: string;
    name: string;
};

export type ExerciseSearchIndex = Fuse<ExerciseSearchDocument>;

const exerciseSearchOptions: IFuseOptions<ExerciseSearchDocument> = {
    keys: ['name'],
    useTokenSearch: true,
    tokenMatch: 'all',
    threshold: 0.35,
    ignoreDiacritics: true,
    ignoreLocation: true,
    shouldSort: false,
};

export const groupExercises = (exercises: ExerciseListSelect[]): ExerciseListItem[] => {
    const grouped: ExerciseListItem[] = [];

    const categories = new Map<
        string,
        {
            count: number;
            muscleGroups: Map<string, ExerciseListSelect[]>;
        }
    >();

    for (const exercise of exercises) {
        let categoryBucket = categories.get(exercise.category);
        if (!categoryBucket) {
            categoryBucket = {
                count: 0,
                muscleGroups: new Map<string, ExerciseListSelect[]>(),
            };
            categories.set(exercise.category, categoryBucket);
        }

        categoryBucket.count += 1;

        const muscleGroup = getPrimaryAnchorMuscleValue(exercise.primaryMuscleGroups) || 'other';
        const muscleBucket = categoryBucket.muscleGroups.get(muscleGroup);
        if (muscleBucket) {
            muscleBucket.push(exercise);
            continue;
        }
        categoryBucket.muscleGroups.set(muscleGroup, [exercise]);
    }

    for (const [category, categoryBucket] of categories) {
        grouped.push({
            type: 'category',
            name: category,
            count: categoryBucket.count,
        });

        for (const [muscleGroup, muscleGroupExercises] of categoryBucket.muscleGroups) {
            grouped.push({
                type: 'muscle-group',
                name: muscleGroup,
                category,
                count: muscleGroupExercises.length,
            });

            for (const exercise of muscleGroupExercises) {
                grouped.push({
                    type: 'exercise',
                    exercise,
                });
            }
        }
    }

    return grouped;
};

export const createExerciseSearchIndex = (
    items: ExerciseListItem[],
): ExerciseSearchIndex | null => {
    const documents = items.reduce<ExerciseSearchDocument[]>((acc, item) => {
        if (item.type === 'exercise') {
            acc.push({
                id: item.exercise.id,
                name: item.exercise.name,
            });
        }
        return acc;
    }, []);

    if (documents.length === 0) return null;

    return new Fuse(documents, exerciseSearchOptions);
};

const getMatchingExerciseIds = (
    searchIndex: ExerciseSearchIndex | null,
    query: string,
): Set<string> => {
    if (!searchIndex) return new Set();

    return new Set(searchIndex.search(query).map((result) => result.item.id));
};

export const filterGroupedExercisesByName = (
    items: ExerciseListItem[],
    query: string,
    searchIndex = createExerciseSearchIndex(items),
): ExerciseListItem[] => {
    const q = query.trim();
    if (!q) return items;

    const matchingExerciseIds = getMatchingExerciseIds(searchIndex, q);
    const result: ExerciseListItem[] = [];
    let currentCategory: string | null = null;
    let currentMuscleGroup: string | null = null;
    let categoryCount = 0;
    let muscleCount = 0;
    let categoryHeaderIndex = -1;
    let muscleHeaderIndex = -1;

    const flushMuscleGroup = () => {
        if (currentMuscleGroup && muscleHeaderIndex >= 0) {
            if (muscleCount > 0) {
                (result[muscleHeaderIndex] as ExerciseMuscleGroup).count = muscleCount;
            } else {
                result.splice(muscleHeaderIndex, 1);
                if (categoryHeaderIndex > muscleHeaderIndex) {
                    categoryHeaderIndex -= 1;
                }
            }
        }
        muscleCount = 0;
        currentMuscleGroup = null;
        muscleHeaderIndex = -1;
    };

    const flushCategory = () => {
        flushMuscleGroup();
        if (currentCategory && categoryHeaderIndex >= 0) {
            if (categoryCount > 0) {
                (result[categoryHeaderIndex] as ExerciseCategory).count = categoryCount;
            } else {
                result.splice(categoryHeaderIndex, 1);
            }
        }
        categoryCount = 0;
        currentCategory = null;
        categoryHeaderIndex = -1;
    };

    for (const item of items) {
        if (item.type === 'category') {
            if (currentCategory && item.name !== currentCategory) {
                flushCategory();
            }
            currentCategory = item.name;
            categoryHeaderIndex = result.length;
            result.push({ ...item, count: 0 });
        } else if (item.type === 'muscle-group') {
            if (currentMuscleGroup && item.name !== currentMuscleGroup) {
                flushMuscleGroup();
            }
            currentMuscleGroup = item.name;
            muscleHeaderIndex = result.length;
            result.push({ ...item, count: 0 });
        } else if (item.type === 'exercise') {
            const matches = matchingExerciseIds.has(item.exercise.id);
            if (matches) {
                result.push(item);
                muscleCount += 1;
                categoryCount += 1;
            }
        }
    }

    flushCategory();
    return result;
};
