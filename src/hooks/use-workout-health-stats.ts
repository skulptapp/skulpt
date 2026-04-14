import { useQuery } from '@tanstack/react-query';

import type { WorkoutSelect } from '@/db/schema';
import { waitForIdle } from '@/helpers/idle';
import { computeWorkoutStats } from '@/services/workout-health-stats';
import { type HealthStatsDisplay } from '@/types/health-stats';
import { useUser } from './use-user';

type LiveWorkoutStatsResult = {
    status: 'completed' | 'waiting_recovery';
    stats: Partial<HealthStatsDisplay>;
    nextRunAt?: Date;
};

export const useWorkoutHealthStats = (workout: WorkoutSelect | null | undefined) => {
    const { user } = useUser();

    const userId = user?.id;
    const userMhrFormula = user?.mhrFormula;
    const userMhrManualValue = user?.mhrManualValue;
    const userBirthdayMs = user?.birthday?.getTime?.();

    const isEnabled =
        !!workout &&
        workout.status === 'completed' &&
        !!workout.startedAt &&
        !!workout.completedAt &&
        !!userId;

    const query = useQuery<LiveWorkoutStatsResult | null>({
        queryKey: [
            'workout-live-health-stats',
            workout?.id,
            workout?.startedAt?.getTime(),
            workout?.completedAt?.getTime(),
            userId,
            userMhrFormula,
            userMhrManualValue,
            userBirthdayMs,
        ],
        enabled: isEnabled,
        queryFn: async () => {
            if (!workout?.startedAt || !workout?.completedAt || !userId) {
                return null;
            }

            // Defer heavy HealthKit processing until after initial UI interactions.
            await waitForIdle();

            const result = await computeWorkoutStats(workout.startedAt, workout.completedAt, {
                mhrFormula: userMhrFormula ?? null,
                mhrManualValue: userMhrManualValue ?? null,
                birthday: userBirthdayMs != null ? new Date(userBirthdayMs) : null,
            });

            return {
                status: result.status,
                stats: result.stats,
                nextRunAt: result.nextRunAt,
            };
        },
        refetchInterval: (queryCtx) => {
            const data = queryCtx.state.data;
            if (!data || data.status !== 'waiting_recovery' || !data.nextRunAt) {
                return false;
            }

            return Math.max(1_000, data.nextRunAt.getTime() - Date.now());
        },
    });

    return {
        stats: query.data?.stats ?? null,
        status: query.data?.status ?? null,
        isLoading: query.isLoading || query.isFetching,
    };
};
