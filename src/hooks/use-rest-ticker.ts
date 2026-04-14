import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAppState } from './use-app-state';

export const useRestTicker = (active: boolean, intervalMs: number = 1000) => {
    const [nowMs, setNowMs] = useState<number>(Date.now());
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        if (!active) {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            return;
        }

        setNowMs(Date.now());

        if (!timerRef.current) {
            timerRef.current = setInterval(() => {
                setNowMs(Date.now());
            }, intervalMs) as unknown as number;
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [active, intervalMs]);

    const handleForeground = useCallback(() => {
        if (!active) return;
        setNowMs(Date.now());
    }, [active]);

    const appStateCallbacks = useMemo(
        () => ({ onForeground: handleForeground }),
        [handleForeground],
    );

    useAppState(appStateCallbacks);

    return { nowMs } as const;
};
