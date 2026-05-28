import { useCallback } from 'react';
import { router } from 'expo-router';

import { type AppReviewPromptSelect, type WorkoutSelect } from '@/db/schema';
import { type AppReviewCompletionSource } from '@/constants/app-review';
import { resolvePostWorkoutAppReviewPromptResult } from '@/crud/app-review';
import { useAnalytics } from '@/hooks/use-analytics';

const getPromptAnalyticsProperties = (
    prompt: AppReviewPromptSelect,
    workoutId: string,
    completionSource: AppReviewCompletionSource,
) => ({
    promptId: prompt.id,
    promptKey: prompt.promptKey,
    cycleIndex: prompt.cycleIndex,
    workoutId,
    completionSource,
    eligibleWorkoutCount: prompt.eligibleWorkoutCount,
});

export const usePostWorkoutAppReviewPrompt = () => {
    const { track } = useAnalytics();

    return useCallback(
        async (completedWorkout: WorkoutSelect, completionSource: AppReviewCompletionSource) => {
            const result = await resolvePostWorkoutAppReviewPromptResult({
                workout: completedWorkout,
                completionSource,
            });

            if (result.action === 'skip') return;

            const properties = getPromptAnalyticsProperties(
                result.prompt,
                completedWorkout.id,
                completionSource,
            );

            if (result.action === 'defer') {
                track('app_review_prompt:eligible', properties);
                track('app_review_prompt:deferred', properties);
                return;
            }

            if (!result.wasDeferred) {
                track('app_review_prompt:eligible', properties);
            }

            track('app_review_prompt:shown', properties);

            router.navigate({
                pathname: '/review' as any,
                params: { promptId: result.prompt.id },
            });
        },
        [track],
    );
};
