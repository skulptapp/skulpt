// @ts-nocheck
const mockGetServerChanges = jest.fn();
const mockGetLastSyncTimestamp = jest.fn();
const mockGetSkulptLastSyncTimestamp = jest.fn();
const mockGetPendingSyncOperations = jest.fn();
const mockMarkSyncOperationAsDone = jest.fn();
const mockUpdateLastSyncTimestamp = jest.fn();
const mockUpdateSkulptLastSyncTimestamp = jest.fn();
const mockCleanupSyncedOperations = jest.fn();
const mockGetCurrentUser = jest.fn();

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
        values: jest.fn(async () => undefined),
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
    eq: (column: unknown, value: unknown) => ({ column, value }),
}));

jest.mock('@/api', () => ({
    getServerChanges: (...args: unknown[]) => mockGetServerChanges(...args),
    sendChangesToServer: jest.fn(),
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
        mockTx.update.mockClear();
        mockTx.delete.mockClear();

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
});
