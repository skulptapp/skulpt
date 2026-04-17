import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import {
    WorkoutSelect,
    WorkoutInsert,
    WorkoutExerciseInsert,
    WorkoutExerciseSelect,
    ExerciseSetInsert,
    ExerciseSetSelect,
    WorkoutGroupInsert,
    WorkoutGroupSelect,
} from '@/db/schema';
import {
    getWorkouts,
    getWorkoutById,
    getWorkoutWithExercisesAndSets,
    getWorkoutGroups,
    createWorkout,
    updateWorkout,
    deleteWorkout,
    startWorkout,
    completeWorkout,
    duplicateWorkout,
    createWorkoutExercise,
    updateWorkoutExercise,
    deleteWorkoutExercise,
    getWorkoutExercises,
    getWorkoutExercisesWithExercise,
    WorkoutExerciseWithExercise,
    createWorkoutGroup,
    updateWorkoutGroup,
    deleteWorkoutGroup,
    fetchWorkoutStats,
    fetchWorkoutDaySummary,
    fetchWorkoutDayHealthStats,
    fetchStrengthRadarStats,
    WorkoutStats,
    WorkoutDaySummary,
    StrengthRadarStats,
} from '@/crud/workout';
import { useUser } from './use-user';
import { useAnalytics } from './use-analytics';
import {
    createExerciseSet,
    deleteExerciseSet,
    getExerciseSets,
    updateExerciseSet,
} from '@/crud/exercise';
import { getPrimaryAnchorMuscleValue } from '@/constants/muscles';
import { getWorkoutOverviewExerciseMetaRows } from '@/crud/workout/home';
import { waitForIdle } from '@/helpers/idle';

export const useWorkouts = () => {
    const { user } = useUser();

    return useQuery({
        queryKey: ['workouts', user?.id],
        queryFn: () => getWorkouts(),
        enabled: !!user?.id,
    });
};

export interface WorkoutOverviewMeta {
    sortedWorkoutTypes: string[];
    sortedPrimaryMuscleGroups: string[];
}

export type WorkoutOverviewMetaMap = Record<string, WorkoutOverviewMeta>;

const getSortedKeysByCount = (counts: Map<string, number>) =>
    Array.from(counts.entries())
        .sort(([, a], [, b]) => b - a)
        .map(([key]) => key);

export const useWorkoutsOverviewMeta = (workoutIds: string[]) => {
    const { user } = useUser();
    const uniqueWorkoutIds = Array.from(new Set(workoutIds));

    return useQuery<WorkoutOverviewMetaMap>({
        queryKey: ['workouts-overview-meta', user?.id, uniqueWorkoutIds],
        queryFn: async () => {
            if (uniqueWorkoutIds.length === 0) {
                return {};
            }

            const rows = await getWorkoutOverviewExerciseMetaRows(uniqueWorkoutIds);

            const categoryCountsByWorkoutId = new Map<string, Map<string, number>>();
            const primaryMuscleCountsByWorkoutId = new Map<string, Map<string, number>>();

            for (const workoutId of uniqueWorkoutIds) {
                categoryCountsByWorkoutId.set(workoutId, new Map());
                primaryMuscleCountsByWorkoutId.set(workoutId, new Map());
            }

            for (const row of rows) {
                const categoryCounts = categoryCountsByWorkoutId.get(row.workoutId);
                if (categoryCounts) {
                    categoryCounts.set(row.category, (categoryCounts.get(row.category) || 0) + 1);
                }

                const primaryMuscle = getPrimaryAnchorMuscleValue(row.primaryMuscleGroups);
                if (primaryMuscle) {
                    const primaryMuscleCounts = primaryMuscleCountsByWorkoutId.get(row.workoutId);
                    if (primaryMuscleCounts) {
                        primaryMuscleCounts.set(
                            primaryMuscle,
                            (primaryMuscleCounts.get(primaryMuscle) || 0) + 1,
                        );
                    }
                }
            }

            return uniqueWorkoutIds.reduce<WorkoutOverviewMetaMap>((acc, workoutId) => {
                acc[workoutId] = {
                    sortedWorkoutTypes: getSortedKeysByCount(
                        categoryCountsByWorkoutId.get(workoutId) || new Map(),
                    ),
                    sortedPrimaryMuscleGroups: getSortedKeysByCount(
                        primaryMuscleCountsByWorkoutId.get(workoutId) || new Map(),
                    ),
                };
                return acc;
            }, {});
        },
        enabled: !!user?.id && uniqueWorkoutIds.length > 0,
        staleTime: 60_000 * 5,
        gcTime: 60_000 * 10,
    });
};

export const useWorkout = (workoutId: string) => {
    return useQuery({
        queryKey: ['workout', workoutId],
        queryFn: () => getWorkoutById(workoutId),
        enabled: !!workoutId,
    });
};

export const useWorkoutWithDetails = (workoutId: string) => {
    return useQuery({
        queryKey: ['workout-details', workoutId],
        queryFn: () => getWorkoutWithExercisesAndSets(workoutId),
        enabled: !!workoutId,
    });
};

export const useWorkoutGroups = (workoutId: string) => {
    return useQuery({
        queryKey: ['workout-groups', workoutId],
        queryFn: () => getWorkoutGroups(workoutId),
        enabled: !!workoutId,
    });
};

export const useCreateWorkout = () => {
    const queryClient = useQueryClient();
    const { user } = useUser();

    return useMutation({
        mutationFn: (data: Omit<WorkoutInsert, 'id' | 'userId'>) =>
            createWorkout({ ...data, userId: user!.id }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workouts'] });
            queryClient.invalidateQueries({ queryKey: ['active-workout'] });
        },
    });
};

export const useUpdateWorkout = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<WorkoutSelect> }) =>
            updateWorkout(id, updates),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['workouts'] });
            queryClient.invalidateQueries({ queryKey: ['workout', data.id] });
            queryClient.invalidateQueries({ queryKey: ['workout-details', data.id] });
            queryClient.invalidateQueries({ queryKey: ['active-workout'] });
        },
    });
};

export const useDeleteWorkout = () => {
    const queryClient = useQueryClient();
    const { track } = useAnalytics();

    return useMutation({
        mutationFn: (workoutId: string) => deleteWorkout(workoutId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workouts'] });
            queryClient.invalidateQueries({ queryKey: ['workouts-overview-meta'] });
            queryClient.invalidateQueries({ queryKey: ['workout-details'] });
            queryClient.invalidateQueries({ queryKey: ['workout-exercises'] });
            queryClient.invalidateQueries({ queryKey: ['workout-exercises-with-exercise'] });
            queryClient.invalidateQueries({ queryKey: ['workout-groups'] });
            queryClient.invalidateQueries({ queryKey: ['exercise-sets'] });
            queryClient.invalidateQueries({ queryKey: ['active-workout'] });
            track('workout:delete');
            // Cancel any stale scheduled timer notifications that may have been left
            // from this workout. Notification identifiers are tied to setIds which are
            // no longer accessible after deletion, so cancel all scheduled notifications.
            // This is safe because workout timers are the only scheduled notifications.
            Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
        },
    });
};

export const useStartWorkout = () => {
    const queryClient = useQueryClient();
    const { track } = useAnalytics();

    return useMutation({
        mutationFn: (workoutId: string) => startWorkout(workoutId),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['workouts'] });
            queryClient.invalidateQueries({ queryKey: ['workout', data.id] });
            queryClient.invalidateQueries({ queryKey: ['workout-details', data.id] });
            queryClient.invalidateQueries({ queryKey: ['exercise-sets'] });
            queryClient.invalidateQueries({ queryKey: ['active-workout'] });
            track('workout:start', {
                workoutId: data.id,
            });
        },
    });
};

export const useCompleteWorkout = () => {
    const queryClient = useQueryClient();
    const { track } = useAnalytics();

    return useMutation({
        mutationFn: (workoutId: string) => completeWorkout(workoutId),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['workouts'] });
            queryClient.invalidateQueries({ queryKey: ['workout', data.id] });
            queryClient.invalidateQueries({ queryKey: ['workout-details', data.id] });
            queryClient.invalidateQueries({ queryKey: ['exercise-sets'] });
            queryClient.invalidateQueries({ queryKey: ['active-workout'] });
            queryClient.invalidateQueries({ queryKey: ['workout-stats'] });
            track('workout:complete', {
                workoutId: data.id,
                duration: data.duration,
            });
        },
    });
};

export const useWorkoutExercises = (workoutId: string) => {
    return useQuery({
        queryKey: ['workout-exercises', workoutId],
        queryFn: () => getWorkoutExercises(workoutId),
        enabled: !!workoutId,
    });
};

export const useWorkoutExercisesWithExercise = (workoutId: string) => {
    return useQuery<WorkoutExerciseWithExercise[]>({
        queryKey: ['workout-exercises-with-exercise', workoutId],
        queryFn: () => getWorkoutExercisesWithExercise(workoutId),
        enabled: !!workoutId,
    });
};

export const useCreateWorkoutExercise = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Omit<WorkoutExerciseInsert, 'id'>) => createWorkoutExercise(data),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['workout-exercises', data.workoutId] });
            queryClient.invalidateQueries({
                queryKey: ['workout-exercises-with-exercise', data.workoutId],
            });
            queryClient.invalidateQueries({ queryKey: ['workouts-overview-meta'] });
            queryClient.invalidateQueries({ queryKey: ['workout-details', data.workoutId] });
        },
    });
};

export const useCreateWorkoutGroup = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Omit<WorkoutGroupInsert, 'id'>) => createWorkoutGroup(data),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['workout-groups', data.workoutId] });
            queryClient.invalidateQueries({ queryKey: ['workout-details', data.workoutId] });
        },
    });
};

export const useUpdateWorkoutGroup = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<WorkoutGroupSelect> }) =>
            updateWorkoutGroup(id, updates),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['workout-groups', data.workoutId] });
            queryClient.invalidateQueries({ queryKey: ['workout-details', data.workoutId] });
        },
    });
};

export const useDeleteWorkoutGroup = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id }: { id: string; workoutId: string }) => deleteWorkoutGroup(id),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['workout-groups', variables.workoutId] });
            queryClient.invalidateQueries({ queryKey: ['workout-details', variables.workoutId] });
            queryClient.invalidateQueries({ queryKey: ['workout-exercises', variables.workoutId] });
            queryClient.invalidateQueries({
                queryKey: ['workout-exercises-with-exercise', variables.workoutId],
            });
            queryClient.invalidateQueries({ queryKey: ['workouts-overview-meta'] });
            queryClient.invalidateQueries({ queryKey: ['exercise-sets'] });
        },
    });
};

export const useUpdateWorkoutExercise = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<WorkoutExerciseSelect> }) =>
            updateWorkoutExercise(id, updates),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['workout-exercises', data.workoutId] });
            queryClient.invalidateQueries({
                queryKey: ['workout-exercises-with-exercise', data.workoutId],
            });
            queryClient.invalidateQueries({ queryKey: ['workouts-overview-meta'] });
            queryClient.invalidateQueries({ queryKey: ['workout-details', data.workoutId] });
        },
    });
};

export const useDeleteWorkoutExercise = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id }: { id: string; workoutId: string }) => deleteWorkoutExercise(id),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['workout-exercises', variables.workoutId] });
            queryClient.invalidateQueries({
                queryKey: ['workout-exercises-with-exercise', variables.workoutId],
            });
            queryClient.invalidateQueries({ queryKey: ['workouts-overview-meta'] });
            queryClient.invalidateQueries({ queryKey: ['workout-details', variables.workoutId] });
            queryClient.invalidateQueries({ queryKey: ['exercise-sets'] });
            queryClient.invalidateQueries({ queryKey: ['workout-groups', variables.workoutId] });
        },
    });
};

export const useExerciseSets = (workoutExerciseId: string) => {
    return useQuery({
        queryKey: ['exercise-sets', workoutExerciseId],
        queryFn: () => getExerciseSets(workoutExerciseId),
        enabled: !!workoutExerciseId,
    });
};

export const useCreateExerciseSet = () => {
    const queryClient = useQueryClient();
    const { track } = useAnalytics();

    return useMutation({
        mutationFn: (data: Omit<ExerciseSetInsert, 'id'>) => createExerciseSet(data),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['exercise-sets', data.workoutExerciseId] });
            queryClient.invalidateQueries({ queryKey: ['workout-details'] });
            track('workout:exercise_set_add', {
                workoutExerciseId: data.workoutExerciseId,
                setType: data.type,
            });
        },
    });
};

export const useUpdateExerciseSet = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<ExerciseSetSelect> }) =>
            updateExerciseSet(id, updates),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['exercise-sets', data.workoutExerciseId] });
            queryClient.invalidateQueries({ queryKey: ['workout-details'] });
        },
    });
};

export const useDeleteExerciseSet = () => {
    const queryClient = useQueryClient();
    const { track } = useAnalytics();

    return useMutation({
        mutationFn: ({ id }: { id: string; workoutExerciseId: string }) => deleteExerciseSet(id),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ['exercise-sets', variables.workoutExerciseId],
            });
            queryClient.invalidateQueries({ queryKey: ['workout-details'] });
            track('workout:exercise_set_remove', {
                workoutExerciseId: variables.workoutExerciseId,
            });
        },
    });
};

export const useActiveWorkout = () => {
    const { user } = useUser();

    return useQuery({
        queryKey: ['active-workout', user?.id],
        queryFn: async () => {
            const workouts = await getWorkouts();
            return workouts.find((w) => w.status === 'in_progress') || null;
        },
        enabled: !!user?.id,
    });
};

export const useDuplicateWorkout = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            workoutId,
            mode,
        }: {
            workoutId: string;
            mode: 'now' | 'planned' | 'completed';
        }) => duplicateWorkout(workoutId, mode),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workouts'] });
            queryClient.invalidateQueries({ queryKey: ['workout'] });
            queryClient.invalidateQueries({ queryKey: ['workout-details'] });
            queryClient.invalidateQueries({ queryKey: ['active-workout'] });
            queryClient.invalidateQueries({ queryKey: ['workouts-overview-meta'] });
        },
    });
};

const defaultStats: WorkoutStats = {
    trainingWeeks: null,
    trainingDays: null,
    trainingHours: null,
    workoutsCount: null,
    volume: null,
    exercisesCount: null,
    setsCount: null,
    repsCount: null,
};

const defaultStrengthRadarStats: StrengthRadarStats = {
    periodDays: 30,
    totalVolume: {
        chest: 0,
        back: 0,
        legs: 0,
        shoulders: 0,
        core: 0,
        arms: 0,
        neck: 0,
    },
    workoutFrequency: {
        chest: 0,
        back: 0,
        legs: 0,
        shoulders: 0,
        core: 0,
        arms: 0,
        neck: 0,
    },
    muscularLoad: {
        chest: 0,
        back: 0,
        legs: 0,
        shoulders: 0,
        core: 0,
        arms: 0,
        neck: 0,
    },
};

export const useWorkoutStats = (): WorkoutStats => {
    const { user } = useUser();

    const { data: stats = defaultStats } = useQuery({
        queryKey: ['workout-stats', user?.id, user?.weightUnits],
        queryFn: () => fetchWorkoutStats(user!.weightUnits || 'kg'),
        enabled: !!user?.id,
        placeholderData: defaultStats,
        staleTime: 60000 * 10, // Cache for 10 minutes to avoid refetching on every navigation
    });

    return stats;
};

export const useStrengthRadarStats = (): StrengthRadarStats => {
    const { user } = useUser();

    const { data: stats = defaultStrengthRadarStats } = useQuery({
        queryKey: ['workout-stats', 'strength-radar', user?.id, user?.weightUnits],
        queryFn: () => fetchStrengthRadarStats(user!.weightUnits || 'kg', 30),
        enabled: !!user?.id,
        placeholderData: defaultStrengthRadarStats,
        staleTime: 60000 * 10,
    });

    return stats;
};

const defaultDaySummary: WorkoutDaySummary = {
    workoutsCount: 0,
    totalWorkoutDurationSeconds: 0,
    totalSetTimeSeconds: 0,
    totalRestTimeSeconds: 0,
    volume: 0,
    exercisesCount: 0,
    setsCount: 0,
    repsCount: 0,
    healthStats: null,
    hasLocomotionMetricsSource: false,
};

export const useWorkoutDaySummary = (dateKey: string): WorkoutDaySummary => {
    const { user } = useUser();

    const { data: summary = defaultDaySummary } = useQuery({
        queryKey: ['workout-day-summary', user?.id, user?.weightUnits, dateKey],
        queryFn: () => fetchWorkoutDaySummary(dateKey, user!.weightUnits || 'kg'),
        enabled: !!user?.id && !!dateKey,
        placeholderData: defaultDaySummary,
        staleTime: 60000 * 5,
    });

    return summary;
};

export const useWorkoutDayHealthStats = (dateKey: string): WorkoutDaySummary['healthStats'] => {
    const { user } = useUser();

    const userId = user?.id;
    const userMhrFormula = user?.mhrFormula;
    const userMhrManualValue = user?.mhrManualValue;
    const userBirthdayMs = user?.birthday?.getTime?.();

    const { data: healthStats = null } = useQuery({
        queryKey: [
            'workout-day-health-stats',
            userId,
            userMhrFormula,
            userMhrManualValue,
            userBirthdayMs,
            dateKey,
        ],
        queryFn: async () => {
            await waitForIdle();
            return fetchWorkoutDayHealthStats(dateKey);
        },
        enabled: !!userId && !!dateKey,
        placeholderData: null,
        staleTime: 60000 * 5,
    });

    return healthStats;
};
