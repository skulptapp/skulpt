// @ts-nocheck
const mockGetServerChanges = jest.fn();
const mockSendChangesToServer = jest.fn();
const mockGetLastSyncTimestamp = jest.fn();
const mockGetSkulptLastSyncTimestamp = jest.fn();
const mockGetPendingSyncOperations = jest.fn();
const mockMarkSyncOperationAsDone = jest.fn();
const mockUpdateLastSyncTimestamp = jest.fn();
const mockUpdateSkulptLastSyncTimestamp = jest.fn();
const mockCleanupSyncedOperations = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockTxInsertValues = jest.fn(async () => undefined);

const mockExerciseTable = {
    __name: 'exercise',
    id: 'exercise.id',
    userId: 'exercise.user_id',
};

const mockTx = {
    select: jest.fn(() => ({
        from: jest.fn(() => ({
            where: jest.fn(() => ({
                limit: jest.fn(async () => []),
            })),
        })),
    })),
    insert: jest.fn(() => ({
        values: mockTxInsertValues,
    })),
    update: jest.fn(() => ({
        set: jest.fn(() => ({
            where: jest.fn(async () => undefined),
        })),
    })),
    delete: jest.fn(() => ({
        where: jest.fn(async () => undefined),
    })),
};

const mockDb = {
    transaction: jest.fn(async (callback: (tx: typeof mockTx) => Promise<void>) =>
        callback(mockTx),
    ),
};

jest.mock('drizzle-orm', () => ({
    and: (...conditions: unknown[]) => ({ conditions }),
    eq: (column: unknown, value: unknown) => ({ column, value }),
}));

jest.mock('@/api', () => ({
    getServerChanges: (...args: unknown[]) => mockGetServerChanges(...args),
    sendChangesToServer: (...args: unknown[]) => mockSendChangesToServer(...args),
}));

jest.mock('./backfill', () => ({
    backfillSyncQueue: jest.fn(async () => undefined),
}));

jest.mock('@/crud/sync', () => ({
    getLastSyncTimestamp: (...args: unknown[]) => mockGetLastSyncTimestamp(...args),
    getSkulptLastSyncTimestamp: (...args: unknown[]) => mockGetSkulptLastSyncTimestamp(...args),
    getPendingSyncOperations: (...args: unknown[]) => mockGetPendingSyncOperations(...args),
    markSyncOperationAsDone: (...args: unknown[]) => mockMarkSyncOperationAsDone(...args),
    updateLastSyncTimestamp: (...args: unknown[]) => mockUpdateLastSyncTimestamp(...args),
    updateSkulptLastSyncTimestamp: (...args: unknown[]) =>
        mockUpdateSkulptLastSyncTimestamp(...args),
    cleanupSyncedOperations: (...args: unknown[]) => mockCleanupSyncedOperations(...args),
}));

jest.mock('@/crud/user', () => ({
    getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

jest.mock('@/db', () => ({
    db: mockDb,
}));

jest.mock('@/db/schema', () => ({
    appReviewPrompt: {
        __name: 'app_review_prompt',
        id: 'app_review_prompt.id',
        userId: 'app_review_prompt.user_id',
        promptKey: 'app_review_prompt.prompt_key',
        cycleIndex: 'app_review_prompt.cycle_index',
        updatedAt: 'app_review_prompt.updated_at',
    },
    exercise: mockExerciseTable,
    exerciseSet: {
        __name: 'exercise_set',
        id: 'exercise_set.id',
        workoutExerciseId: 'exercise_set.workout_exercise_id',
    },
    user: {
        __name: 'user',
        id: 'user.id',
    },
    workout: {
        __name: 'workout',
        id: 'workout.id',
        userId: 'workout.user_id',
    },
    workoutGroup: {
        __name: 'workout_group',
        id: 'workout_group.id',
        workoutId: 'workout_group.workout_id',
    },
    workoutExercise: {
        __name: 'workout_exercise',
        id: 'workout_exercise.id',
        workoutId: 'workout_exercise.workout_id',
        exerciseId: 'workout_exercise.exercise_id',
        groupId: 'workout_exercise.group_id',
    },
}));

jest.mock('@/constants/muscles', () => ({
    sanitizeMuscleGroupSelections: ({
        primary,
        secondary,
    }: {
        primary?: string[] | null;
        secondary?: string[] | null;
    }) => ({
        primary: Array.isArray(primary) ? primary : [],
        secondary: Array.isArray(secondary) ? secondary : [],
    }),
}));

jest.mock('@/helpers/set-type', () => ({
    normalizeSetType: (value: unknown) => value,
}));

jest.mock('@sentry/react-native', () => ({
    withScope: jest.fn(),
    captureException: jest.fn(),
}));

jest.mock('./config', () => ({
    isSyncEnabled: () => true,
}));

const loadSyncModule = () => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./index');
};

describe('dataset sync flow', () => {
    beforeEach(() => {
        mockGetServerChanges.mockReset();
        mockSendChangesToServer.mockReset();
        mockGetLastSyncTimestamp.mockReset();
        mockGetSkulptLastSyncTimestamp.mockReset();
        mockGetPendingSyncOperations.mockReset();
        mockMarkSyncOperationAsDone.mockReset();
        mockUpdateLastSyncTimestamp.mockReset();
        mockUpdateSkulptLastSyncTimestamp.mockReset();
        mockCleanupSyncedOperations.mockReset();
        mockGetCurrentUser.mockReset();
        mockDb.transaction.mockClear();
        mockTx.select.mockClear();
        mockTx.insert.mockClear();
        mockTxInsertValues.mockClear();
        mockTx.update.mockClear();
        mockTx.delete.mockClear();
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('@sentry/react-native').withScope.mockClear();

        mockGetCurrentUser.mockResolvedValue({
            id: 'user_1',
            lng: 'en',
        });
    });

    test('runs incremental dataset sync with scoped pull and dataset cursor update', async () => {
        const { performSkulptSync } = loadSyncModule();

        mockGetCurrentUser.mockResolvedValue({
            id: 'user_1',
            lng: 'ru-RU',
        });
        mockGetSkulptLastSyncTimestamp.mockResolvedValue(new Date(1000));
        mockGetServerChanges.mockResolvedValue({
            success: true,
            data: {
                exercise: {
                    records: [],
                    deletedIds: [],
                    timestamp: 2500,
                },
            },
        });

        const result = await performSkulptSync();

        expect(result).toBe(true);
        expect(mockGetServerChanges).toHaveBeenCalledWith(1000, 'user_1', {
            syncType: 'skulpt',
            locale: 'ru-RU',
        });
        expect(mockUpdateSkulptLastSyncTimestamp).toHaveBeenCalledTimes(1);
        expect(mockUpdateSkulptLastSyncTimestamp).toHaveBeenCalledWith('ru-RU', expect.any(Date));
        expect(mockUpdateSkulptLastSyncTimestamp.mock.calls[0][1].getTime()).toBe(2500);
        expect(mockUpdateLastSyncTimestamp).not.toHaveBeenCalled();
        expect(mockGetPendingSyncOperations).not.toHaveBeenCalled();
        expect(mockMarkSyncOperationAsDone).not.toHaveBeenCalled();
    });

    test('runs full dataset reload with since=0 and locale normalization', async () => {
        const { performSkulptSync } = loadSyncModule();

        mockGetServerChanges.mockResolvedValue({
            success: true,
            data: {
                exercise: {
                    records: [],
                    deletedIds: [],
                    timestamp: 3333,
                },
            },
        });

        const result = await performSkulptSync({
            locale: ' es_MX ',
            full: true,
        });

        expect(result).toBe(true);
        expect(mockGetSkulptLastSyncTimestamp).not.toHaveBeenCalled();
        expect(mockGetServerChanges).toHaveBeenCalledWith(0, 'user_1', {
            syncType: 'skulpt',
            locale: 'es-MX',
        });
        expect(mockUpdateSkulptLastSyncTimestamp).toHaveBeenCalledWith('es-MX', expect.any(Date));
        expect(mockUpdateSkulptLastSyncTimestamp.mock.calls[0][1].getTime()).toBe(3333);
        expect(mockTx.delete).toHaveBeenCalledWith(mockExerciseTable);
    });

    test('pullServerChanges keeps user and dataset scopes isolated', async () => {
        const { pullServerChanges } = loadSyncModule();

        mockGetCurrentUser.mockResolvedValue({
            id: 'user_1',
            lng: 'hi_IN',
        });
        mockGetLastSyncTimestamp.mockResolvedValue(new Date(500));
        mockGetSkulptLastSyncTimestamp.mockResolvedValue(new Date(700));
        mockGetServerChanges
            .mockResolvedValueOnce({
                success: true,
                data: {},
            })
            .mockResolvedValueOnce({
                success: true,
                data: {
                    exercise: {
                        records: [],
                        deletedIds: [],
                        timestamp: 900,
                    },
                },
            });

        const result = await pullServerChanges();

        expect(result).toEqual({ success: true });
        expect(mockGetServerChanges).toHaveBeenNthCalledWith(1, 500, 'user_1', {
            syncType: 'user',
        });
        expect(mockGetServerChanges).toHaveBeenNthCalledWith(2, 700, 'user_1', {
            syncType: 'skulpt',
            locale: 'hi-IN',
        });
        expect(mockUpdateLastSyncTimestamp).toHaveBeenCalledTimes(1);
        expect(mockUpdateLastSyncTimestamp).toHaveBeenCalledWith(expect.any(Date));
        expect(mockUpdateLastSyncTimestamp.mock.calls[0][0].getTime()).toBe(500);
        expect(mockUpdateSkulptLastSyncTimestamp).toHaveBeenCalledTimes(1);
        expect(mockUpdateSkulptLastSyncTimestamp).toHaveBeenCalledWith('hi-IN', expect.any(Date));
        expect(mockUpdateSkulptLastSyncTimestamp.mock.calls[0][1].getTime()).toBe(900);
    });

    test('pullServerChanges applies app review prompts and parses nullable timestamps', async () => {
        const { pullServerChanges } = loadSyncModule();

        mockGetLastSyncTimestamp.mockResolvedValue(new Date(500));
        mockGetSkulptLastSyncTimestamp.mockResolvedValue(new Date(700));
        mockGetServerChanges
            .mockResolvedValueOnce({
                success: true,
                data: {
                    app_review_prompt: {
                        records: [
                            {
                                id: 'prompt_1',
                                userId: 'user_1',
                                promptKey: 'post_workout_review',
                                cycleIndex: 0,
                                status: 'shown',
                                eligibleWorkoutCount: 5,
                                completionSource: 'phone',
                                createdAt: '2026-05-28T10:00:00Z',
                                updatedAt: '2026-05-28T10:01:00Z',
                                serverCreatedAt: '2026-05-28T10:00:01Z',
                                serverUpdatedAt: '2026-05-28T10:01:01Z',
                                storeReviewPendingAt: '2026-05-28T10:01:30Z',
                                storeReviewRequestedAt: '2026-05-28T10:02:00Z',
                                shownAt: '2026-05-28T10:01:00Z',
                                submittedAt: null,
                                dismissedAt: null,
                            },
                        ],
                        deletedIds: ['prompt_2'],
                        timestamp: 2000,
                    },
                },
            })
            .mockResolvedValueOnce({
                success: true,
                data: {},
            });

        const result = await pullServerChanges();

        expect(result).toEqual({ success: true });
        expect(mockTx.insert).toHaveBeenCalledWith(
            expect.objectContaining({ __name: 'app_review_prompt' }),
        );

        const payload = mockTxInsertValues.mock.calls[0][0];
        expect(payload.createdAt).toBeInstanceOf(Date);
        expect(payload.updatedAt).toBeInstanceOf(Date);
        expect(payload.storeReviewPendingAt).toBeInstanceOf(Date);
        expect(payload.storeReviewRequestedAt).toBeInstanceOf(Date);
        expect(payload.shownAt).toBeInstanceOf(Date);
        expect(payload.serverCreatedAt).toBeUndefined();
        expect(payload.serverUpdatedAt).toBeUndefined();
        expect(mockTx.delete).toHaveBeenCalledWith(
            expect.objectContaining({ __name: 'app_review_prompt' }),
        );
        expect(mockUpdateLastSyncTimestamp.mock.calls[0][0].getTime()).toBe(2000);
    });

    test('treats retryable user pull HTTP failures as transient sync failures', async () => {
        const { pullServerChanges } = loadSyncModule();
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Sentry = require('@sentry/react-native');

        mockGetLastSyncTimestamp.mockResolvedValue(new Date(500));
        mockGetServerChanges.mockResolvedValue({
            success: false,
            error: 'SERVER_ERROR',
            status: 504,
        });

        const result = await pullServerChanges();

        expect(result).toEqual({ success: false, isRetryableNetworkFailure: true });
        expect(mockGetServerChanges).toHaveBeenCalledTimes(1);
        expect(mockUpdateLastSyncTimestamp).not.toHaveBeenCalled();
        expect(mockUpdateSkulptLastSyncTimestamp).not.toHaveBeenCalled();
        expect(Sentry.withScope).not.toHaveBeenCalled();
    });

    test('treats retryable skulpt pull HTTP failures as transient sync failures', async () => {
        const { pullServerChanges } = loadSyncModule();
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Sentry = require('@sentry/react-native');

        mockGetCurrentUser.mockResolvedValue({
            id: 'user_1',
            lng: 'ru',
        });
        mockGetLastSyncTimestamp.mockResolvedValue(new Date(500));
        mockGetSkulptLastSyncTimestamp.mockResolvedValue(new Date(700));
        mockGetServerChanges
            .mockResolvedValueOnce({
                success: true,
                data: {},
            })
            .mockResolvedValueOnce({
                success: false,
                error: 'SERVER_ERROR',
                status: 504,
            });

        const result = await pullServerChanges();

        expect(result).toEqual({ success: false, isRetryableNetworkFailure: true });
        expect(mockUpdateLastSyncTimestamp).toHaveBeenCalledWith(expect.any(Date));
        expect(mockUpdateSkulptLastSyncTimestamp).not.toHaveBeenCalled();
        expect(Sentry.withScope).not.toHaveBeenCalled();
    });

    test('does not report performSync stop after retryable pull failure', async () => {
        const { performSync } = loadSyncModule();
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Sentry = require('@sentry/react-native');

        mockGetCurrentUser.mockResolvedValue({
            id: 'user_1',
            lng: 'en',
        });
        mockGetPendingSyncOperations.mockResolvedValue([]);
        mockGetLastSyncTimestamp.mockResolvedValue(new Date(500));
        mockGetSkulptLastSyncTimestamp.mockResolvedValue(new Date(700));
        mockGetServerChanges
            .mockResolvedValueOnce({
                success: true,
                data: {},
            })
            .mockResolvedValueOnce({
                success: false,
                error: 'SERVER_ERROR',
                status: 504,
            });

        const result = await performSync();

        expect(result).toBe(false);
        expect(mockCleanupSyncedOperations).not.toHaveBeenCalled();
        expect(Sentry.withScope).not.toHaveBeenCalled();
    });

    test('treats retryable push HTTP failures as transient sync failures', async () => {
        const { pushLocalChanges } = loadSyncModule();
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Sentry = require('@sentry/react-native');
        const pendingOperation = {
            id: 'sync_1',
            tableName: 'user',
            recordId: 'user_1',
            operation: 'create',
            timestamp: new Date(1000),
            synced: 0,
            data: {
                id: 'user_1',
                lng: 'en',
                createdAt: new Date(1000),
                updatedAt: new Date(1000),
            },
        };

        mockGetPendingSyncOperations.mockResolvedValue([pendingOperation]);
        mockSendChangesToServer.mockResolvedValue({
            success: false,
            error: 'SERVER_ERROR',
            status: 504,
        });

        const result = await pushLocalChanges();

        expect(result).toEqual({ success: false, isRetryableNetworkFailure: true });
        expect(mockSendChangesToServer).toHaveBeenCalledTimes(1);
        expect(mockMarkSyncOperationAsDone).not.toHaveBeenCalled();
        expect(Sentry.withScope).not.toHaveBeenCalled();
    });

    test('does not report performSync stop after retryable push failure', async () => {
        const { performSync } = loadSyncModule();
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Sentry = require('@sentry/react-native');

        mockGetPendingSyncOperations.mockResolvedValue([
            {
                id: 'sync_1',
                tableName: 'user',
                recordId: 'user_1',
                operation: 'create',
                timestamp: new Date(1000),
                synced: 0,
                data: {
                    id: 'user_1',
                    lng: 'en',
                    createdAt: new Date(1000),
                    updatedAt: new Date(1000),
                },
            },
        ]);
        mockSendChangesToServer.mockResolvedValue({
            success: false,
            error: 'SERVER_ERROR',
            status: 504,
        });

        const result = await performSync();

        expect(result).toBe(false);
        expect(mockGetServerChanges).not.toHaveBeenCalled();
        expect(mockCleanupSyncedOperations).not.toHaveBeenCalled();
        expect(Sentry.withScope).not.toHaveBeenCalled();
    });
});
