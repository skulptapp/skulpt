import axios, { isAxiosError, type InternalAxiosRequestConfig } from 'axios';
import { reportError } from '@/services/error-reporting';
import { bootstrapAuth, clearToken, getStoredToken, isTokenValid } from '@/services/auth';
import { storage } from '@/storage';

interface ApiResponse<T> {
    success: boolean;
    data?: T | null;
    error?: string;
}

interface SendChangesApiResponse {
    success: boolean;
    error?: string;
    status?: number;
    type?: string;
    code?: string;
    table?: string;
    id?: string;
}

interface ServerSyncResponse {
    [table: string]: {
        records: any[];
        deletedIds: string[];
        timestamp: number;
    };
}

interface TableChanges<TCreate = Record<string, unknown>, TUpdate = Record<string, unknown>> {
    created: TCreate[];
    updated: TUpdate[];
    deleted: string[];
}

export interface SyncBatchRequest {
    [table: string]: TableChanges;
}

export type SyncScope = 'all' | 'user' | 'skulpt';

interface GetServerChangesOptions {
    syncType?: SyncScope;
    locale?: string;
}

type AxiosRequestFallback = {
    status?: unknown;
    responseText?: unknown;
    _response?: unknown;
};

type RetryableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

const TRANSIENT_NETWORK_ERRORS = new Set(['NO_INTERNET', 'TIMEOUT']);
const SYNC_SCHEMA_VERSION = '2';

const createSyncClient = () => {
    return axios.create({
        baseURL: process.env.EXPO_PUBLIC_SYNC_HOST,
        timeout: 120000,
        headers: {
            'Content-Type': 'application/json',
            'x-skulpt-sync-schema': SYNC_SCHEMA_VERSION,
        },
    });
};

export const syncClient = createSyncClient();

// Request: attach Bearer token. MMKV reads are synchronous — no async overhead.
syncClient.interceptors.request.use((config) => {
    if (isTokenValid()) {
        const token = getStoredToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

// Response: on 401 immediately re-bootstrap and retry the request once.
// A _retried flag prevents infinite loops if the server keeps rejecting.
syncClient.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
        if (!isAxiosError(error) || error.response?.status !== 401) {
            return Promise.reject(error);
        }

        const config = error.config as RetryableConfig | undefined;
        if (!config || config._retried) {
            return Promise.reject(error);
        }

        config._retried = true;
        clearToken();

        const userId = storage.getString('auth.userId');
        if (!userId) return Promise.reject(error);

        const ok = await bootstrapAuth(userId);
        if (!ok) return Promise.reject(error);

        const newToken = getStoredToken();
        if (!newToken) return Promise.reject(error);

        config.headers.Authorization = `Bearer ${newToken}`;
        return syncClient(config);
    },
);

const resolveErrorCode = (status: number, data: unknown): string => {
    if (typeof data === 'object' && data !== null) {
        const payload = data as Record<string, unknown>;
        if (typeof payload.type === 'string' && payload.type.length > 0) {
            return payload.type.toUpperCase();
        }
    }

    if (status === 422) return 'VALIDATION';
    if (status >= 500) return 'SERVER_ERROR';
    if (status === 404) return 'NOT_FOUND';
    if (status === 403) return 'FORBIDDEN';
    if (status === 401) return 'UNAUTHORIZED';
    if (status === 400) return 'BAD_REQUEST';

    return 'UNKNOWN';
};

const parseFallbackResponse = (value: unknown): unknown => {
    if (typeof value !== 'string') return undefined;
    if (value.length === 0) return null;

    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
};

const getFallbackStatus = (err: {
    status?: unknown;
    request?: AxiosRequestFallback;
}): number | undefined => {
    if (typeof err.status === 'number' && Number.isFinite(err.status) && err.status > 0) {
        return err.status;
    }

    if (
        typeof err.request?.status === 'number' &&
        Number.isFinite(err.request.status) &&
        err.request.status > 0
    ) {
        return err.request.status;
    }

    return undefined;
};

const handleError = (
    err: unknown,
    context?: {
        requestType: 'push' | 'pull';
        payload?: Record<string, unknown>;
    },
): SendChangesApiResponse => {
    let error = 'UNKNOWN';
    let status: number | undefined;
    let data: unknown = null;
    let type: string | undefined;
    let code: string | undefined;
    let table: string | undefined;
    let id: string | undefined;

    if (isAxiosError(err)) {
        const request = err.request as AxiosRequestFallback | undefined;
        const responseText = parseFallbackResponse(request?.responseText);
        const rawResponse = parseFallbackResponse(request?._response);

        status = err.response?.status ?? getFallbackStatus(err);
        data = err.response?.data ?? responseText ?? rawResponse ?? null;

        if (status != null) {
            error = resolveErrorCode(status, data);

            if (typeof data === 'object' && data !== null) {
                const payload = data as Record<string, unknown>;
                if (typeof payload.type === 'string') type = payload.type;
                if (typeof payload.code === 'string') code = payload.code;
                if (typeof payload.table === 'string') table = payload.table;
                if (typeof payload.id === 'string') id = payload.id;
            }
        } else if (err.code === 'ECONNABORTED') {
            error = 'TIMEOUT';
        } else {
            error = 'NO_INTERNET';
        }
    }

    if (!TRANSIENT_NETWORK_ERRORS.has(error)) {
        reportError(err, '[sync-api] Request failed:', {
            extras: {
                requestType: context?.requestType,
                payload: context?.payload,
                resolvedError: error,
                status,
                type,
                code,
                table,
                id,
                data,
            },
            tags: {
                scope: 'sync-api',
            },
        });
    }

    return { success: false, error, status, type, code, table, id };
};

export const getServerChanges = async (
    since: number,
    userId: string,
    options: GetServerChangesOptions = {},
): Promise<ApiResponse<ServerSyncResponse>> => {
    try {
        const response = await syncClient.get('/sync', {
            params: {
                since,
                userId,
                ...(options.syncType ? { type: options.syncType } : {}),
                ...(options.locale ? { locale: options.locale } : {}),
            },
        });
        return { success: true, data: response.data.data };
    } catch (error) {
        return handleError(error, {
            requestType: 'pull',
            payload: {
                since,
                userId,
                type: options.syncType,
                locale: options.locale,
            },
        });
    }
};

export const getSkulptChanges = async (
    since: number,
    userId: string,
    locale: string,
): Promise<ApiResponse<ServerSyncResponse>> => {
    return getServerChanges(since, userId, {
        syncType: 'skulpt',
        locale,
    });
};

export const sendChangesToServer = async (
    changes: SyncBatchRequest,
): Promise<SendChangesApiResponse> => {
    try {
        const response = await syncClient.post('/sync', changes);
        return { ...response.data };
    } catch (error) {
        return handleError(error, {
            requestType: 'push',
            payload: {
                tables: Object.fromEntries(
                    Object.entries(changes).map(([tableName, tableChanges]) => [
                        tableName,
                        {
                            created: tableChanges.created.length,
                            updated: tableChanges.updated.length,
                            deleted: tableChanges.deleted.length,
                        },
                    ]),
                ),
            },
        });
    }
};
