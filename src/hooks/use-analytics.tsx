import { createContext, FC, PropsWithChildren, useContext, useEffect, useState } from 'react';
import { createAnalyticsManager, AnalyticsManager } from '@/analytics/manager';
import { createPostHogProvider, createAppMetricaProvider } from '@/analytics/providers';
import { reportError, runInBackground } from '@/services/error-reporting';
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
    const [analytics, setAnalytics] = useState<AnalyticsManager | null>(null);
    const [isReady, setIsReady] = useState(false);
    const { user } = useUser();

    useEffect(() => {
        const initializeAnalytics = async () => {
            const providers = [];

            // PostHog
            const posthogKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
            const posthogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST;
            if (posthogKey && posthogHost) {
                providers.push(createPostHogProvider(posthogKey, posthogHost));
            }

            // AppMetrica
            const appMetricaKey = process.env.EXPO_PUBLIC_APPMETRICA_API_KEY;
            if (appMetricaKey) {
                providers.push(createAppMetricaProvider(appMetricaKey));
            }

            if (providers.length === 0) {
                console.warn('[Analytics] No analytics providers configured');
                setIsReady(true);
                return;
            }

            const manager = createAnalyticsManager({
                providers,
                enabled: true,
                debug: process.env.EXPO_PUBLIC_IS_PRODUCTION !== 'true',
            });

            try {
                await manager.initialize();
                setAnalytics(manager);
            } catch (error) {
                reportError(error, '[Analytics] Failed to initialize:');
            } finally {
                setIsReady(true);
            }
        };

        runInBackground(initializeAnalytics, '[Analytics] Failed to bootstrap analytics:');
    }, []);

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
 * track('workout_started', { type: 'strength' });
 *
 * // Track a screen
 * screen('workout_details', { workout_id: '123' });
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

    return {
        /**
         * Track an event
         */
        track: (event: string, properties?: Record<string, any>) => {
            analytics?.track(event, properties);
        },

        /**
         * Track a screen view
         */
        screen: (screenName: string, properties?: Record<string, any>) => {
            analytics?.screen(screenName, properties);
        },

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
    };
};

export { AnalyticsProvider, useAnalytics };
