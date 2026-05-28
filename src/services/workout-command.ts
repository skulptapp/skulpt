import { EventSubscription } from 'expo-modules-core';

import {
    WorkoutCommandPayload,
    ackPendingWorkoutCommand,
    drainPendingWorkoutCommands,
    onWorkoutCommand,
} from '../../modules/workout-command';

export type WorkoutCommand = WorkoutCommandPayload;

export class WorkoutCommandManager {
    async drainPendingCommands(): Promise<WorkoutCommand[]> {
        return drainPendingWorkoutCommands();
    }

    async ackCommand(commandId: string): Promise<void> {
        await ackPendingWorkoutCommand(commandId);
    }

    onCommand(listener: (payload: WorkoutCommand) => void): EventSubscription | null {
        return onWorkoutCommand(listener);
    }
}
