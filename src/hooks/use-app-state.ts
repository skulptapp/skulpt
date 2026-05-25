import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

export interface AppStateCallbacks {
    onForeground?: () => void;
    onBackground?: () => void;
    onChange?: (prevState: AppStateStatus, nextState: AppStateStatus) => void;
}

/**
 * Custom hook that tracks the app's foreground/background state
 * and triggers actions when the state changes.
 *
 * @param callbacks - Optional callbacks for different state transitions
 * @returns Object containing current app state and helper functions
 */
export const useAppState = (callbacks?: AppStateCallbacks) => {
    const [appStateSnapshot, setAppStateSnapshot] = useState<{
        current: AppStateStatus;
        previous: AppStateStatus;
    }>({
        current: AppState.currentState,
        previous: AppState.currentState,
    });
    const prevAppStateRef = useRef<AppStateStatus>(AppState.currentState);

    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            const prevState = prevAppStateRef.current;

            // Update previous state reference
            prevAppStateRef.current = nextAppState;

            // Update state
            setAppStateSnapshot({
                current: nextAppState,
                previous: prevState,
            });

            // Trigger specific callbacks based on transition
            if (
                prevState === 'background' &&
                nextAppState === 'active' &&
                callbacks?.onForeground
            ) {
                callbacks.onForeground();
            } else if (
                prevState === 'active' &&
                nextAppState === 'background' &&
                callbacks?.onBackground
            ) {
                callbacks.onBackground();
            } else if (
                prevState === 'inactive' &&
                nextAppState === 'active' &&
                callbacks?.onForeground
            ) {
                callbacks.onForeground();
            } else if (
                prevState === 'active' &&
                nextAppState === 'inactive' &&
                callbacks?.onBackground
            ) {
                callbacks.onBackground();
            }

            // Call the general change callback if provided
            if (callbacks?.onChange) {
                callbacks.onChange(prevState, nextAppState);
            }
        };

        // Add event listener
        const subscription = AppState.addEventListener('change', handleAppStateChange);

        // Cleanup function to remove the event listener
        return () => {
            subscription?.remove();
        };
    }, [callbacks]);

    /**
     * Check if the app is currently in the foreground
     */
    const appState = appStateSnapshot.current;
    const prevAppState = appStateSnapshot.previous;

    const isInForeground = appState === 'active';

    /**
     * Check if the app is currently in the background
     */
    const isInBackground = appState === 'background' || appState === 'inactive';

    /**
     * Check if the app just entered the foreground
     */
    const didEnterForeground = prevAppState !== 'active' && appState === 'active';

    /**
     * Check if the app just entered the background
     */
    const didEnterBackground =
        prevAppState === 'active' && (appState === 'background' || appState === 'inactive');

    return {
        appState,
        isInForeground,
        isInBackground,
        didEnterForeground,
        didEnterBackground,
        prevAppState,
    };
};
