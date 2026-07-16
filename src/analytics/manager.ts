import { IAnalyticsConfig } from './types';
import { AnalyticsEventMap, AnalyticsEventName, AnalyticsScreenName } from './events';
import { reportError } from '@/services/error-reporting';

/**
 * Unified analytics manager that delegates to multiple providers
 */
export const createAnalyticsManager = (config: IAnalyticsConfig) => {
    const { providers, enabled = true, debug = false, context = {} } = config;
    let initialized = false;
    let initializing: Promise<void> | null = null;
    const pendingOperations: (() => void)[] = [];

    const log = (...args: any[]) => {
        if (debug) {
            console.log('[Analytics]', ...args);
        }
    };

    return {
        async initialize() {
            if (initialized) return;
            if (initializing) return initializing;

            if (!enabled) {
                log('Analytics is disabled');
                return;
            }

            initializing = (async () => {
                const results = await Promise.allSettled(
                    providers.map((provider) => provider.initialize()),
                );

                results.forEach((result, index) => {
                    if (result.status === 'rejected') {
                        reportError(
                            result.reason,
                            `[Analytics] Provider ${index} failed to initialize:`,
                        );
                    }
                });

                initialized = true;
                log('Initialized with', providers.length, 'providers');

                const queued = pendingOperations.splice(0);
                queued.forEach((operation) => operation());
            })().finally(() => {
                initializing = null;
            });

            return initializing;
        },

        identify(userId: string, traits?: Record<string, any>) {
            if (!enabled) return;

            log('Identify:', userId, traits);

            const operation = () =>
                providers.forEach((provider) => {
                    try {
                        provider.identify(userId, traits);
                    } catch (error) {
                        reportError(error, '[Analytics] Identify failed:');
                    }
                });

            if (!initialized) pendingOperations.push(operation);
            else operation();
        },

        track<Event extends AnalyticsEventName>(
            event: Event,
            properties?: AnalyticsEventMap[Event],
        ) {
            if (!enabled) return;

            const eventProperties = { ...(properties ?? {}), ...context };
            log('Track:', event, eventProperties);

            const operation = () =>
                providers.forEach((provider) => {
                    try {
                        provider.track(event, eventProperties);
                    } catch (error) {
                        reportError(error, '[Analytics] Track failed:');
                    }
                });

            if (!initialized) pendingOperations.push(operation);
            else operation();
        },

        screen(screenName: AnalyticsScreenName) {
            if (!enabled) return;

            const screenProperties = { ...context };
            log('Screen:', screenName, screenProperties);

            const operation = () =>
                providers.forEach((provider) => {
                    try {
                        provider.screen(screenName, screenProperties);
                    } catch (error) {
                        reportError(error, '[Analytics] Screen failed:');
                    }
                });

            if (!initialized) pendingOperations.push(operation);
            else operation();
        },

        reset() {
            if (!enabled) return;

            log('Reset');

            providers.forEach((provider) => {
                try {
                    provider.reset();
                } catch (error) {
                    reportError(error, '[Analytics] Reset failed:');
                }
            });
        },

        setUserProperties(properties: Record<string, any>) {
            if (!enabled) return;

            log('Set user properties:', properties);

            providers.forEach((provider) => {
                try {
                    provider.setUserProperties?.(properties);
                } catch (error) {
                    reportError(error, '[Analytics] Set user properties failed:');
                }
            });
        },

        async isFeatureEnabled(flag: string): Promise<boolean> {
            if (!enabled) return false;

            log('Check feature flag:', flag);

            for (const provider of providers) {
                if (provider.isFeatureEnabled) {
                    try {
                        return await provider.isFeatureEnabled(flag);
                    } catch (error) {
                        reportError(error, '[Analytics] Feature flag check failed:');
                    }
                }
            }

            return false;
        },

        group(groupType: string, groupId: string, traits?: Record<string, any>) {
            if (!enabled) return;

            log('Group:', groupType, groupId, traits);

            providers.forEach((provider) => {
                try {
                    provider.group?.(groupType, groupId, traits);
                } catch (error) {
                    reportError(error, '[Analytics] Group failed:');
                }
            });
        },
    };
};

export type AnalyticsManager = ReturnType<typeof createAnalyticsManager>;
