import { FC, useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';

import { useAnalytics } from '@/hooks/use-analytics';
import { useUser } from '@/hooks/use-user';
import { storage } from '@/storage';

import { getCampaignProperties, isFirstAnalyticsSession } from './helpers';

const HAS_STARTED_SESSION_KEY = 'analytics.hasStartedSession';
const FOREGROUND_SOURCE_SETTLE_MS = 350;

type SessionSource = 'cold_start' | 'foreground' | 'deep_link' | 'notification';

const getNotificationKind = (
    value: unknown,
): 'workout_reminder' | 'rest_timer' | 'work_timer' | 'other' => {
    if (value === 'workout-reminder' || value === 'workout_reminder') return 'workout_reminder';
    if (value === 'rest-timer' || value === 'rest_timer') return 'rest_timer';
    if (value === 'work-timer' || value === 'work_timer') return 'work_timer';
    return 'other';
};

const parseUrlProperties = (url?: string | null) => {
    if (!url) return {};
    const parsed = Linking.parse(url);
    return getCampaignProperties(parsed.queryParams ?? undefined);
};

export const AnalyticsTracker: FC = () => {
    const { track, isEnabled } = useAnalytics();
    const { user } = useUser();
    const userCreatedAtMs = user?.createdAt?.getTime() ?? null;
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);
    const initialSessionPendingRef = useRef(true);
    const initialSessionTrackedRef = useRef(false);
    const pendingSessionSourceRef = useRef<SessionSource | null>(null);
    const pendingCampaignRef = useRef<Record<string, string>>({});
    const foregroundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const notificationKeysRef = useRef(new Set<string>());
    const initialNotificationRef = useRef(Notifications.getLastNotificationResponse());
    const trackSession = useCallback(
        (source: SessionSource, campaign: Record<string, string> = {}) => {
            if (!isEnabled || userCreatedAtMs == null) return;

            const hasStartedSession = storage.getBoolean(HAS_STARTED_SESSION_KEY) === true;
            const isFirstSession = isFirstAnalyticsSession({
                hasStartedSession,
                userCreatedAtMs,
            });

            if (!hasStartedSession) storage.set(HAS_STARTED_SESSION_KEY, true);

            track('app:session_start', {
                source,
                isFirstSession,
                ...campaign,
            });
        },
        [isEnabled, track, userCreatedAtMs],
    );

    const trackDeepLink = useCallback(
        (url: string) => {
            const campaign = parseUrlProperties(url);
            track('app:deep_link_opened', campaign);
            return campaign;
        },
        [track],
    );

    const trackNotification = useCallback(
        (response: Notifications.NotificationResponse) => {
            const { notification } = response;
            const responseKey = `${notification.request.identifier}:${notification.date}:${response.actionIdentifier}`;
            if (notificationKeysRef.current.has(responseKey)) return {};
            notificationKeysRef.current.add(responseKey);

            const data = notification.request.content.data;
            const url = typeof data?.url === 'string' ? data.url : undefined;
            const campaign = parseUrlProperties(url);

            track('notification:opened', {
                kind: getNotificationKind(data?.kind),
            });
            return campaign;
        },
        [track],
    );

    useEffect(() => {
        if (!isEnabled || userCreatedAtMs == null) return;

        appStateRef.current = AppState.currentState;
        let cancelled = false;

        const startInitialSession = async () => {
            if (initialSessionTrackedRef.current) {
                initialSessionPendingRef.current = false;
                return;
            }

            try {
                const response = initialNotificationRef.current;
                const initialUrl = await Linking.getInitialURL();
                if (cancelled) return;
                initialSessionTrackedRef.current = true;

                if (response) {
                    const campaign = trackNotification(response);
                    trackSession('notification', campaign);
                } else if (initialUrl) {
                    const campaign = trackDeepLink(initialUrl);
                    trackSession('deep_link', campaign);
                } else {
                    trackSession('cold_start');
                }
            } finally {
                initialSessionPendingRef.current = false;
                pendingSessionSourceRef.current = null;
                pendingCampaignRef.current = {};
            }
        };

        void startInitialSession();

        const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
            const campaign = trackDeepLink(url);
            if (appStateRef.current !== 'active' || foregroundTimerRef.current) {
                pendingSessionSourceRef.current = 'deep_link';
                pendingCampaignRef.current = campaign;
            }
        });

        const notificationSubscription = Notifications.addNotificationResponseReceivedListener(
            (response) => {
                const campaign = trackNotification(response);
                if (appStateRef.current !== 'active' || foregroundTimerRef.current) {
                    pendingSessionSourceRef.current = 'notification';
                    pendingCampaignRef.current = campaign;
                }
            },
        );

        const appStateSubscription = AppState.addEventListener('change', (nextState) => {
            const previousState = appStateRef.current;
            appStateRef.current = nextState;

            if (nextState !== 'active' || previousState === 'active') return;
            if (initialSessionPendingRef.current) return;

            if (foregroundTimerRef.current) clearTimeout(foregroundTimerRef.current);
            foregroundTimerRef.current = setTimeout(() => {
                const source = pendingSessionSourceRef.current ?? 'foreground';
                const campaign = pendingCampaignRef.current;
                pendingSessionSourceRef.current = null;
                pendingCampaignRef.current = {};
                foregroundTimerRef.current = null;
                trackSession(source, campaign);
            }, FOREGROUND_SOURCE_SETTLE_MS);
        });

        return () => {
            cancelled = true;
            if (foregroundTimerRef.current) clearTimeout(foregroundTimerRef.current);
            linkingSubscription.remove();
            notificationSubscription.remove();
            appStateSubscription.remove();
        };
    }, [isEnabled, trackDeepLink, trackNotification, trackSession, userCreatedAtMs]);

    return null;
};
