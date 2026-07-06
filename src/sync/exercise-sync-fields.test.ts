// @ts-nocheck
jest.mock('@/db', () => ({ db: {} }));
jest.mock('@/api', () => ({
    getServerChanges: jest.fn(),
    sendChangesToServer: jest.fn(),
}));
jest.mock('@/crud/sync', () => ({
    getLastSyncTimestamp: jest.fn(),
    getPendingSyncOperations: jest.fn(),
    markSyncOperationAsDone: jest.fn(),
    updateLastSyncTimestamp: jest.fn(),
    cleanupSyncedOperations: jest.fn(),
}));
jest.mock('@/crud/user', () => ({
    getCurrentUser: jest.fn(),
}));
jest.mock('@sentry/react-native', () => ({
    withScope: jest.fn(),
    captureException: jest.fn(),
}));
jest.mock('@/helpers/set-type', () => ({
    normalizeSetType: (value: unknown) =>
        typeof value === 'string' && value.toLowerCase() === 'warmup' ? 'warmup' : 'working',
}));

const loadSyncModule = () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./index');
};

describe('exercise sync record normalization', () => {
    test('keeps new dataset fields in outgoing payload', () => {
        const { normalizeOutgoingExerciseSyncRecord } = loadSyncModule();

        const outgoing = normalizeOutgoingExerciseSyncRecord({
            id: 'exercise_1',
            name: 'Dataset Squat',
            category: 'strength',
            tracking: ['weight', 'reps'],
            source: 'system',
            skulptSourceId: 'source_1',
            equipment: ['barbell', 'rack'],
            mistakes: ['Knees cave in'],
            instructions: ['Brace core'],
            description: 'Strong baseline movement',
            difficulty: 'intermediate',
            gifFilename: 'sk001-12345',
            muscleLoad: [
                { muscle: 'quads', percentage: 70 },
                { muscle: 'glutes', percentage: 30 },
            ],
            confidence: 'high',
            primaryMuscleGroups: ['quads'],
            secondaryMuscleGroups: ['glutes'],
        });

        expect(outgoing).toEqual(
            expect.objectContaining({
                skulptSourceId: 'source_1',
                source: 'system',
                equipment: ['barbell', 'rack'],
                mistakes: ['Knees cave in'],
                instructions: ['Brace core'],
                description: 'Strong baseline movement',
                difficulty: 'intermediate',
                gifFilename: 'sk001-12345',
                muscleLoad: [
                    { muscle: 'quads', percentage: 70 },
                    { muscle: 'glutes', percentage: 30 },
                ],
                confidence: 'high',
            }),
        );
    });

    test('preserves new dataset fields in incoming payload and drops unknown keys', () => {
        const { normalizeIncomingExerciseSyncRecord } = loadSyncModule();

        const incoming = normalizeIncomingExerciseSyncRecord({
            id: 'exercise_2',
            name: 'Dataset Deadlift',
            category: 'strength',
            tracking: ['weight', 'reps'],
            source: 'system',
            skulptSourceId: 'source_2',
            equipment: ['barbell'],
            mistakes: ['Rounded back'],
            instructions: ['Hinge from hips'],
            description: 'Posterior chain staple',
            difficulty: 'advanced',
            gifFilename: 'sk002-777',
            muscleLoad: [
                { muscle: 'hamstrings', percentage: 80 },
                { muscle: 'lower_back', percentage: 20 },
            ],
            confidence: 'medium',
            primaryMuscleGroups: ['hamstrings'],
            secondaryMuscleGroups: ['lower_back'],
            unknownField: 'must_be_removed',
        });

        expect(incoming).toEqual(
            expect.objectContaining({
                id: 'exercise_2',
                source: 'system',
                skulptSourceId: 'source_2',
                equipment: ['barbell'],
                mistakes: ['Rounded back'],
                instructions: ['Hinge from hips'],
                description: 'Posterior chain staple',
                difficulty: 'advanced',
                gifFilename: 'sk002-777',
                muscleLoad: [
                    { muscle: 'hamstrings', percentage: 80 },
                    { muscle: 'lower_back', percentage: 20 },
                ],
                confidence: 'medium',
            }),
        );
        expect(incoming).not.toHaveProperty('unknownField');
    });
});

describe('exercise set sync record normalization', () => {
    const exerciseSetPayload = {
        id: 'set_1',
        workoutExerciseId: 'workout_exercise_1',
        reps: 10,
        weight: 80,
        type: 'Warmup',
        startedAt: '2026-05-24T08:00:00.000Z',
        completedAt: '2026-05-24T08:01:00.000Z',
        restTime: 90,
        finalRestTime: 90,
        restCompletedAt: null,
    };

    test('keeps completion and rest fields in outgoing payload', () => {
        const { normalizeOutgoingExerciseSetSyncRecord } = loadSyncModule();

        const outgoing = normalizeOutgoingExerciseSetSyncRecord(exerciseSetPayload);

        expect(outgoing).toEqual(
            expect.objectContaining({
                type: 'warmup',
                startedAt: '2026-05-24T08:00:00.000Z',
                completedAt: '2026-05-24T08:01:00.000Z',
                restTime: 90,
                finalRestTime: 90,
                restCompletedAt: null,
            }),
        );
    });

    test('clamps impossible outgoing reps values', () => {
        const { normalizeOutgoingExerciseSetSyncRecord } = loadSyncModule();

        const outgoing = normalizeOutgoingExerciseSetSyncRecord({
            ...exerciseSetPayload,
            reps: 100000000000000020,
        });

        expect(outgoing.reps).toBe(9999);
    });

    test('keeps completion and rest fields in incoming payload', () => {
        const { normalizeIncomingExerciseSetSyncRecord } = loadSyncModule();

        const incoming = normalizeIncomingExerciseSetSyncRecord(exerciseSetPayload);

        expect(incoming).toEqual(
            expect.objectContaining({
                type: 'warmup',
                startedAt: '2026-05-24T08:00:00.000Z',
                completedAt: '2026-05-24T08:01:00.000Z',
                restTime: 90,
                finalRestTime: 90,
                restCompletedAt: null,
            }),
        );
    });
});
