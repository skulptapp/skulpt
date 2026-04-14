/**
 * Unified analytics types for the application
 */

/**
 * Base analytics provider interface
 */
export interface IAnalyticsProvider {
    /**
     * Initialize the analytics provider
     */
    initialize(): Promise<void>;

    /**
     * Identify a user
     */
    identify(userId: string, traits?: Record<string, any>): void;

    /**
     * Track an event
     */
    track(event: string, properties?: Record<string, any>): void;

    /**
     * Track a screen view
     */
    screen(screenName: string, properties?: Record<string, any>): void;

    /**
     * Reset user identification (on logout)
     */
    reset(): void;

    /**
     * Set user properties
     */
    setUserProperties?(properties: Record<string, any>): void;

    /**
     * Check if a feature flag is enabled
     */
    isFeatureEnabled?(flag: string): Promise<boolean>;

    /**
     * Group identification (for teams/organizations)
     */
    group?(groupType: string, groupId: string, traits?: Record<string, any>): void;
}

/**
 * Analytics manager configuration
 */
export interface IAnalyticsConfig {
    /**
     * List of analytics providers to use
     */
    providers: IAnalyticsProvider[];

    /**
     * Whether analytics is enabled
     */
    enabled?: boolean;

    /**
     * Debug mode
     */
    debug?: boolean;
}

/**
 * User traits for identification
 */
export interface IUserTraits {
    email?: string;
    name?: string;
    [key: string]: any;
}
