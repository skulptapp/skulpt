import { Platform } from 'react-native';
import { requireNativeModule, EventSubscription } from 'expo-modules-core';

export interface WorkoutCommandPayload {
    command: string;
    commandId?: string;
    workoutId?: string;
    setId?: string;
    expectedState?: string;
    eventAtMs?: string;
}

type WorkoutCommandEvents = {
    onWorkoutCommand: (event: WorkoutCommandPayload) => void;
};

interface WorkoutCommandNativeModule {
    drainPendingWorkoutCommands(): Promise<WorkoutCommandPayload[]>;
    ackPendingWorkoutCommand(commandId: string): Promise<boolean>;
    addListener<K extends keyof WorkoutCommandEvents>(
        eventName: K,
        listener: WorkoutCommandEvents[K],
    ): EventSubscription;
}

const isIOS = Platform.OS === 'ios';

const WorkoutCommandNative = isIOS
    ? requireNativeModule<WorkoutCommandNativeModule>('WorkoutCommand')
    : null;

export async function drainPendingWorkoutCommands(): Promise<WorkoutCommandPayload[]> {
    if (!isIOS || !WorkoutCommandNative) return [];
    return WorkoutCommandNative.drainPendingWorkoutCommands();
}

export async function ackPendingWorkoutCommand(commandId: string): Promise<boolean> {
    if (!isIOS || !WorkoutCommandNative) return false;
    return WorkoutCommandNative.ackPendingWorkoutCommand(commandId);
}

export function onWorkoutCommand(
    listener: (payload: WorkoutCommandPayload) => void,
): EventSubscription | null {
    if (!isIOS || !WorkoutCommandNative) return null;
    return WorkoutCommandNative.addListener('onWorkoutCommand', listener);
}
