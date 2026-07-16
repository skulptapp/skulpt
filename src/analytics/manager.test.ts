import { describe, expect, jest, test } from '@jest/globals';

import { IAnalyticsProvider } from './types';
import { createAnalyticsManager } from './manager';

jest.mock('@/services/error-reporting', () => ({
    reportError: jest.fn(),
}));

const createProvider = (initialize: () => Promise<void>): IAnalyticsProvider => ({
    initialize: jest.fn(initialize),
    identify: jest.fn(),
    track: jest.fn(),
    screen: jest.fn(),
    reset: jest.fn(),
});

describe('analytics manager', () => {
    test('queues identify, event, and screen calls until providers are initialized', async () => {
        let resolveInitialization: () => void = () => undefined;
        const provider = createProvider(
            () =>
                new Promise<void>((resolve) => {
                    resolveInitialization = resolve;
                }),
        );
        const manager = createAnalyticsManager({
            providers: [provider],
            context: {
                environment: 'production',
                platform: 'ios',
            },
        });

        const initialization = manager.initialize();
        manager.identify('user-1', { language: 'en' });
        manager.track('app:share_requested', { surface: 'settings' });
        manager.screen('settings');

        expect(provider.identify).not.toHaveBeenCalled();
        expect(provider.track).not.toHaveBeenCalled();
        expect(provider.screen).not.toHaveBeenCalled();

        resolveInitialization();
        await initialization;

        expect(provider.identify).toHaveBeenCalledWith('user-1', { language: 'en' });
        expect(provider.track).toHaveBeenCalledWith('app:share_requested', {
            surface: 'settings',
            environment: 'production',
            platform: 'ios',
        });
        expect(provider.screen).toHaveBeenCalledWith('settings', {
            environment: 'production',
            platform: 'ios',
        });
    });

    test('does not call providers when analytics is disabled', async () => {
        const provider = createProvider(async () => undefined);
        const manager = createAnalyticsManager({ providers: [provider], enabled: false });

        await manager.initialize();
        manager.track('app:share_requested', { surface: 'settings' });
        manager.screen('settings');
        manager.identify('user-1');

        expect(provider.initialize).not.toHaveBeenCalled();
        expect(provider.track).not.toHaveBeenCalled();
        expect(provider.screen).not.toHaveBeenCalled();
        expect(provider.identify).not.toHaveBeenCalled();
    });
});
