import * as StoreReview from 'expo-store-review';

import { waitForIdle } from '@/helpers/idle';

export type StoreReviewAttempt = {
    isAvailable: boolean;
    hasAction: boolean;
};

export const requestStoreReviewIfAvailable = async (): Promise<StoreReviewAttempt> => {
    const isAvailable = await StoreReview.isAvailableAsync();
    const hasAction = await StoreReview.hasAction();

    if (isAvailable && hasAction) {
        await StoreReview.requestReview();
    }

    return { isAvailable, hasAction };
};

export const requestStoreReviewAfterTransition = async (): Promise<StoreReviewAttempt> => {
    await waitForIdle();
    return requestStoreReviewIfAvailable();
};
