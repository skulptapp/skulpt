import PostHog from 'posthog-react-native';
import { IAnalyticsProvider } from '../types';

/**
 * PostHog analytics provider adapter
 */
export const createPostHogProvider = (apiKey: string, host: string): IAnalyticsProvider => {
    let client: PostHog | null = null;
    let initialized = false;

    return {
        async initialize() {
            if (initialized) return;

            client = new PostHog(apiKey, {
                host,
                captureAppLifecycleEvents: true,
            });
            initialized = true;
        },

        identify(userId: string, traits?: Record<string, any>) {
            if (!client) {
                console.warn('[PostHog] Client not initialized');
                return;
            }

            client.identify(userId, traits);
        },

        track(event: string, properties?: Record<string, any>) {
            if (!client) {
                console.warn('[PostHog] Client not initialized');
                return;
            }

            client.capture(event, properties);
        },

        screen(screenName: string, properties?: Record<string, any>) {
            if (!client) {
                console.warn('[PostHog] Client not initialized');
                return;
            }

            client.screen(screenName, properties);
        },

        reset() {
            if (!client) {
                console.warn('[PostHog] Client not initialized');
                return;
            }

            client.reset();
        },

        setUserProperties(properties: Record<string, any>) {
            if (!client) {
                console.warn('[PostHog] Client not initialized');
                return;
            }

            client.setPersonProperties(properties);
        },

        async isFeatureEnabled(flag: string) {
            if (!client) {
                console.warn('[PostHog] Client not initialized');
                return false;
            }

            return client.isFeatureEnabled(flag) || false;
        },

        group(groupType: string, groupId: string, traits?: Record<string, any>) {
            if (!client) {
                console.warn('[PostHog] Client not initialized');
                return;
            }

            client.group(groupType, groupId, traits);
        },
    };
};
