import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

import type { AnalyticsScreenName } from '@/analytics';

import { useAnalytics } from './use-analytics';

/** Tracks a stable analytics name whenever the owning route receives focus. */
export const useAnalyticsScreen = (screenName: AnalyticsScreenName) => {
    const { isEnabled, screen } = useAnalytics();

    useFocusEffect(
        useCallback(() => {
            if (isEnabled) screen(screenName);
        }, [isEnabled, screen, screenName]),
    );
};
