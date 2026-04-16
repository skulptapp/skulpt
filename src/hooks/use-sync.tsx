import {
    useState,
    useEffect,
    useCallback,
    useRef,
    createContext,
    FC,
    PropsWithChildren,
    useContext,
} from 'react';
import { useNetworkState } from 'expo-network';
import { AppState } from 'react-native';
import { performSync, getSyncStats } from '@/sync';
import { reportError, runInBackground } from '@/services/error-reporting';
import { isSyncEnabled } from '@/sync/config';
import { refreshTokenIfNeeded } from '@/services/auth';
import { queryClient } from '@/queries';

interface SyncState {
    isSyncing: boolean;
    lastSyncTime: Date | null;
    pendingCount: number;
}

interface SyncContextValue extends SyncState {
    isOnline: boolean;
    sync: () => Promise<boolean>;
}

const MIN_SYNC_INTERVAL_MS = 30_000;
const DEFERRED_SYNC_DELAY_MS = 30_000;
const FAILURE_BACKOFF_BASE_MS = 30_000;
const FAILURE_BACKOFF_MAX_MS = 10 * 60 * 1000;

const syncContext = createContext<SyncContextValue>({} as SyncContextValue);

const disabledSyncValue: SyncContextValue = {
    isSyncing: false,
    lastSyncTime: null,
    pendingCount: 0,
    isOnline: false,
    sync: async () => false,
};

const SyncProviderEnabled: FC<PropsWithChildren> = ({ children }) => {
    const sync = useSyncProvider();

    return <syncContext.Provider value={sync}>{children}</syncContext.Provider>;
};

const SyncProvider: FC<PropsWithChildren> = ({ children }) => {
    if (!isSyncEnabled()) {
        return <syncContext.Provider value={disabledSyncValue}>{children}</syncContext.Provider>;
    }

    return <SyncProviderEnabled>{children}</SyncProviderEnabled>;
};

const useSync = () => {
    return useContext(syncContext);
};

const useSyncProvider = () => {
    const [state, setState] = useState<SyncState>({
        isSyncing: false,
        lastSyncTime: null,
        pendingCount: 0,
    });

    const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSyncAttemptAtRef = useRef(0);
    const failedSyncAttemptsRef = useRef(0);
    const hasInitialSyncedRef = useRef(false);

    const networkState = useNetworkState();

    const isOnline = Boolean(networkState.isConnected && networkState.isInternetReachable);

    const getSyncBackoffMs = useCallback(() => {
        if (failedSyncAttemptsRef.current <= 0) {
            return MIN_SYNC_INTERVAL_MS;
        }

        const backoff = FAILURE_BACKOFF_BASE_MS * 2 ** (failedSyncAttemptsRef.current - 1);
        return Math.min(FAILURE_BACKOFF_MAX_MS, backoff);
    }, []);

    const sync = useCallback(async () => {
        if (state.isSyncing || !isOnline) {
            return false;
        }

        const now = Date.now();
        const elapsedSinceLastAttempt = now - lastSyncAttemptAtRef.current;
        const requiredDelay = getSyncBackoffMs();

        if (lastSyncAttemptAtRef.current > 0 && elapsedSinceLastAttempt < requiredDelay) {
            return false;
        }

        lastSyncAttemptAtRef.current = now;

        setState((prev) => ({ ...prev, isSyncing: true }));

        try {
            await refreshTokenIfNeeded();

            const success = await performSync();
            failedSyncAttemptsRef.current = success ? 0 : failedSyncAttemptsRef.current + 1;

            if (success) {
                queryClient.invalidateQueries({ queryKey: ['exercises-list'] });
            }

            const stats = await getSyncStats();

            setState((prev) => ({
                ...prev,
                isSyncing: false,
                lastSyncTime: stats.lastSyncTime,
                pendingCount: stats.pendingCount,
            }));

            return success;
        } catch (error) {
            failedSyncAttemptsRef.current += 1;
            setState((prev) => ({ ...prev, isSyncing: false }));
            reportError(error, 'Failed to perform sync:');
            return false;
        }
    }, [getSyncBackoffMs, isOnline, state.isSyncing]);

    useEffect(() => {
        if (isOnline && !state.isSyncing && state.pendingCount > 0) {
            if (syncTimeoutRef.current) {
                clearTimeout(syncTimeoutRef.current);
                syncTimeoutRef.current = null;
            }
            syncTimeoutRef.current = setTimeout(() => {
                runInBackground(sync, 'Failed to run deferred sync:');
            }, DEFERRED_SYNC_DELAY_MS);
        }

        return () => {
            if (syncTimeoutRef.current) {
                clearTimeout(syncTimeoutRef.current);
                syncTimeoutRef.current = null;
            }
        };
    }, [isOnline, state.isSyncing, state.pendingCount, sync]);

    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const stats = await getSyncStats();
                setState((prev) => ({
                    ...prev,
                    pendingCount: stats.pendingCount,
                }));
                // запускаем sync даже при нуле локальных изменений для pull'а с сервера
                if (isOnline && !state.isSyncing) {
                    runInBackground(sync, 'Failed to run scheduled sync:');
                }
            } catch (error) {
                reportError(error, 'Failed to poll sync stats:');
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [isOnline, state.isSyncing, sync]);

    useEffect(() => {
        const loadStats = async () => {
            try {
                const stats = await getSyncStats();
                setState((prev) => ({
                    ...prev,
                    lastSyncTime: stats.lastSyncTime,
                    pendingCount: stats.pendingCount,
                }));
            } catch (error) {
                reportError(error, 'Failed to load sync stats:');
            }
        };

        runInBackground(loadStats, 'Failed to load initial sync stats:');
    }, []);

    useEffect(() => {
        const tryInitialSync = () => {
            if (isOnline && AppState.currentState === 'active' && !hasInitialSyncedRef.current) {
                hasInitialSyncedRef.current = true;
                runInBackground(sync, 'Failed to run initial sync:');
            }
        };

        tryInitialSync();

        const subscription = AppState.addEventListener('change', tryInitialSync);
        return () => subscription.remove();
    }, [isOnline, sync]);

    useEffect(() => {
        if (!state.isSyncing) {
            const updateStats = async () => {
                try {
                    const stats = await getSyncStats();
                    setState((prev) => ({
                        ...prev,
                        pendingCount: stats.pendingCount,
                    }));
                } catch (error) {
                    reportError(error, 'Failed to refresh sync stats:');
                }
            };

            const statsTimeout = setTimeout(updateStats, 500);
            return () => clearTimeout(statsTimeout);
        }
    }, [state.isSyncing]);

    return {
        ...state,
        isOnline,
        sync,
    };
};

export { useSync, SyncProvider };
