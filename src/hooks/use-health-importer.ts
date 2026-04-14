import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import type { UserSelect } from '@/db/schema';
import { importLatestHealthForUser } from '@/services/health-importer';
import { reportError } from '@/services/error-reporting';
import { getPendingSyncOperationsCount } from '@/crud/sync';

const INITIAL_DELAY_MS = 2_000;
const BACKGROUND_DELAY_MS = 20_000;
const IDLE_DELAY_MS = 2 * 60 * 60 * 1000;
const CHANGED_DELAY_MS = 25 * 60 * 1000;
const MISSING_PERMISSION_DELAY_MS = 6 * 60 * 60 * 1000;
const ERROR_DELAY_MS = 5 * 60 * 1000;
const IDLE_CALLBACK_TIMEOUT_MS = 2_000;
const SYNC_BACKLOG_DELAY_MS = 30 * 60 * 1000;
const MAX_PENDING_SYNC_BEFORE_IMPORT = 750;

type IdleAPI = {
    requestIdleCallback?: (cb: IdleRequestCallback, options?: IdleRequestOptions) => number;
    cancelIdleCallback?: (handle: number) => void;
};

export const useHealthImporter = (user: Pick<UserSelect, 'id'> | undefined): void => {
    const queryClient = useQueryClient();
    const userIdRef = useRef<string | undefined>(user?.id);
    const runningRef = useRef(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const idleHandleRef = useRef<number | null>(null);
    const cancelledRef = useRef(false);

    useEffect(() => {
        userIdRef.current = user?.id;
    }, [user?.id]);

    useEffect(() => {
        cancelledRef.current = false;

        const clearTimer = () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };

        const clearIdleHandle = () => {
            if (idleHandleRef.current == null) return;

            const idleApi = globalThis as typeof globalThis & IdleAPI;
            if (typeof idleApi.cancelIdleCallback === 'function') {
                idleApi.cancelIdleCallback(idleHandleRef.current);
            }
            idleHandleRef.current = null;
        };

        const runTickOnIdle = () => {
            const idleApi = globalThis as typeof globalThis & IdleAPI;

            if (typeof idleApi.requestIdleCallback === 'function') {
                idleHandleRef.current = idleApi.requestIdleCallback(
                    () => {
                        idleHandleRef.current = null;
                        void tick();
                    },
                    { timeout: IDLE_CALLBACK_TIMEOUT_MS },
                );
                return;
            }

            void tick();
        };

        const schedule = (delayMs: number) => {
            if (cancelledRef.current) return;
            clearTimer();
            clearIdleHandle();
            timerRef.current = setTimeout(() => {
                runTickOnIdle();
            }, delayMs);
        };

        const tick = async () => {
            if (cancelledRef.current || runningRef.current) return;

            const userId = userIdRef.current;
            if (!userId) {
                schedule(IDLE_DELAY_MS);
                return;
            }

            if (AppState.currentState !== 'active') {
                schedule(BACKGROUND_DELAY_MS);
                return;
            }

            runningRef.current = true;

            try {
                const pendingSyncCount = await getPendingSyncOperationsCount();
                if (pendingSyncCount >= MAX_PENDING_SYNC_BEFORE_IMPORT) {
                    schedule(SYNC_BACKLOG_DELAY_MS);
                    return;
                }

                const result = await importLatestHealthForUser(userId);

                if (result.importedCount > 0) {
                    queryClient.invalidateQueries({ queryKey: ['measurements'] });
                }

                if (!result.permissionGranted) {
                    schedule(MISSING_PERMISSION_DELAY_MS);
                } else if (result.importedCount > 0) {
                    schedule(CHANGED_DELAY_MS);
                } else {
                    schedule(IDLE_DELAY_MS);
                }
            } catch (error) {
                reportError(error, 'Health importer tick failed:');
                schedule(ERROR_DELAY_MS);
            } finally {
                runningRef.current = false;
            }
        };

        schedule(INITIAL_DELAY_MS);

        const appStateSubscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') {
                schedule(INITIAL_DELAY_MS);
            }
        });

        return () => {
            cancelledRef.current = true;
            clearTimer();
            clearIdleHandle();
            appStateSubscription.remove();
        };
    }, [queryClient]);
};
