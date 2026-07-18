import {
    createContext,
    FC,
    PropsWithChildren,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import { createAnalyticsManager, AnalyticsManager } from '@/analytics/manager';
import { createPostHogProvider } from '@/analytics/providers';
import {
    AnalyticsEventMap,
    AnalyticsEventName,
    AnalyticsScreenName,
    IAnalyticsProvider,
} from '@/analytics';
import { reportError, runInBackground } from '@/services/error-reporting';
import { isSyncEnabled } from '@/sync/config';
import { useUser } from './use-user';

type AnalyticsContextType = {
    analytics: AnalyticsManager | null;
    isReady: boolean;
};

const analyticsContext = createContext<AnalyticsContextType>({
    analytics: null,
    isReady: false,
});

/**
 * Analytics provider that initializes and manages multiple analytics services
 */
const AnalyticsProvider: FC<PropsWithChildren> = ({ children }) => {
    const [analytics] = useState<AnalyticsManager | null>(() => {
        const environment = String(Constants.expoConfig?.extra?.appVariant ?? 'development');
        const explicitlyEnabled = process.env.EXPO_PUBLIC_ANALYTICS_ENABLED === 'true';
        const enabled = environment === 'production' || explicitlyEnabled;
        if (!enabled) return null;

        const providers: IAnalyticsProvider[] = [];

        const posthogKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
        const posthogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST;
        if (posthogKey && posthogHost) {
            providers.push(createPostHogProvider(posthogKey, posthogHost));
        }

        if (providers.length === 0) return null;

        return createAnalyticsManager({
            providers,
            enabled,
            debug: environment !== 'production',
            context: {
                environment,
                buildProfile: String(Constants.expoConfig?.extra?.buildProfile ?? environment),
                updateChannel: Updates.channel ?? 'embedded',
                platform: Platform.OS,
                appVersion:
                    Application.nativeApplicationVersion ??
                    Constants.expoConfig?.version ??
                    'unknown',
                buildNumber: Application.nativeBuildVersion ?? 'unknown',
                syncEnabled: isSyncEnabled(),
            },
        });
    });
    const [isReady, setIsReady] = useState(false);
    const { user } = useUser();

    useEffect(() => {
        const initializeAnalytics = async () => {
            if (!analytics) {
                setIsReady(true);
                return;
            }

            try {
                await analytics.initialize();
            } catch (error) {
                reportError(error, '[Analytics] Failed to initialize:');
            } finally {
                setIsReady(true);
            }
        };

        runInBackground(initializeAnalytics, '[Analytics] Failed to bootstrap analytics:');
    }, [analytics]);

    // Auto-identify user when logged in
    useEffect(() => {
        if (analytics && user?.id) {
            analytics.identify(user.id, {
                applicationVersion: user.applicationVersion,
                device: user.device,
                deviceBrand: user.deviceBrand,
                deviceModel: user.deviceModel,
                deviceSystemName: user.deviceSystemName,
                deviceSystemVersion: user.deviceSystemVersion,
                lng: user.lng,
                theme: user.theme,
                environment: String(Constants.expoConfig?.extra?.appVariant ?? 'development'),
                syncEnabled: isSyncEnabled(),
            });
        }
    }, [analytics, user]);

    return (
        <analyticsContext.Provider value={{ analytics, isReady }}>
            {children}
        </analyticsContext.Provider>
    );
};

/**
 * Hook to access unified analytics
 *
 * @example
 * ```tsx
 * const { track, screen, identify } = useAnalytics();
 *
 * // Track an event
 * track('workout:start', { workoutId: 'workout-id', source: 'planned' });
 *
 * // Track a screen
 * screen('workout');
 *
 * // Identify a user
 * identify('user-123', { email: 'user@example.com' });
 * ```
 */
const useAnalytics = () => {
    const context = useContext(analyticsContext);

    if (!context) {
        throw new Error('useAnalytics must be used within an AnalyticsProvider');
    }

    const { analytics } = context;

    const track = useCallback(
        <Event extends AnalyticsEventName>(event: Event, properties?: AnalyticsEventMap[Event]) => {
            analytics?.track(event, properties);
        },
        [analytics],
    );

    const screen = useCallback(
        (screenName: AnalyticsScreenName) => {
            analytics?.screen(screenName);
        },
        [analytics],
    );

    return {
        /**
         * Track an event
         */
        track,

        /**
         * Track a screen view
         */
        screen,

        /**
         * Identify a user
         */
        identify: (userId: string, traits?: Record<string, any>) => {
            analytics?.identify(userId, traits);
        },

        /**
         * Reset user identification (on logout)
         */
        reset: () => {
            analytics?.reset();
        },

        /**
         * Set user properties
         */
        setUserProperties: (properties: Record<string, any>) => {
            analytics?.setUserProperties(properties);
        },

        /**
         * Check if a feature flag is enabled
         */
        isFeatureEnabled: async (flag: string): Promise<boolean> => {
            return (await analytics?.isFeatureEnabled(flag)) || false;
        },

        /**
         * Group identification (for teams/organizations)
         */
        group: (groupType: string, groupId: string, traits?: Record<string, any>) => {
            analytics?.group(groupType, groupId, traits);
        },

        /**
         * Get the underlying analytics manager (for advanced usage)
         */
        getManager: () => analytics,

        /**
         * Check if analytics is ready
         */
        isReady: context.isReady,

        /** Whether at least one analytics provider is configured for this build. */
        isEnabled: analytics !== null,
    };
};

export { AnalyticsProvider, useAnalytics };
