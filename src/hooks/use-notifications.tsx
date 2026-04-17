import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router, Href } from 'expo-router';
import * as Linking from 'expo-linking';
import * as Device from 'expo-device';
import {
    checkNotifications,
    NotificationSettings,
    openSettings,
    PermissionStatus,
    requestNotifications,
    RESULTS,
} from 'react-native-permissions';
import { usePermissionsStore } from '@/stores/permissions';
import { useUser } from './use-user';
import { UserInsert } from '@/db/schema';
import Constants from 'expo-constants';
import { useShallow } from 'zustand/react/shallow';
import { reportError, runInBackground } from '@/services/error-reporting';

interface HandleNotificationStatus {
    status: PermissionStatus;
    settings: NotificationSettings;
}

interface UpdateUserNotificationDevice {
    status?: PermissionStatus;
    settings?: NotificationSettings;
    epsToken?: string;
    nativeToken?: string;
    isDelayed?: boolean;
    isDelayedDate?: Date | null;
}

type WorkoutTimerKind = 'rest-timer' | 'work-timer';

const NOTIFICATION_CHANNEL_CONFIG = {
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250] as [number, number, number, number],
    lightColor: '#84cc16',
} as const;

const isMissingFcmConfigurationError = (error: unknown): boolean => {
    if (!(error instanceof Error)) {
        return false;
    }

    const message = error.message.toLowerCase();

    return (
        message.includes('fcm-credentials') ||
        message.includes('default firebaseapp is not initialized')
    );
};

Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
        const data = notification.request.content.data as unknown;
        const kind =
            data && typeof data === 'object' && 'kind' in data
                ? (data as { kind?: unknown }).kind
                : undefined;

        const isWorkoutKind = kind === 'rest-timer' || kind === 'work-timer';
        const isForeground = AppState.currentState === 'active';

        // Don't show workout timer/rest notifications while the app is open.
        if (isWorkoutKind && isForeground) {
            return {
                shouldShowAlert: false,
                shouldPlaySound: false,
                shouldSetBadge: false,
                shouldShowBanner: false,
                shouldShowList: false,
            };
        }

        return {
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
        };
    },
});

type UseNotificationsContext = ReturnType<typeof useNotificationsProvider>;

const notificationsContext = createContext<UseNotificationsContext>({} as UseNotificationsContext);

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
    const pushes = useNotificationsProvider();

    return <notificationsContext.Provider value={pushes}>{children}</notificationsContext.Provider>;
};

export const useNotifications = () => {
    return useContext(notificationsContext);
};

const useNotificationsProvider = () => {
    const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
    const { user, updateUser } = useUser();

    const isAppInBackground = appState === 'background' || appState === 'inactive';

    const { permissions, setPermissions } = usePermissionsStore(
        useShallow((state) => ({
            permissions: state.permissions.notifications,
            setPermissions: state.setPermissions,
        })),
    );

    // Track last permission status to avoid unnecessary updates
    const lastStatusRef = useRef<PermissionStatus | null>(null);

    // Store user in ref to avoid dependency issues in checkPermissions
    const userRef = useRef(user);

    useEffect(() => {
        userRef.current = user;
    }, [user]);

    // Helper function to get delay timestamp
    const getDelayTimestamp = useCallback((isDelayedDate: Date | number | null): number | null => {
        if (!isDelayedDate) return null;
        return typeof isDelayedDate === 'number' ? isDelayedDate : isDelayedDate.getTime();
    }, []);

    // Helper function to check if delay is active
    const isDelayActive = useCallback(
        (isDelayed: boolean, isDelayedDate: Date | number | null): boolean => {
            if (!isDelayed || !isDelayedDate) return false;
            const delayTimestamp = getDelayTimestamp(isDelayedDate);
            return delayTimestamp !== null && delayTimestamp > Date.now();
        },
        [getDelayTimestamp],
    );

    const updateUserDevice = useCallback(
        async ({
            settings,
            epsToken,
            nativeToken,
            isDelayed,
            isDelayedDate,
            status = RESULTS.DENIED,
        }: UpdateUserNotificationDevice) => {
            // Reset delay if expired
            let finalIsDelayed = status === RESULTS.GRANTED ? false : (isDelayed ?? false);
            let finalIsDelayedDate = status === RESULTS.GRANTED ? null : isDelayedDate;

            if (isDelayedDate && status !== RESULTS.GRANTED) {
                const delayTimestamp = getDelayTimestamp(isDelayedDate);
                if (delayTimestamp !== null && delayTimestamp < Date.now()) {
                    finalIsDelayed = false;
                    finalIsDelayedDate = null;
                }
            }

            const payload: Omit<UserInsert, 'id' | 'createdAt' | 'updatedAt'> = {
                status,
                isDelayed: finalIsDelayed,
                isDelayedDate: finalIsDelayedDate,
                ...(epsToken && { epsToken }),
                ...(nativeToken && { nativeToken }),
                ...(Platform.OS === 'ios' && settings ? settings : {}),
            };

            return await updateUser(payload);
        },
        [updateUser, getDelayTimestamp],
    );

    const updateUserDeviceWithCurrentValues = useCallback(
        async (status: PermissionStatus, settings?: NotificationSettings) => {
            const currentUser = userRef.current;
            await updateUserDevice({
                status,
                settings,
                isDelayed: currentUser?.isDelayed ?? false,
                isDelayedDate: currentUser?.isDelayedDate ?? null,
            });
            setPermissions({ notifications: status });
        },
        [updateUserDevice, setPermissions],
    );

    const handleBlockedStatus = useCallback(
        ({ status, settings }: HandleNotificationStatus) =>
            updateUserDeviceWithCurrentValues(status, settings),
        [updateUserDeviceWithCurrentValues],
    );

    const registerForPushNotifications = useCallback(async () => {
        let epsToken;
        let nativeToken;

        if (Platform.OS === 'android') {
            await Promise.all([
                Notifications.setNotificationChannelAsync('rest-timer', {
                    name: 'Rest Timer',
                    description: 'Notifications for rest timer completion',
                    ...NOTIFICATION_CHANNEL_CONFIG,
                }),
                Notifications.setNotificationChannelAsync('work-timer', {
                    name: 'Workout Timer',
                    description: 'Notifications for workout timer completion',
                    ...NOTIFICATION_CHANNEL_CONFIG,
                }),
            ]);
        }

        if (Device.isDevice) {
            const projectId =
                Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

            const maxRetries = 3;
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    const [epsTokenResponse, nativeTokenResponse] = await Promise.all([
                        Notifications.getExpoPushTokenAsync({ projectId }),
                        Notifications.getDevicePushTokenAsync(),
                    ]);
                    epsToken = epsTokenResponse?.data;
                    nativeToken = nativeTokenResponse?.data;
                    break;
                } catch (e) {
                    if (isMissingFcmConfigurationError(e)) {
                        break;
                    }

                    const isServerError =
                        e instanceof Error &&
                        /expected an OK response, received: 5\d{2}/.test(e.message);

                    if (isServerError && attempt < maxRetries) {
                        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
                        continue;
                    }

                    if (!isServerError) {
                        reportError(e, 'Failed to register device push tokens:');
                    }
                    break;
                }
            }
        }

        return { epsToken, nativeToken };
    }, []);

    const handleGrantedStatusLogic = useCallback(
        async (status: PermissionStatus, settings?: NotificationSettings) => {
            try {
                const { epsToken, nativeToken } = await registerForPushNotifications();
                await updateUserDevice({
                    status,
                    settings,
                    epsToken,
                    nativeToken,
                    isDelayed: false,
                    isDelayedDate: null,
                });
            } catch (error) {
                reportError(error, 'Failed to register push notifications:');

                // Fallback: update without tokens
                try {
                    await updateUserDevice({
                        status,
                        settings,
                        isDelayed: false,
                        isDelayedDate: null,
                    });
                } catch (fallbackError) {
                    reportError(fallbackError, 'Failed to update user device (fallback):');
                }
            }
        },
        [updateUserDevice, registerForPushNotifications],
    );

    const handleGrantedStatus = useCallback(
        async ({ status, settings }: HandleNotificationStatus) => {
            setPermissions({ notifications: status });
            await handleGrantedStatusLogic(status, settings);
        },
        [setPermissions, handleGrantedStatusLogic],
    );

    const checkPermissions = useCallback(async () => {
        try {
            if (Device.isDevice) {
                // Read current user values from ref to avoid dependency issues
                const currentUser = userRef.current;
                const isDelayed = currentUser?.isDelayed ?? false;
                const isDelayedDate = currentUser?.isDelayedDate ?? null;

                if (isDelayActive(isDelayed, isDelayedDate)) {
                    // Delay is still active, skip permission check
                    setPermissions({ notifications: RESULTS.UNAVAILABLE });
                    return;
                }

                // If delay was set but expired, reset flags
                if (isDelayed && isDelayedDate && !isDelayActive(isDelayed, isDelayedDate)) {
                    await updateUserDevice({
                        status: RESULTS.DENIED,
                        isDelayed: false,
                        isDelayedDate: null,
                    });
                    return;
                }

                const { status, settings } = await checkNotifications();

                // Skip update if status hasn't changed (delay expiration is handled above)
                if (lastStatusRef.current === status) {
                    return;
                }

                lastStatusRef.current = status;

                switch (status) {
                    case RESULTS.UNAVAILABLE:
                    case RESULTS.BLOCKED:
                    case RESULTS.LIMITED:
                        await updateUserDeviceWithCurrentValues(status, settings);
                        break;
                    case RESULTS.GRANTED:
                        setPermissions({ notifications: status });
                        await handleGrantedStatusLogic(status, settings);
                        break;
                    case RESULTS.DENIED:
                        if (isDelayActive(isDelayed, isDelayedDate)) {
                            setPermissions({ notifications: RESULTS.UNAVAILABLE });
                            break;
                        }

                        const updatedUser = await updateUserDevice({
                            status,
                            settings,
                            isDelayed,
                            isDelayedDate,
                        });
                        setPermissions({
                            notifications: updatedUser.isDelayed ? RESULTS.UNAVAILABLE : status,
                        });
                        break;
                    default:
                        break;
                }
            } else {
                setPermissions({ notifications: RESULTS.UNAVAILABLE });
            }
        } catch (error) {
            reportError(error, 'Failed to check notification permissions:');
        }
    }, [
        updateUserDeviceWithCurrentValues,
        handleGrantedStatusLogic,
        updateUserDevice,
        setPermissions,
        isDelayActive,
    ]);

    const userLoadedRef = useRef(false);

    useEffect(() => {
        if (user !== undefined) {
            if (!userLoadedRef.current) {
                userLoadedRef.current = true;
                runInBackground(checkPermissions, 'Failed to initialize notification permissions:');
            }
        }
    }, [user, checkPermissions]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            setAppState(nextAppState);
            if (nextAppState === 'active' && appState !== 'active') {
                runInBackground(
                    checkPermissions,
                    'Failed to refresh notification permissions on app resume:',
                );
            }
        });
        return () => subscription?.remove();
    }, [appState, checkPermissions]);

    useEffect(() => {
        let subscription: Notifications.EventSubscription | null = null;

        const setupNotificationObserver = async () => {
            try {
                const { status } = await Notifications.getPermissionsAsync();

                if (status !== 'granted') {
                    return;
                }

                const redirect = (notification: Notifications.Notification) => {
                    const url = notification.request.content.data?.url;
                    if (typeof url === 'string') {
                        // The stored URL is a full deep link (e.g. skulpt:///workout/id/exerciseId).
                        // Passing it directly to router.push makes Expo Router call Linking.openURL
                        // which fails when the app is already in the foreground (iOS won't re-open
                        // its own URL scheme). Extract just the path and navigate within the app.
                        const parsed = Linking.parse(url);
                        const path = parsed.path ? `/${parsed.path}` : null;
                        if (path) {
                            router.push(path as Href);
                        }
                    }
                };

                const response = Notifications.getLastNotificationResponse();
                if (response?.notification) {
                    redirect(response.notification);
                }

                subscription = Notifications.addNotificationResponseReceivedListener((response) => {
                    redirect(response.notification);
                });
            } catch (error) {
                reportError(error, 'Failed to set up notification observer:');
            }
        };

        runInBackground(setupNotificationObserver, 'Failed to initialize notification observer:');

        return () => subscription?.remove();
    }, []);

    const requestPermissions = useCallback(() => {
        if (permissions === RESULTS.GRANTED) return;

        if (permissions === RESULTS.BLOCKED || permissions === RESULTS.LIMITED) {
            openSettings('notifications').catch((error) => {
                reportError(error, 'Failed to open notifications settings:');
            });
            return;
        }

        if (permissions === RESULTS.DENIED || permissions === RESULTS.UNAVAILABLE) {
            requestNotifications(['alert', 'sound', 'badge'])
                .then(async ({ status, settings }) => {
                    if (status === RESULTS.GRANTED) {
                        await handleGrantedStatus({ status, settings });
                    } else if (status === RESULTS.BLOCKED) {
                        await handleBlockedStatus({ status, settings });
                    }
                })
                .catch((error) => {
                    reportError(error, 'Failed to request notification permissions:');
                });
        }
    }, [permissions, handleGrantedStatus, handleBlockedStatus]);

    const scheduleWorkoutTimerNotification = useCallback(
        async (args: {
            kind: WorkoutTimerKind;
            identifier: string;
            message: { title: string; body?: string };
            deepLinkUrl?: string;
            trigger: Notifications.NotificationTriggerInput;
            errorLabel: string;
        }): Promise<string | null> => {
            if (!user?.pushes || permissions !== RESULTS.GRANTED) return null;

            try {
                const notificationContent: Notifications.NotificationContentInput = {
                    title: args.message.title,
                    body: args.message.body,
                    sound: Platform.OS === 'ios' ? 'default' : undefined,
                    vibrate: [0, 250, 250, 250],
                    data: args.deepLinkUrl
                        ? { url: args.deepLinkUrl, kind: args.kind }
                        : { kind: args.kind },
                    ...(Platform.OS === 'android' && {
                        channelId: args.kind,
                    }),
                };

                await Notifications.scheduleNotificationAsync({
                    identifier: args.identifier,
                    content: notificationContent,
                    trigger: args.trigger,
                });

                return args.identifier;
            } catch (error) {
                reportError(error, args.errorLabel);
                return null;
            }
        },
        [permissions, user?.pushes],
    );

    const scheduleRestTimerNotification = useCallback(
        async (
            restDurationSeconds: number,
            message: { title: string; body?: string },
            identifier: string,
            deepLinkUrl?: string,
        ): Promise<string | null> => {
            return await scheduleWorkoutTimerNotification({
                kind: 'rest-timer',
                identifier,
                message,
                deepLinkUrl,
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                    seconds: restDurationSeconds,
                },
                errorLabel: 'Failed to schedule rest timer notification:',
            });
        },
        [scheduleWorkoutTimerNotification],
    );

    const scheduleRestTimerNotificationAt = useCallback(
        async (
            date: Date,
            message: { title: string; body?: string },
            identifier: string,
            deepLinkUrl?: string,
        ): Promise<string | null> => {
            return await scheduleWorkoutTimerNotification({
                kind: 'rest-timer',
                identifier,
                message,
                deepLinkUrl,
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date,
                },
                errorLabel: 'Failed to schedule rest timer notification (date):',
            });
        },
        [scheduleWorkoutTimerNotification],
    );

    const scheduleWorkTimerNotification = useCallback(
        async (
            durationSeconds: number,
            message: { title: string; body?: string },
            identifier: string,
            deepLinkUrl?: string,
        ): Promise<string | null> => {
            return await scheduleWorkoutTimerNotification({
                kind: 'work-timer',
                identifier,
                message,
                deepLinkUrl,
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                    seconds: durationSeconds,
                },
                errorLabel: 'Failed to schedule work timer notification:',
            });
        },
        [scheduleWorkoutTimerNotification],
    );

    const scheduleWorkTimerNotificationAt = useCallback(
        async (
            date: Date,
            message: { title: string; body?: string },
            identifier: string,
            deepLinkUrl?: string,
        ): Promise<string | null> => {
            return await scheduleWorkoutTimerNotification({
                kind: 'work-timer',
                identifier,
                message,
                deepLinkUrl,
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date,
                },
                errorLabel: 'Failed to schedule work timer notification (date):',
            });
        },
        [scheduleWorkoutTimerNotification],
    );

    const cancelNotification = useCallback(async (identifier: string) => {
        try {
            await Notifications.cancelScheduledNotificationAsync(identifier);
        } catch (error) {
            reportError(error, 'Failed to cancel notification:');
        }
    }, []);

    const cancelAllNotifications = useCallback(async () => {
        try {
            await Notifications.cancelAllScheduledNotificationsAsync();
        } catch (error) {
            reportError(error, 'Failed to cancel all notifications:');
        }
    }, []);

    return {
        scheduleRestTimerNotification,
        scheduleRestTimerNotificationAt,
        scheduleWorkTimerNotification,
        scheduleWorkTimerNotificationAt,
        cancelNotification,
        cancelAllNotifications,
        isAppInBackground,
        requestPermissions,
    };
};
