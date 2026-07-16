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

import { performSync, getSyncStats } from '@/sync';
import { reportError, runInBackground } from '@/services/error-reporting';
import { isSyncEnabled } from '@/sync/config';
import { refreshTokenIfNeeded } from '@/services/auth';
import { queryClient } from '@/queries';
import { useAppState } from '@/hooks/use-app-state';
import { useAnalytics } from '@/hooks/use-analytics';
import { storage } from '@/storage';

type SyncTrigger = 'initial' | 'scheduled' | 'deferred' | 'manual';

interface SyncState {
    isSyncing: boolean;
    lastSyncTime: Date | null;
    pendingCount: number;
}

interface SyncContextValue extends SyncState {
    isOnline: boolean;
    sync: (trigger?: SyncTrigger) => Promise<boolean>;
}

const MIN_SYNC_INTERVAL_MS = 30_000;
const DEFERRED_SYNC_DELAY_MS = 30_000;
const FAILURE_BACKOFF_BASE_MS = 30_000;
const FAILURE_BACKOFF_MAX_MS = 10 * 60 * 1000;
const HAS_COMPLETED_FIRST_SYNC_KEY = 'analytics.hasCompletedFirstSync';

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
    const syncInFlightRef = useRef(false);
    const lastSyncOutcomeRef = useRef<'success' | 'failure' | null>(null);
    const { track, isEnabled: isAnalyticsEnabled } = useAnalytics();

    const networkState = useNetworkState();
    const { isInForeground } = useAppState();

    const isOnline = Boolean(networkState.isConnected && networkState.isInternetReachable);

    const getSyncBackoffMs = useCallback(() => {
        if (failedSyncAttemptsRef.current <= 0) {
            return MIN_SYNC_INTERVAL_MS;
        }

        const backoff = FAILURE_BACKOFF_BASE_MS * 2 ** (failedSyncAttemptsRef.current - 1);
        return Math.min(FAILURE_BACKOFF_MAX_MS, backoff);
    }, []);

    const trackSyncResult = useCallback(
        (
            args: {
                outcome: 'success' | 'failure';
                trigger: SyncTrigger;
                durationMs: number;
                pendingBefore: number;
                pendingAfter: number;
            },
            hadPreviousSuccess: boolean,
        ) => {
            if (!isAnalyticsEnabled) return;

            if (
                !storage.getBoolean(HAS_COMPLETED_FIRST_SYNC_KEY) &&
                (hadPreviousSuccess || args.outcome === 'success')
            ) {
                storage.set(HAS_COMPLETED_FIRST_SYNC_KEY, true);
                if (args.outcome === 'success' && !hadPreviousSuccess) {
                    track('sync:first_success', {
                        trigger: args.trigger,
                        durationMs: args.durationMs,
                        pendingBefore: args.pendingBefore,
                        pendingAfter: args.pendingAfter,
                    });
                }
            }

            if (lastSyncOutcomeRef.current !== args.outcome) {
                lastSyncOutcomeRef.current = args.outcome;
                track('sync:state_changed', args);
            }
        },
        [isAnalyticsEnabled, track],
    );

    const sync = useCallback(
        async (trigger: SyncTrigger = 'manual') => {
            if (syncInFlightRef.current || state.isSyncing || !isOnline) {
                return false;
            }

            const now = Date.now();
            const elapsedSinceLastAttempt = now - lastSyncAttemptAtRef.current;
            const requiredDelay = getSyncBackoffMs();

            if (lastSyncAttemptAtRef.current > 0 && elapsedSinceLastAttempt < requiredDelay) {
                return false;
            }

            lastSyncAttemptAtRef.current = now;
            syncInFlightRef.current = true;
            const startedAt = Date.now();
            let pendingBefore = state.pendingCount;
            let hadPreviousSuccess = false;

            setState((prev) => ({ ...prev, isSyncing: true }));

            try {
                const beforeStats = await getSyncStats();
                pendingBefore = beforeStats.pendingCount;
                hadPreviousSuccess =
                    beforeStats.lastSyncTime != null && beforeStats.lastSyncTime.getTime() > 0;
                await refreshTokenIfNeeded();

                const success = await performSync();
                failedSyncAttemptsRef.current = success ? 0 : failedSyncAttemptsRef.current + 1;

                if (success) {
                    queryClient.invalidateQueries({ queryKey: ['exercises-list'] });
                }

                const stats = await getSyncStats();

                trackSyncResult(
                    {
                        outcome: success ? 'success' : 'failure',
                        trigger,
                        durationMs: Math.max(0, Date.now() - startedAt),
                        pendingBefore,
                        pendingAfter: stats.pendingCount,
                    },
                    hadPreviousSuccess,
                );

                setState((prev) => ({
                    ...prev,
                    isSyncing: false,
                    lastSyncTime: stats.lastSyncTime,
                    pendingCount: stats.pendingCount,
                }));

                return success;
            } catch (error) {
                failedSyncAttemptsRef.current += 1;
                let pendingAfter = pendingBefore;
                try {
                    pendingAfter = (await getSyncStats()).pendingCount;
                } catch (statsError) {
                    reportError(statsError, 'Failed to read sync stats after sync failure:');
                }
                trackSyncResult(
                    {
                        outcome: 'failure',
                        trigger,
                        durationMs: Math.max(0, Date.now() - startedAt),
                        pendingBefore,
                        pendingAfter,
                    },
                    hadPreviousSuccess,
                );
                reportError(error, 'Failed to perform sync:');
                return false;
            } finally {
                syncInFlightRef.current = false;
                setState((prev) =>
                    prev.isSyncing
                        ? {
                              ...prev,
                              isSyncing: false,
                          }
                        : prev,
                );
            }
        },
        [getSyncBackoffMs, isOnline, state.isSyncing, state.pendingCount, trackSyncResult],
    );

    useEffect(() => {
        if (isOnline && !state.isSyncing && state.pendingCount > 0) {
            if (syncTimeoutRef.current) {
                clearTimeout(syncTimeoutRef.current);
                syncTimeoutRef.current = null;
            }
            syncTimeoutRef.current = setTimeout(() => {
                runInBackground(() => sync('deferred'), 'Failed to run deferred sync:');
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
                    runInBackground(() => sync('scheduled'), 'Failed to run scheduled sync:');
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
        if (isOnline && isInForeground && !hasInitialSyncedRef.current) {
            hasInitialSyncedRef.current = true;
            runInBackground(() => sync('initial'), 'Failed to run initial sync:');
        }
    }, [isOnline, isInForeground, sync]);

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
