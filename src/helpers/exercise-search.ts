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

type SearchRank = {
    score: number;
    order: number;
};

export type ExerciseSearchIndex = {
    documents: ExerciseSearchDocument[];
    fuse: Fuse<ExerciseSearchDocument>;
};

const exerciseSearchOptions: IFuseOptions<ExerciseSearchDocument> = {
    keys: ['name'],
    useTokenSearch: true,
    tokenMatch: 'all',
    threshold: 0.35,
    ignoreDiacritics: true,
    ignoreLocation: true,
    shouldSort: true,
};

const normalizeSearchText = (value: string) =>
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase();

const containsHanCharacters = (value: string) => {
    for (const character of value) {
        const codePoint = character.codePointAt(0);
        if (codePoint === undefined) continue;

        if (
            (codePoint >= 0x3400 && codePoint <= 0x4dbf) ||
            (codePoint >= 0x4e00 && codePoint <= 0x9fff) ||
            (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
            (codePoint >= 0x20000 && codePoint <= 0x2fa1f) ||
            (codePoint >= 0x30000 && codePoint <= 0x323af)
        ) {
            return true;
        }
    }

    return false;
};

const isChineseLocale = (locale?: string) => {
    if (!locale) return false;
    return locale.toLowerCase().split(/[-_]/, 1)[0] === 'zh';
};

const tokenizeSearchText = (value: string): string[] => {
    return normalizeSearchText(value).match(/[\p{L}\p{N}]+/gu) ?? [];
};

const levenshteinDistance = (a: string, b: string): number => {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    const current = Array.from({ length: b.length + 1 }, () => 0);

    for (let i = 1; i <= a.length; i += 1) {
        current[0] = i;
        for (let j = 1; j <= b.length; j += 1) {
            const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
            current[j] = Math.min(
                previous[j] + 1,
                current[j - 1] + 1,
                previous[j - 1] + substitutionCost,
            );
        }

        for (let j = 0; j <= b.length; j += 1) {
            previous[j] = current[j];
        }
    }

    return previous[b.length];
};

const getTokenScore = (queryToken: string, nameToken: string): number | null => {
    if (queryToken === nameToken) return 0;

    if (nameToken.startsWith(queryToken)) return 0.08;
    if (queryToken.length >= 4 && nameToken.includes(queryToken)) return 0.16;
    if (nameToken.length >= 4 && queryToken.includes(nameToken)) return 0.22;

    if (queryToken.length <= 3 || nameToken.length <= 3) {
        return null;
    }

    const distance = levenshteinDistance(queryToken, nameToken);
    const normalizedDistance = distance / Math.max(queryToken.length, nameToken.length);
    const maxDistance = queryToken.length <= 4 ? 0.25 : 0.34;

    if (normalizedDistance > maxDistance) return null;

    return 0.25 + normalizedDistance * 0.75;
};

const getBestTokenMatch = (queryToken: string, nameTokens: string[]) => {
    let bestScore: number | null = null;
    let bestIndex = -1;

    for (let index = 0; index < nameTokens.length; index += 1) {
        const score = getTokenScore(queryToken, nameTokens[index]);
        if (score === null) continue;
        if (bestScore === null || score < bestScore) {
            bestScore = score;
            bestIndex = index;
        }
    }

    return bestScore === null ? null : { score: bestScore, index: bestIndex };
};

const getSearchRank = (
    query: string,
    document: ExerciseSearchDocument,
    fallbackOrder: number,
): SearchRank | null => {
    const queryTokens = tokenizeSearchText(query);
    if (queryTokens.length === 0) return null;

    const name = normalizeSearchText(document.name);
    const nameTokens = tokenizeSearchText(document.name);
    if (nameTokens.length === 0) return null;

    let tokenScoreSum = 0;
    const tokenIndexes: number[] = [];

    for (const queryToken of queryTokens) {
        const match = getBestTokenMatch(queryToken, nameTokens);
        if (!match) return null;

        tokenScoreSum += match.score;
        tokenIndexes.push(match.index);
    }

    const averageTokenScore = tokenScoreSum / queryTokens.length;
    const normalizedQuery = normalizeSearchText(query);
    const exactPhraseIndex = name.indexOf(normalizedQuery);
    const ordered =
        tokenIndexes.length <= 1 ||
        tokenIndexes.every(
            (index, tokenIndex) => tokenIndex === 0 || index >= tokenIndexes[tokenIndex - 1],
        );
    const firstIndex = Math.min(...tokenIndexes);
    const lastIndex = Math.max(...tokenIndexes);
    const gap = tokenIndexes.length > 1 ? lastIndex - firstIndex - (tokenIndexes.length - 1) : 0;
    const orderPenalty = ordered ? Math.min(0.18, gap * 0.04) : 0.22;
    const phraseBonus =
        exactPhraseIndex === 0
            ? -0.24
            : exactPhraseIndex > 0
              ? -0.16
              : nameTokens[0] === queryTokens[0]
                ? -0.06
                : 0;

    return {
        score: Math.max(0, averageTokenScore + orderPenalty + phraseBonus),
        order: fallbackOrder,
    };
};

const createSearchRanks = (
    searchIndex: ExerciseSearchIndex | null,
    query: string,
    locale?: string,
): Map<string, SearchRank> => {
    if (!searchIndex) return new Map();

    const fuseResults = searchIndex.fuse.search(query);
    if (isChineseLocale(locale) || containsHanCharacters(query)) {
        const normalizedQuery = normalizeSearchText(query);
        const fuseOrder = new Map(
            fuseResults.map((result, index) => [result.item.id, index] as const),
        );
        const ranks = new Map<string, SearchRank>();

        searchIndex.documents.forEach((document, index) => {
            const phraseIndex = normalizeSearchText(document.name).indexOf(normalizedQuery);
            if (phraseIndex < 0) return;

            ranks.set(document.id, {
                score: phraseIndex === 0 ? 0 : 0.1,
                order: fuseOrder.get(document.id) ?? index,
            });
        });

        fuseResults.forEach((result, index) => {
            if (!ranks.has(result.item.id)) {
                ranks.set(result.item.id, { score: 1, order: index });
            }
        });

        return ranks;
    }

    const fuseOrder = new Map<string, number>();
    fuseResults.forEach((result, index) => {
        fuseOrder.set(result.item.id, index);
    });

    const ranks = new Map<string, SearchRank>();
    searchIndex.documents.forEach((document, index) => {
        const rank = getSearchRank(query, document, fuseOrder.get(document.id) ?? index);
        if (rank) {
            ranks.set(document.id, rank);
        }
    });

    return ranks;
};

const compareSearchRanks = (a: SearchRank, b: SearchRank) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.order - b.order;
};

const getBestSearchRank = (current: SearchRank | null, next: SearchRank): SearchRank => {
    if (!current) return next;
    return compareSearchRanks(next, current) < 0 ? next : current;
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

    return {
        documents,
        fuse: new Fuse(documents, exerciseSearchOptions),
    };
};

export const filterGroupedExercisesByName = (
    items: ExerciseListItem[],
    query: string,
    searchIndex = createExerciseSearchIndex(items),
    locale?: string,
): ExerciseListItem[] => {
    const q = query.trim();
    if (!q) return items;

    const searchRanks = createSearchRanks(searchIndex, q, locale);

    type RankedExercise = {
        item: ExerciseCard;
        rank: SearchRank;
    };

    type RankedMuscleGroup = {
        header: ExerciseMuscleGroup;
        exercises: RankedExercise[];
        bestRank: SearchRank | null;
    };

    type RankedCategory = {
        header: ExerciseCategory;
        muscleGroups: RankedMuscleGroup[];
        bestRank: SearchRank | null;
    };

    const categories: RankedCategory[] = [];
    let currentCategory: RankedCategory | null = null;
    let currentMuscleGroup: RankedMuscleGroup | null = null;

    for (const item of items) {
        if (item.type === 'category') {
            currentCategory = {
                header: { ...item, count: 0 },
                muscleGroups: [],
                bestRank: null,
            };
            categories.push(currentCategory);
            currentMuscleGroup = null;
        } else if (item.type === 'muscle-group') {
            if (!currentCategory) {
                continue;
            }
            currentMuscleGroup = {
                header: { ...item, count: 0 },
                exercises: [],
                bestRank: null,
            };
            currentCategory.muscleGroups.push(currentMuscleGroup);
        } else if (item.type === 'exercise') {
            const searchRank = searchRanks.get(item.exercise.id);
            if (!searchRank || !currentCategory || !currentMuscleGroup) {
                continue;
            }

            currentMuscleGroup.exercises.push({ item, rank: searchRank });
            currentMuscleGroup.bestRank = getBestSearchRank(
                currentMuscleGroup.bestRank,
                searchRank,
            );
            currentCategory.bestRank = getBestSearchRank(currentCategory.bestRank, searchRank);
        }
    }

    const result: ExerciseListItem[] = [];

    categories
        .filter((category): category is RankedCategory & { bestRank: SearchRank } =>
            Boolean(category.bestRank),
        )
        .sort((a, b) => compareSearchRanks(a.bestRank, b.bestRank))
        .forEach((category) => {
            const muscleGroups = category.muscleGroups
                .filter(
                    (muscleGroup): muscleGroup is RankedMuscleGroup & { bestRank: SearchRank } =>
                        Boolean(muscleGroup.bestRank),
                )
                .sort((a, b) => compareSearchRanks(a.bestRank, b.bestRank));

            const categoryCount = muscleGroups.reduce(
                (total, muscleGroup) => total + muscleGroup.exercises.length,
                0,
            );

            result.push({ ...category.header, count: categoryCount });

            for (const muscleGroup of muscleGroups) {
                const exercises = muscleGroup.exercises.sort((a, b) =>
                    compareSearchRanks(a.rank, b.rank),
                );

                result.push({ ...muscleGroup.header, count: exercises.length });
                result.push(...exercises.map((exercise) => exercise.item));
            }
        });

    return result;
};
