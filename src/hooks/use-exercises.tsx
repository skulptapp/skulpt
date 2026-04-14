import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from './use-user';
import { useAnalytics } from './use-analytics';
import {
    getFilteredExercises,
    deleteExercise,
    mergeExercise,
    getExerciseById,
    getExerciseHistory,
    updateExercise,
    type ExerciseListSelect,
    type ExerciseHistoryItem,
    type ExerciseFilterParams,
} from '@/crud/exercise';
import { ExerciseSelect } from '@/db/schema';
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
    searchName: string;
}

export type ExerciseListItem = ExerciseCategory | ExerciseMuscleGroup | ExerciseCard;

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
                    searchName: exercise.name.toLowerCase(),
                });
            }
        }
    }

    return grouped;
};

export const useExercisesList = (filters?: ExerciseFilterParams) => {
    const { user } = useUser();

    return useQuery({
        queryKey: ['exercises-list', user?.id, filters],
        queryFn: () => getFilteredExercises(user!.id, filters),
        enabled: !!user?.id,
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });
};

export const filterGroupedExercisesByName = (
    items: ExerciseListItem[],
    query: string,
): ExerciseListItem[] => {
    const q = query.trim().toLowerCase();
    if (!q) return items;

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
            const matches = item.searchName.includes(q);
            if (matches) {
                // headers are expected to already exist in grouped list
                result.push(item);
                muscleCount += 1;
                categoryCount += 1;
            }
        }
    }

    flushCategory();
    return result;
};

export const useDeleteExercise = () => {
    const queryClient = useQueryClient();
    const { user } = useUser();
    const { track } = useAnalytics();

    return useMutation({
        mutationFn: (exerciseId: string) => deleteExercise(exerciseId, user!.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exercises-list'] });
            queryClient.invalidateQueries({ queryKey: ['workout-details'] });
            queryClient.invalidateQueries({ queryKey: ['exercise-sets'] });
            queryClient.invalidateQueries({ queryKey: ['workout-exercises'] });
            queryClient.invalidateQueries({ queryKey: ['workout-exercises-with-exercise'] });
            queryClient.invalidateQueries({ queryKey: ['workout-groups'] });
            queryClient.invalidateQueries({ queryKey: ['workouts-overview-meta'] });
            queryClient.invalidateQueries({ queryKey: ['exercise-history'] });
            track('exercise:delete');
        },
    });
};

export const useExercise = (exerciseId: string) => {
    const { user } = useUser();

    return useQuery({
        queryKey: ['exercise', exerciseId, user?.id],
        queryFn: () => getExerciseById(exerciseId, user!.id),
        enabled: !!user?.id && !!exerciseId,
    });
};

export const useExerciseHistory = (exerciseId: string) => {
    const { user } = useUser();

    return useQuery<ExerciseHistoryItem[]>({
        queryKey: ['exercise-history', exerciseId, user?.id],
        queryFn: () => getExerciseHistory(exerciseId, user!.id),
        enabled: !!user?.id && !!exerciseId,
    });
};

export const useMergeExercise = () => {
    const queryClient = useQueryClient();
    const { user } = useUser();

    return useMutation({
        mutationFn: ({ sourceId, targetId }: { sourceId: string; targetId: string }) =>
            mergeExercise(sourceId, targetId, user!.id),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['exercises-list'] });
            queryClient.invalidateQueries({ queryKey: ['exercise'] });
            queryClient.invalidateQueries({ queryKey: ['exercise-history'] });
            queryClient.invalidateQueries({ queryKey: ['workout-details'] });
            queryClient.invalidateQueries({ queryKey: ['workout-exercises'] });
            queryClient.invalidateQueries({ queryKey: ['workout-exercises-with-exercise'] });
            queryClient.invalidateQueries({ queryKey: ['workouts-overview-meta'] });
        },
    });
};

export const useUpdateExercise = () => {
    const queryClient = useQueryClient();
    const { user } = useUser();

    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<ExerciseSelect> }) =>
            updateExercise(id, user!.id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exercises-list'] });
            queryClient.invalidateQueries({ queryKey: ['exercise'] });
            queryClient.invalidateQueries({ queryKey: ['exercise-history'] });
            queryClient.invalidateQueries({ queryKey: ['workout-details'] });
            queryClient.invalidateQueries({ queryKey: ['workout-exercises'] });
            queryClient.invalidateQueries({ queryKey: ['workout-exercises-with-exercise'] });
        },
    });
};
