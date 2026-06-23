import { create as createAxios, isAxiosError } from 'axios';

import { nanoid } from '@/helpers/nanoid';
import { reportError } from '@/services/error-reporting';
import { storage } from '@/storage';

const STORAGE_KEYS = {
    /** Permanent device identifier — generated once, persists until app uninstall. */
    deviceId: 'auth.deviceId',
    /** Current JWT string. */
    token: 'auth.token',
    /** Token expiry in Unix milliseconds. */
    expiresAt: 'auth.expiresAt',
    /** userId of the last successfully bootstrapped user — used for mid-session refresh. */
    userId: 'auth.userId',
} as const;

/** Re-bootstrap when less than 5 minutes remain on the token. */
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;
const memoryAuthStorage = new Map<string, string | number>();

const authApiClient = createAxios({
    baseURL: process.env.EXPO_PUBLIC_SYNC_HOST,
    timeout: 10_000,
    headers: { 'Content-Type': 'application/json' },
});

const getMemoryString = (key: string): string | null => {
    const value = memoryAuthStorage.get(key);
    return typeof value === 'string' ? value : null;
};

const getMemoryNumber = (key: string): number | null => {
    const value = memoryAuthStorage.get(key);
    return typeof value === 'number' ? value : null;
};

const getAuthString = (key: string): string | null => {
    try {
        return storage.getString(key) ?? getMemoryString(key);
    } catch {
        return getMemoryString(key);
    }
};

const getAuthNumber = (key: string): number | null => {
    try {
        return storage.getNumber(key) ?? getMemoryNumber(key);
    } catch {
        return getMemoryNumber(key);
    }
};

const setAuthValue = (key: string, value: string | number): void => {
    memoryAuthStorage.set(key, value);
    try {
        storage.set(key, value);
    } catch {
        // Keep auth functional for the current launch even if MMKV cannot persist.
    }
};

const removeAuthValue = (key: string): void => {
    memoryAuthStorage.delete(key);
    try {
        storage.remove(key);
    } catch {
        // Best effort cleanup; missing persistence should not break auth flow.
    }
};

/**
 * Returns the persistent device identifier.
 * Generated with nanoid on first call and stored in MMKV.
 * Survives app restarts; cleared on uninstall.
 */
export const getDeviceId = (): string => {
    let id = getAuthString(STORAGE_KEYS.deviceId);
    if (!id) {
        id = nanoid();
        setAuthValue(STORAGE_KEYS.deviceId, id);
    }
    return id;
};

/** Returns the raw JWT string from MMKV, or null if absent. */
export const getStoredToken = (): string | null => {
    return getAuthString(STORAGE_KEYS.token);
};

/**
 * Returns true when a token is present AND will not expire
 * within the next REFRESH_THRESHOLD_MS milliseconds.
 */
export const isTokenValid = (): boolean => {
    const token = getAuthString(STORAGE_KEYS.token);
    const expiresAt = getAuthNumber(STORAGE_KEYS.expiresAt);
    if (!token || !expiresAt) return false;
    return expiresAt - Date.now() > REFRESH_THRESHOLD_MS;
};

const storeToken = (token: string, expiresAt: number): void => {
    setAuthValue(STORAGE_KEYS.token, token);
    setAuthValue(STORAGE_KEYS.expiresAt, expiresAt);
};

/**
 * Remove the stored token — called after receiving a 401 so the next
 * ensureValidToken() call will re-bootstrap cleanly.
 */
export const clearToken = (): void => {
    removeAuthValue(STORAGE_KEYS.token);
    removeAuthValue(STORAGE_KEYS.expiresAt);
};

export const getStoredAuthUserId = (): string | null => {
    return getAuthString(STORAGE_KEYS.userId);
};

/**
 * Request a fresh JWT from the server for the given userId + deviceId.
 * Stores the returned token in MMKV on success.
 * Returns true if the token was obtained and stored.
 */
export const bootstrapAuth = async (userId: string): Promise<boolean> => {
    if (!process.env.EXPO_PUBLIC_SYNC_HOST) return false;

    try {
        const deviceId = getDeviceId();
        const response = await authApiClient.post<{ token: string; expiresAt: number }>(
            '/auth/token',
            { userId, deviceId },
        );
        storeToken(response.data.token, response.data.expiresAt);
        setAuthValue(STORAGE_KEYS.userId, userId);
        return true;
    } catch (error) {
        const isTransient =
            isAxiosError(error) &&
            !error.response &&
            (error.code === 'ECONNABORTED' ||
                error.code === 'ERR_NETWORK' ||
                error.code === 'ERR_CANCELED' ||
                error.message === 'Network Error');
        if (!isTransient) {
            reportError(error, '[auth] bootstrapAuth failed:', {
                tags: { scope: 'auth' },
            });
        }
        return false;
    }
};

/**
 * Ensure a valid token is available for the given userId.
 * If the token is missing or expiring soon, re-bootstraps transparently.
 * Returns the token string on success, or null if the server is unreachable.
 */
export const ensureValidToken = async (userId: string): Promise<string | null> => {
    if (isTokenValid()) return getStoredToken();
    const ok = await bootstrapAuth(userId);
    return ok ? getStoredToken() : null;
};

/**
 * Refresh the token if it is missing or expiring soon, using the userId
 * stored during the last successful bootstrap. Safe to call before every
 * sync cycle — exits immediately when the token is still valid.
 */
export const refreshTokenIfNeeded = async (): Promise<void> => {
    if (isTokenValid()) return;
    const userId = getStoredAuthUserId();
    if (!userId) return;
    await bootstrapAuth(userId);
};
