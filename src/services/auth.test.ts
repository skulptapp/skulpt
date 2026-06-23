import { describe, expect, jest, test, beforeEach } from '@jest/globals';

const mockPost = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockReportError = jest.fn();
const mockNanoid = jest.fn<() => string>();
const storageValues = new Map<string, string | number>();
const mockStorage = {
    getString: jest.fn((key: string) => {
        const value = storageValues.get(key);
        return typeof value === 'string' ? value : undefined;
    }),
    getNumber: jest.fn((key: string) => {
        const value = storageValues.get(key);
        return typeof value === 'number' ? value : undefined;
    }),
    set: jest.fn((key: string, value: string | number) => {
        storageValues.set(key, value);
    }),
    remove: jest.fn((key: string) => {
        storageValues.delete(key);
    }),
};

jest.mock('axios', () => ({
    create: jest.fn(() => ({
        post: (...args: unknown[]) => mockPost(...args),
    })),
    isAxiosError: (error: unknown) =>
        typeof error === 'object' &&
        error !== null &&
        (error as { isAxiosError?: boolean }).isAxiosError === true,
}));

jest.mock('@/helpers/nanoid', () => ({
    nanoid: () => mockNanoid(),
}));

jest.mock('@/services/error-reporting', () => ({
    reportError: (...args: unknown[]) => mockReportError(...args),
}));

jest.mock('@/storage', () => ({
    storage: mockStorage,
}));

const loadAuthModule = () => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./auth') as typeof import('./auth');
};

describe('auth storage fallback', () => {
    beforeEach(() => {
        process.env.EXPO_PUBLIC_SYNC_HOST = 'https://api.example.test';
        storageValues.clear();
        mockPost.mockReset();
        mockReportError.mockReset();
        mockNanoid.mockReset();
        mockStorage.getString.mockClear();
        mockStorage.getNumber.mockClear();
        mockStorage.set.mockClear();
        mockStorage.remove.mockClear();
    });

    test('keeps a generated device id in memory when MMKV cannot write', () => {
        mockNanoid.mockReturnValue('device-1');
        mockStorage.set.mockImplementation(() => {
            throw new Error('MMKV write failed');
        });

        const { getDeviceId } = loadAuthModule();

        expect(getDeviceId()).toBe('device-1');
        expect(getDeviceId()).toBe('device-1');
        expect(mockNanoid).toHaveBeenCalledTimes(1);
    });

    test('bootstraps auth with in-memory token fallback when MMKV writes fail', async () => {
        mockNanoid.mockReturnValue('device-1');
        mockStorage.set.mockImplementation(() => {
            throw new Error('MMKV write failed');
        });
        mockPost.mockResolvedValue({
            data: {
                token: 'token-1',
                expiresAt: Date.now() + 10 * 60_000,
            },
        });

        const { bootstrapAuth, getStoredAuthUserId, getStoredToken, isTokenValid } =
            loadAuthModule();

        await expect(bootstrapAuth('user-1')).resolves.toBe(true);
        expect(mockPost).toHaveBeenCalledWith('/auth/token', {
            userId: 'user-1',
            deviceId: 'device-1',
        });
        expect(getStoredToken()).toBe('token-1');
        expect(getStoredAuthUserId()).toBe('user-1');
        expect(isTokenValid()).toBe(true);
        expect(mockReportError).not.toHaveBeenCalled();
    });
});
