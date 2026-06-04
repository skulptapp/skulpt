import { FC, useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { usePathname } from 'expo-router';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';

import {
    APP_STORE_REVIEW_FOREGROUND_DELAY_MS,
    APP_STORE_REVIEW_RETRY_DELAY_MS,
    APP_STORE_REVIEW_ROUTE_STABILITY_MS,
} from '@/constants/app-review';
import { recordStoreReviewAttempt } from '@/crud/app-review';
import { db } from '@/db';
import { appReviewPrompt, type AppReviewPromptSelect } from '@/db/schema';
import { waitForIdle } from '@/helpers/idle';
import { useAnalytics } from '@/hooks/use-analytics';
import { useAppState } from '@/hooks/use-app-state';
import { useRunningWorkoutStatic } from '@/hooks/use-running-workout';
import { useStoreReviewGate } from '@/hooks/use-store-review-gate';
import { useUser } from '@/hooks/use-user';
import { reportError } from '@/services/error-reporting';
import { requestStoreReviewIfAvailable } from '@/services/store-review';

const BLOCKED_ROUTE_PREFIXES = [
    '/day',
    '/editor',
    '/filter',
    '/guide',
    '/preview',
    '/review',
    '/select',
];

const toTimestampMs = (value: Date | number | string | null | undefined): number | null => {
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const timestamp = new Date(value).getTime();
        return Number.isFinite(timestamp) ? timestamp : null;
    }
    return null;
};

const isBlockedRoute = (pathname: string) =>
    BLOCKED_ROUTE_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );

const getPromptAnalyticsProperties = (prompt: AppReviewPromptSelect) => ({
    promptId: prompt.id,
    promptKey: prompt.promptKey,
    cycleIndex: prompt.cycleIndex,
    completionSource: prompt.completionSource ?? undefined,
    response: prompt.response ?? undefined,
    eligibleWorkoutCount: prompt.eligibleWorkoutCount,
    workoutId: prompt.shownWorkoutId ?? prompt.triggerWorkoutId ?? undefined,
});

export const PendingStoreReviewCoordinator: FC = () => {
    const { user } = useUser();
    const { track } = useAnalytics();
    const pathname = usePathname();
    const { runningWorkout } = useRunningWorkoutStatic();
    const { activeBlockersCount } = useStoreReviewGate();

    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const attemptInFlightRef = useRef(false);
    const activeSessionStartedAtRef = useRef<number | null>(null);
    const routeChangedAtRef = useRef(0);
    const attemptPendingStoreReviewRef = useRef<() => void>(() => undefined);

    const clearScheduledAttempt = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const appStateCallbacks = useMemo(
        () => ({
            onForeground: () => {
                activeSessionStartedAtRef.current = Date.now();
            },
            onBackground: () => {
                activeSessionStartedAtRef.current = null;
                clearScheduledAttempt();
            },
        }),
        [clearScheduledAttempt],
    );
    const { appState } = useAppState(appStateCallbacks);

    const pendingPromptQuery = useMemo(
        () =>
            db
                .select()
                .from(appReviewPrompt)
                .where(
                    and(
                        eq(appReviewPrompt.userId, user?.id ?? ''),
                        eq(appReviewPrompt.response, 'good'),
                        isNotNull(appReviewPrompt.storeReviewPendingAt),
                        isNull(appReviewPrompt.storeReviewRequestedAt),
                    ),
                )
                .limit(1),
        [user?.id],
    );
    const { data: pendingPrompts = [] } = useLiveQuery(pendingPromptQuery);
    const pendingPrompt = pendingPrompts[0];
    const pendingPromptId = pendingPrompt?.id;
    const pendingAtMs = toTimestampMs(pendingPrompt?.storeReviewPendingAt);

    useEffect(() => {
        const now = Date.now();
        routeChangedAtRef.current = now;

        if (AppState.currentState === 'active' && activeSessionStartedAtRef.current == null) {
            activeSessionStartedAtRef.current = now;
        }
    }, []);

    useEffect(() => {
        routeChangedAtRef.current = Date.now();
    }, [pathname]);

    const isGateOpen = useCallback(() => {
        const now = Date.now();

        return (
            appState === 'active' &&
            AppState.currentState === 'active' &&
            !isBlockedRoute(pathname) &&
            routeChangedAtRef.current > 0 &&
            now - routeChangedAtRef.current >= APP_STORE_REVIEW_ROUTE_STABILITY_MS &&
            activeBlockersCount === 0 &&
            !runningWorkout
        );
    }, [activeBlockersCount, appState, pathname, runningWorkout]);

    const scheduleRetry = useCallback(() => {
        clearScheduledAttempt();
        timeoutRef.current = setTimeout(() => {
            attemptPendingStoreReviewRef.current();
        }, APP_STORE_REVIEW_RETRY_DELAY_MS);
    }, [clearScheduledAttempt]);

    const attemptPendingStoreReview = useCallback(async () => {
        if (!pendingPrompt || attemptInFlightRef.current) return;

        if (!isGateOpen()) {
            scheduleRetry();
            return;
        }

        await waitForIdle();

        if (!isGateOpen()) {
            scheduleRetry();
            return;
        }

        attemptInFlightRef.current = true;
        clearScheduledAttempt();

        try {
            const attempt = await requestStoreReviewIfAvailable();
            const prompt = await recordStoreReviewAttempt(pendingPrompt.id, attempt);
            track('app_review_prompt:store_review_requested', {
                ...getPromptAnalyticsProperties(prompt),
                storeReviewAvailable: attempt.isAvailable,
                storeReviewHasAction: attempt.hasAction,
            });
        } catch (error) {
            reportError(error, 'Failed to request pending store review:');
        } finally {
            attemptInFlightRef.current = false;
        }
    }, [clearScheduledAttempt, isGateOpen, pendingPrompt, scheduleRetry, track]);

    useEffect(() => {
        attemptPendingStoreReviewRef.current = () => {
            void attemptPendingStoreReview();
        };
    }, [attemptPendingStoreReview]);

    useEffect(() => {
        clearScheduledAttempt();

        if (!pendingPromptId || pendingAtMs == null || appState !== 'active') return;

        if (activeSessionStartedAtRef.current == null) {
            activeSessionStartedAtRef.current = Date.now();
        }

        const readyAt =
            Math.max(activeSessionStartedAtRef.current, pendingAtMs) +
            APP_STORE_REVIEW_FOREGROUND_DELAY_MS;
        const delay = Math.max(0, readyAt - Date.now());

        timeoutRef.current = setTimeout(() => {
            attemptPendingStoreReviewRef.current();
        }, delay);

        return clearScheduledAttempt;
    }, [
        activeBlockersCount,
        appState,
        clearScheduledAttempt,
        pathname,
        pendingAtMs,
        pendingPromptId,
        runningWorkout,
    ]);

    return null;
};
