import axios, { isAxiosError } from 'axios';

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

const authApiClient = axios.create({
    baseURL: process.env.EXPO_PUBLIC_SYNC_HOST,
    timeout: 10_000,
    headers: { 'Content-Type': 'application/json' },
});

/**
 * Returns the persistent device identifier.
 * Generated with nanoid on first call and stored in MMKV.
 * Survives app restarts; cleared on uninstall.
 */
export const getDeviceId = (): string => {
    let id = storage.getString(STORAGE_KEYS.deviceId);
    if (!id) {
        id = nanoid();
        storage.set(STORAGE_KEYS.deviceId, id);
    }
    return id;
};

/** Returns the raw JWT string from MMKV, or null if absent. */
export const getStoredToken = (): string | null => {
    return storage.getString(STORAGE_KEYS.token) ?? null;
};

/**
 * Returns true when a token is present AND will not expire
 * within the next REFRESH_THRESHOLD_MS milliseconds.
 */
export const isTokenValid = (): boolean => {
    const token = storage.getString(STORAGE_KEYS.token);
    const expiresAt = storage.getNumber(STORAGE_KEYS.expiresAt);
    if (!token || !expiresAt) return false;
    return expiresAt - Date.now() > REFRESH_THRESHOLD_MS;
};

const storeToken = (token: string, expiresAt: number): void => {
    storage.set(STORAGE_KEYS.token, token);
    storage.set(STORAGE_KEYS.expiresAt, expiresAt);
};

/**
 * Remove the stored token — called after receiving a 401 so the next
 * ensureValidToken() call will re-bootstrap cleanly.
 */
export const clearToken = (): void => {
    storage.remove(STORAGE_KEYS.token);
    storage.remove(STORAGE_KEYS.expiresAt);
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
        storage.set(STORAGE_KEYS.userId, userId);
        return true;
    } catch (error) {
        const isTransient =
            isAxiosError(error) &&
            !error.response &&
            (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK');
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
    const userId = storage.getString(STORAGE_KEYS.userId);
    if (!userId) return;
    await bootstrapAuth(userId);
};
