import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

export interface LiveActivityState {
    state: 'performing' | 'resting' | 'resting_no_next' | 'ready' | 'completed';
    exerciseName: string;
    setNumber: number;
    totalSets: number;
    setType: string;
    weight?: number;
    weightUnits?: string;
    reps?: number;
    timeOptions?: string;
    timerStartDate: number; // Unix ms
    timerEndDate: number; // Unix ms
    workoutStartDate: number; // Unix ms
    nextExerciseName?: string;
    nextSetNumber?: number;
    nextWeight?: number;
    nextWeightUnits?: string;
    nextReps?: number;
    completedExercises: number;
    totalExercises: number;
    workoutExerciseId?: string;
}

const isIOS = Platform.OS === 'ios';

const LiveActivityNative = isIOS ? requireNativeModule('LiveActivity') : null;

export function areActivitiesEnabled(): boolean {
    if (!isIOS || !LiveActivityNative) return false;
    return LiveActivityNative.areActivitiesEnabled();
}

export async function startWorkoutActivity(
    workoutName: string,
    workoutId: string,
    state: LiveActivityState,
): Promise<string | null> {
    if (!isIOS || !LiveActivityNative) return null;
    return LiveActivityNative.startWorkoutActivity(workoutName, workoutId, state);
}

export async function updateWorkoutActivity(
    activityId: string,
    state: LiveActivityState,
): Promise<boolean> {
    if (!isIOS || !LiveActivityNative) return false;
    return LiveActivityNative.updateWorkoutActivity(activityId, state);
}

export async function endWorkoutActivity(
    activityId: string,
    state: LiveActivityState,
    dismissImmediately = false,
): Promise<boolean> {
    if (!isIOS || !LiveActivityNative) return false;
    return LiveActivityNative.endWorkoutActivity(activityId, state, dismissImmediately);
}

export function getRunningActivityId(): string | null {
    if (!isIOS || !LiveActivityNative) return null;
    return LiveActivityNative.getRunningActivityId();
}

export async function endAllActivities(): Promise<boolean> {
    if (!isIOS || !LiveActivityNative) return false;
    return LiveActivityNative.endAllActivities();
}
