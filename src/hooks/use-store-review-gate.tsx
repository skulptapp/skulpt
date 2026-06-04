import {
    createContext,
    FC,
    PropsWithChildren,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

type StoreReviewGateContext = {
    activeBlockersCount: number;
    registerBlocker: (key: string) => void;
    unregisterBlocker: (key: string) => void;
};

const storeReviewGateContext = createContext<StoreReviewGateContext | null>(null);

export const StoreReviewGateProvider: FC<PropsWithChildren> = ({ children }) => {
    const [blockers, setBlockers] = useState<Set<string>>(() => new Set());

    const registerBlocker = useCallback((key: string) => {
        setBlockers((current) => {
            if (current.has(key)) return current;
            const next = new Set(current);
            next.add(key);
            return next;
        });
    }, []);

    const unregisterBlocker = useCallback((key: string) => {
        setBlockers((current) => {
            if (!current.has(key)) return current;
            const next = new Set(current);
            next.delete(key);
            return next;
        });
    }, []);

    const value = useMemo(
        () => ({
            activeBlockersCount: blockers.size,
            registerBlocker,
            unregisterBlocker,
        }),
        [blockers.size, registerBlocker, unregisterBlocker],
    );

    return (
        <storeReviewGateContext.Provider value={value}>{children}</storeReviewGateContext.Provider>
    );
};

export const useStoreReviewGate = () => {
    const context = useContext(storeReviewGateContext);
    if (!context) {
        throw new Error('useStoreReviewGate must be used within StoreReviewGateProvider');
    }
    return context;
};

export const useStoreReviewGateBlocker = (key: string, active: boolean) => {
    const context = useContext(storeReviewGateContext);
    const registerBlocker = context?.registerBlocker;
    const unregisterBlocker = context?.unregisterBlocker;
    const registeredRef = useRef(false);

    useEffect(() => {
        if (!registerBlocker || !unregisterBlocker) return;

        if (!active) {
            if (registeredRef.current) {
                unregisterBlocker(key);
                registeredRef.current = false;
            }
            return;
        }

        registerBlocker(key);
        registeredRef.current = true;
        return () => {
            unregisterBlocker(key);
            registeredRef.current = false;
        };
    }, [active, key, registerBlocker, unregisterBlocker]);
};
