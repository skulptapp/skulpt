import { and, count, eq, gt } from 'drizzle-orm';

import { db } from '@/db';
import {
    appReviewPrompt,
    type AppReviewPromptInsert,
    type AppReviewPromptSelect,
    workout,
} from '@/db/schema';
import { nanoid } from '@/helpers/nanoid';
import { queueSyncOperation } from '@/crud/sync';
import { reportError } from '@/services/error-reporting';

import {
    APP_REVIEW_CURRENT_CYCLE_INDEX,
    APP_REVIEW_MIN_DURATION_SECONDS,
    APP_REVIEW_PROMPT_KEY,
    type AppReviewCompletionSource,
    type AppReviewResponse,
} from '@/constants/app-review';
import { isEligibleWorkoutCount, isQualifyingWorkoutDuration } from '@/helpers/app-review';

type CompletedWorkoutLike = {
    id: string;
    userId: string;
    duration: number | null;
};

type PromptCreateInput = {
    userId: string;
    status: AppReviewPromptSelect['status'];
    triggerWorkoutId: string;
    shownWorkoutId?: string | null;
    eligibleWorkoutCount: number;
    completionSource: AppReviewCompletionSource;
    shownAt?: Date | null;
};

type StoreReviewAttempt = {
    isAvailable: boolean;
    hasAction: boolean;
};

let postWorkoutPromptResolutionInFlight = false;

export type PostWorkoutAppReviewPromptResult =
    | { action: 'show'; prompt: AppReviewPromptSelect; wasDeferred: boolean }
    | { action: 'defer'; prompt: AppReviewPromptSelect }
    | { action: 'skip' };

const queuePromptSync = async (
    row: AppReviewPromptSelect,
    operation: 'create' | 'update' | 'delete',
) => {
    await queueSyncOperation({
        tableName: 'app_review_prompt',
        recordId: row.id,
        operation,
        timestamp: row.updatedAt,
        data: row,
    });
};

export const getCurrentCyclePrompt = async (
    userId: string,
): Promise<AppReviewPromptSelect | null> => {
    const rows = await db
        .select()
        .from(appReviewPrompt)
        .where(
            and(
                eq(appReviewPrompt.userId, userId),
                eq(appReviewPrompt.promptKey, APP_REVIEW_PROMPT_KEY),
                eq(appReviewPrompt.cycleIndex, APP_REVIEW_CURRENT_CYCLE_INDEX),
            ),
        )
        .limit(1);

    return rows[0] ?? null;
};

export const getAppReviewPromptById = async (id: string): Promise<AppReviewPromptSelect | null> => {
    const rows = await db.select().from(appReviewPrompt).where(eq(appReviewPrompt.id, id)).limit(1);
    return rows[0] ?? null;
};

export const countQualifyingCompletedWorkouts = async (userId: string): Promise<number> => {
    const rows = await db
        .select({ count: count() })
        .from(workout)
        .where(
            and(
                eq(workout.userId, userId),
                eq(workout.status, 'completed'),
                gt(workout.duration, APP_REVIEW_MIN_DURATION_SECONDS),
            ),
        );

    return rows[0]?.count ?? 0;
};

const insertPrompt = async (input: PromptCreateInput): Promise<AppReviewPromptSelect> => {
    const now = new Date();
    const row: AppReviewPromptInsert = {
        id: nanoid(),
        userId: input.userId,
        promptKey: APP_REVIEW_PROMPT_KEY,
        cycleIndex: APP_REVIEW_CURRENT_CYCLE_INDEX,
        status: input.status,
        triggerWorkoutId: input.triggerWorkoutId,
        shownWorkoutId: input.shownWorkoutId ?? null,
        eligibleWorkoutCount: input.eligibleWorkoutCount,
        completionSource: input.completionSource,
        shownAt: input.shownAt ?? null,
        createdAt: now,
        updatedAt: now,
    };

    await db
        .insert(appReviewPrompt)
        .values(row)
        .onConflictDoUpdate({
            target: [appReviewPrompt.userId, appReviewPrompt.promptKey, appReviewPrompt.cycleIndex],
            set: {
                status: row.status,
                triggerWorkoutId: row.triggerWorkoutId,
                shownWorkoutId: row.shownWorkoutId,
                eligibleWorkoutCount: row.eligibleWorkoutCount,
                completionSource: row.completionSource,
                shownAt: row.shownAt,
                updatedAt: now,
            },
        });

    const prompt = await getCurrentCyclePrompt(input.userId);
    if (!prompt) {
        throw new Error('Failed to retrieve app review prompt after insert');
    }

    await queuePromptSync(prompt, 'create');
    return prompt;
};

const updatePrompt = async (
    id: string,
    updates: Partial<AppReviewPromptSelect>,
): Promise<AppReviewPromptSelect> => {
    const updatedAt = new Date();
    await db
        .update(appReviewPrompt)
        .set({ ...updates, updatedAt })
        .where(eq(appReviewPrompt.id, id));

    const prompt = await getAppReviewPromptById(id);
    if (!prompt) {
        throw new Error('Failed to retrieve app review prompt after update');
    }

    await queuePromptSync(prompt, 'update');
    return prompt;
};

export const showDeferredAppReviewPrompt = async (
    prompt: AppReviewPromptSelect,
    workoutId: string,
): Promise<AppReviewPromptSelect> => {
    return updatePrompt(prompt.id, {
        status: 'shown',
        shownWorkoutId: workoutId,
        completionSource: 'phone',
        shownAt: new Date(),
    });
};

export const dismissAppReviewPrompt = async (id: string): Promise<AppReviewPromptSelect> => {
    return updatePrompt(id, {
        status: 'dismissed',
        dismissedAt: new Date(),
    });
};

export const submitAppReviewPrompt = async (
    id: string,
    response: AppReviewResponse,
): Promise<AppReviewPromptSelect> => {
    return updatePrompt(id, {
        status: 'submitted',
        response,
        submittedAt: new Date(),
    });
};

export const recordStoreReviewAttempt = async (
    id: string,
    attempt: StoreReviewAttempt,
): Promise<AppReviewPromptSelect> => {
    return updatePrompt(id, {
        storeReviewAvailable: attempt.isAvailable,
        storeReviewHasAction: attempt.hasAction,
        storeReviewRequestedAt: new Date(),
    });
};

export const resolvePostWorkoutAppReviewPromptResult = async ({
    workout: completedWorkout,
    completionSource,
}: {
    workout: CompletedWorkoutLike;
    completionSource: AppReviewCompletionSource;
}): Promise<PostWorkoutAppReviewPromptResult> => {
    if (postWorkoutPromptResolutionInFlight) {
        return { action: 'skip' };
    }

    postWorkoutPromptResolutionInFlight = true;

    try {
        const existingPrompt = await getCurrentCyclePrompt(completedWorkout.userId);

        if (existingPrompt) {
            if (existingPrompt.status === 'deferred' && completionSource === 'phone') {
                return {
                    action: 'show',
                    prompt: await showDeferredAppReviewPrompt(existingPrompt, completedWorkout.id),
                    wasDeferred: true,
                };
            }

            return { action: 'skip' };
        }

        if (!isQualifyingWorkoutDuration(completedWorkout.duration)) {
            return { action: 'skip' };
        }

        const eligibleWorkoutCount = await countQualifyingCompletedWorkouts(
            completedWorkout.userId,
        );
        if (!isEligibleWorkoutCount(eligibleWorkoutCount)) {
            return { action: 'skip' };
        }

        if (completionSource === 'watch') {
            return {
                action: 'defer',
                prompt: await insertPrompt({
                    userId: completedWorkout.userId,
                    status: 'deferred',
                    triggerWorkoutId: completedWorkout.id,
                    eligibleWorkoutCount,
                    completionSource,
                }),
            };
        }

        return {
            action: 'show',
            prompt: await insertPrompt({
                userId: completedWorkout.userId,
                status: 'shown',
                triggerWorkoutId: completedWorkout.id,
                shownWorkoutId: completedWorkout.id,
                eligibleWorkoutCount,
                completionSource,
                shownAt: new Date(),
            }),
            wasDeferred: false,
        };
    } catch (error) {
        reportError(error, 'Failed to resolve post-workout app review prompt:', {
            extras: {
                workoutId: completedWorkout.id,
                completionSource,
            },
        });
        return { action: 'skip' };
    } finally {
        postWorkoutPromptResolutionInFlight = false;
    }
};

export const resolvePostWorkoutAppReviewPrompt = async (input: {
    workout: CompletedWorkoutLike;
    completionSource: AppReviewCompletionSource;
}): Promise<AppReviewPromptSelect | null> => {
    const result = await resolvePostWorkoutAppReviewPromptResult(input);
    return result.action === 'show' ? result.prompt : null;
};
