import AppMetrica, { Attributes, UserProfile } from '@appmetrica/react-native-analytics';
import { IAnalyticsProvider } from '../types';

/**
 * AppMetrica analytics provider adapter
 */
export const createAppMetricaProvider = (apiKey: string): IAnalyticsProvider => {
    let initialized = false;

    return {
        async initialize() {
            if (initialized) return;

            AppMetrica.activate({
                apiKey,
                sessionTimeout: 120,
                firstActivationAsUpdate: false,
            });
            initialized = true;
        },

        identify(userId: string, traits?: Record<string, any>) {
            if (!initialized) {
                console.warn('[AppMetrica] Not initialized');
                return;
            }

            AppMetrica.setUserProfileID(userId);

            if (traits) {
                const profile = new UserProfile();

                Object.entries(traits).forEach(([key, value]) => {
                    if (typeof value === 'string') {
                        profile.apply(Attributes.customString(key).withValue(value));
                    } else if (typeof value === 'number') {
                        profile.apply(Attributes.customNumber(key).withValue(value));
                    } else if (typeof value === 'boolean') {
                        profile.apply(Attributes.customBoolean(key).withValue(value));
                    }
                });

                AppMetrica.reportUserProfile(profile);
            }
        },

        track(event: string, properties?: Record<string, any>) {
            if (!initialized) {
                console.warn('[AppMetrica] Not initialized');
                return;
            }

            if (properties) {
                AppMetrica.reportEvent(event, properties);
            } else {
                AppMetrica.reportEvent(event);
            }
        },

        screen(screenName: string, properties?: Record<string, any>) {
            if (!initialized) {
                console.warn('[AppMetrica] Not initialized');
                return;
            }

            AppMetrica.reportEvent(`screen_${screenName}`, properties);
        },

        reset() {
            if (!initialized) {
                console.warn('[AppMetrica] Not initialized');
                return;
            }

            AppMetrica.setUserProfileID('');
        },

        setUserProperties(properties: Record<string, any>) {
            if (!initialized) {
                console.warn('[AppMetrica] Not initialized');
                return;
            }

            const profile = new UserProfile();

            Object.entries(properties).forEach(([key, value]) => {
                if (typeof value === 'string') {
                    profile.apply(Attributes.customString(key).withValue(value));
                } else if (typeof value === 'number') {
                    profile.apply(Attributes.customNumber(key).withValue(value));
                } else if (typeof value === 'boolean') {
                    profile.apply(Attributes.customBoolean(key).withValue(value));
                }
            });

            AppMetrica.reportUserProfile(profile);
        },
    };
};
