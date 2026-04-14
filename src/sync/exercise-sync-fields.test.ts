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
    normalizeSetType: (value: unknown) => value,
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
            }),
        );
        expect(incoming).not.toHaveProperty('unknownField');
    });
});
