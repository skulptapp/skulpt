import { Platform } from 'react-native';
import { requireNativeModule, EventSubscription } from 'expo-modules-core';
import { LiveActivityState } from '../live-activity';

export interface WatchWorkoutState extends LiveActivityState {
    tracking?: string[];
    distance?: number;
    distanceUnits?: string;
    timeSeconds?: number;
    workoutId?: string;
    currentSetId?: string;
    restSetId?: string;
    nextSetId?: string;
    nextTracking?: string[];
    nextDistance?: number;
    nextDistanceUnits?: string;
    workoutName: string;
    playSounds?: boolean;
    heartRateMhr?: number;
    restTimeSeconds?: number;
    nextTimeOptions?: string;
    nextTimeSeconds?: number;
    nextRestTimeSeconds?: number;
    phoneHealthPermissionsGranted?: boolean;
}

export interface WatchCommandPayload {
    command: string;
    commandId?: string;
    workoutId?: string;
    setId?: string;
    expectedState?: string;
    eventAtMs?: string;
}

type WatchConnectivityEvents = {
    onWatchCommand: (event: WatchCommandPayload) => void;
};

interface WatchConnectivityNativeModule {
    isWatchSupported(): boolean;
    isWatchPaired(): boolean;
    isWatchReachable(): boolean;
    updateWatchContext(state: WatchWorkoutState): Promise<boolean>;
    sendWatchMessage(state: WatchWorkoutState): Promise<boolean>;
    drainPendingWatchCommands(): Promise<WatchCommandPayload[]>;
    ackPendingWatchCommand(commandId: string): Promise<boolean>;
    getCurrentWatchCommand(): WatchCommandPayload | null;
    clearPendingWatchContext(): boolean;
    clearStoredWatchLifecycleCommand(): boolean;
    addListener<K extends keyof WatchConnectivityEvents>(
        eventName: K,
        listener: WatchConnectivityEvents[K],
    ): EventSubscription;
}

const isIOS = Platform.OS === 'ios';

const WatchConnectivityNative = isIOS
    ? requireNativeModule<WatchConnectivityNativeModule>('WatchConnectivity')
    : null;

export function isWatchSupported(): boolean {
    if (!isIOS || !WatchConnectivityNative) return false;
    return WatchConnectivityNative.isWatchSupported();
}

export function isWatchPaired(): boolean {
    if (!isIOS || !WatchConnectivityNative) return false;
    return WatchConnectivityNative.isWatchPaired();
}

export function isWatchReachable(): boolean {
    if (!isIOS || !WatchConnectivityNative) return false;
    return WatchConnectivityNative.isWatchReachable();
}

export async function updateWatchContext(state: WatchWorkoutState): Promise<boolean> {
    if (!isIOS || !WatchConnectivityNative) return false;
    return WatchConnectivityNative.updateWatchContext(state);
}

export async function sendWatchMessage(state: WatchWorkoutState): Promise<boolean> {
    if (!isIOS || !WatchConnectivityNative) return false;
    return WatchConnectivityNative.sendWatchMessage(state);
}

export async function drainPendingWatchCommands(): Promise<WatchCommandPayload[]> {
    if (!isIOS || !WatchConnectivityNative) return [];
    return WatchConnectivityNative.drainPendingWatchCommands();
}

export async function ackPendingWatchCommand(commandId: string): Promise<boolean> {
    if (!isIOS || !WatchConnectivityNative) return false;
    return WatchConnectivityNative.ackPendingWatchCommand(commandId);
}

export function getCurrentWatchCommand(): WatchCommandPayload | null {
    if (!isIOS || !WatchConnectivityNative) return null;
    return WatchConnectivityNative.getCurrentWatchCommand();
}

export function clearPendingWatchContext(): boolean {
    if (!isIOS || !WatchConnectivityNative) return false;
    return WatchConnectivityNative.clearPendingWatchContext();
}

export function clearStoredWatchLifecycleCommand(): boolean {
    if (!isIOS || !WatchConnectivityNative) return false;
    return WatchConnectivityNative.clearStoredWatchLifecycleCommand();
}

export function onWatchCommand(
    listener: (payload: WatchCommandPayload) => void,
): EventSubscription | null {
    if (!isIOS || !WatchConnectivityNative) return null;
    return WatchConnectivityNative.addListener('onWatchCommand', listener);
}
