// @ts-nocheck
const mockQueueSyncOperations = jest.fn(async () => undefined);
const mockGetLastSyncTimestamp = jest.fn(async () => new Date(1000));

const mockTables = {
    appReviewPrompt: {
        __name: 'app_review_prompt',
        id: 'app_review_prompt.id',
        updatedAt: 'app_review_prompt.updated_at',
    },
    exercise: {
        __name: 'exercise',
        id: 'exercise.id',
        userId: 'exercise.user_id',
        updatedAt: 'exercise.updated_at',
    },
    exerciseSet: {
        __name: 'exercise_set',
        id: 'exercise_set.id',
        updatedAt: 'exercise_set.updated_at',
    },
    measurement: {
        __name: 'measurement',
        id: 'measurement.id',
        updatedAt: 'measurement.updated_at',
    },
    syncQueue: {
        __name: 'sync_queue',
        tableName: 'sync_queue.table_name',
        recordId: 'sync_queue.record_id',
        synced: 'sync_queue.synced',
    },
    user: {
        __name: 'user',
        id: 'user.id',
        updatedAt: 'user.updated_at',
    },
    workout: {
        __name: 'workout',
        id: 'workout.id',
        updatedAt: 'workout.updated_at',
    },
    workoutExercise: {
        __name: 'workout_exercise',
        id: 'workout_exercise.id',
        updatedAt: 'workout_exercise.updated_at',
    },
    workoutGroup: {
        __name: 'workout_group',
        id: 'workout_group.id',
        updatedAt: 'workout_group.updated_at',
    },
};

const mockAppReviewPromptRow = {
    id: 'prompt_1',
    userId: 'user_1',
    promptKey: 'post_workout_review',
    cycleIndex: 0,
    status: 'shown',
    createdAt: new Date(500),
    updatedAt: new Date(1500),
};

const rowsForTable = (tableName: string) => {
    if (tableName === 'app_review_prompt') return [mockAppReviewPromptRow];
    return [];
};

const mockDb = {
    select: jest.fn(() => ({
        from: jest.fn((table: any) => ({
            where: jest.fn(async () => rowsForTable(table.__name)),
        })),
    })),
};

jest.mock('drizzle-orm', () => ({
    and: (...conditions: unknown[]) => ({ conditions }),
    eq: (column: unknown, value: unknown) => ({ column, value }),
    gt: (column: unknown, value: unknown) => ({ column, value }),
    ne: (column: unknown, value: unknown) => ({ column, value }),
}));

jest.mock('@/db', () => ({
    db: mockDb,
}));

jest.mock('@/db/schema', () => mockTables);

jest.mock('@/constants/skulpt', () => ({
    SKULPT_EXERCISES_USER_ID: 'skulpt',
}));

jest.mock('@/crud/sync', () => ({
    getLastSyncTimestamp: (...args: unknown[]) => mockGetLastSyncTimestamp(...args),
    queueSyncOperations: (...args: unknown[]) => mockQueueSyncOperations(...args),
}));

const loadBackfillModule = () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./backfill');
};

describe('sync backfill', () => {
    beforeEach(() => {
        mockQueueSyncOperations.mockClear();
        mockGetLastSyncTimestamp.mockClear();
    });

    test('queues app review prompt rows', async () => {
        const { backfillSyncQueue } = loadBackfillModule();

        await backfillSyncQueue();

        expect(mockQueueSyncOperations).toHaveBeenCalledWith([
            expect.objectContaining({
                tableName: 'app_review_prompt',
                recordId: 'prompt_1',
                operation: 'update',
                data: mockAppReviewPromptRow,
            }),
        ]);
    });
});
