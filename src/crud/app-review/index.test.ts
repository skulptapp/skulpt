// @ts-nocheck
const mockQueueSyncOperation = jest.fn(async () => undefined);
const mockReportError = jest.fn();

const mockAppReviewPromptTable = {
    __name: 'app_review_prompt',
    id: 'app_review_prompt.id',
    userId: 'app_review_prompt.user_id',
    promptKey: 'app_review_prompt.prompt_key',
    cycleIndex: 'app_review_prompt.cycle_index',
};
const mockWorkoutTable = {
    __name: 'workout',
    userId: 'workout.user_id',
    status: 'workout.status',
    duration: 'workout.duration',
};

let mockPrompts: any[] = [];
let mockWorkoutWhereConditions: any[] = [];
let mockQualifyingWorkoutCount = 0;
let mockNextId = 1;

const findEq = (condition: any, column: string): unknown => {
    if (!condition) return undefined;
    if (condition.op === 'eq' && condition.column === column) return condition.value;
    if (condition.op === 'and') {
        for (const nested of condition.conditions) {
            const value = findEq(nested, column);
            if (value !== undefined) return value;
        }
    }
    return undefined;
};

const findPrompt = (condition: any) => {
    const id = findEq(condition, mockAppReviewPromptTable.id);
    if (typeof id === 'string') {
        return mockPrompts.filter((prompt) => prompt.id === id);
    }

    const userId = findEq(condition, mockAppReviewPromptTable.userId);
    const promptKey = findEq(condition, mockAppReviewPromptTable.promptKey);
    const cycleIndex = findEq(condition, mockAppReviewPromptTable.cycleIndex);

    return mockPrompts.filter(
        (prompt) =>
            prompt.userId === userId &&
            prompt.promptKey === promptKey &&
            prompt.cycleIndex === cycleIndex,
    );
};

const findGt = (condition: any, column: string): unknown => {
    if (!condition) return undefined;
    if (condition.op === 'gt' && condition.column === column) return condition.value;
    if (condition.op === 'and') {
        for (const nested of condition.conditions) {
            const value = findGt(nested, column);
            if (value !== undefined) return value;
        }
    }
    return undefined;
};

const mockDb = {
    select: jest.fn(() => ({
        from: jest.fn((table: any) => ({
            where: jest.fn((condition: any) => {
                if (table.__name === 'workout') {
                    mockWorkoutWhereConditions.push(condition);
                    return Promise.resolve([{ count: mockQualifyingWorkoutCount }]);
                }

                return {
                    limit: jest.fn(async () => findPrompt(condition)),
                };
            }),
        })),
    })),
    insert: jest.fn(() => ({
        values: jest.fn((row: any) => ({
            onConflictDoUpdate: jest.fn(async ({ set }: { set: Record<string, unknown> }) => {
                const index = mockPrompts.findIndex(
                    (prompt) =>
                        prompt.userId === row.userId &&
                        prompt.promptKey === row.promptKey &&
                        prompt.cycleIndex === row.cycleIndex,
                );

                if (index === -1) {
                    mockPrompts.push({ ...row });
                    return;
                }

                mockPrompts[index] = { ...mockPrompts[index], ...set };
            }),
        })),
    })),
    update: jest.fn(() => ({
        set: jest.fn((updates: Record<string, unknown>) => ({
            where: jest.fn(async (condition: any) => {
                const id = findEq(condition, mockAppReviewPromptTable.id);
                mockPrompts = mockPrompts.map((prompt) =>
                    prompt.id === id ? { ...prompt, ...updates } : prompt,
                );
            }),
        })),
    })),
};

jest.mock('drizzle-orm', () => ({
    and: (...conditions: unknown[]) => ({ op: 'and', conditions }),
    count: () => 'count',
    eq: (column: unknown, value: unknown) => ({ op: 'eq', column, value }),
    gt: (column: unknown, value: unknown) => ({ op: 'gt', column, value }),
}));

jest.mock('@/db', () => ({
    db: mockDb,
}));

jest.mock('@/db/schema', () => ({
    appReviewPrompt: mockAppReviewPromptTable,
    workout: mockWorkoutTable,
}));

jest.mock('@/constants/app-review', () => ({
    APP_REVIEW_PROMPT_KEY: 'post_workout_review',
    APP_REVIEW_CURRENT_CYCLE_INDEX: 0,
    APP_REVIEW_MIN_COMPLETED_WORKOUTS: 5,
    APP_REVIEW_MIN_DURATION_SECONDS: 15 * 60,
    APP_REVIEW_RESPONSES: ['bad', 'not_bad', 'good'],
}));

jest.mock('@/helpers/nanoid', () => ({
    nanoid: () => `prompt_${mockNextId++}`,
}));

jest.mock('@/crud/sync', () => ({
    queueSyncOperation: (...args: unknown[]) => mockQueueSyncOperation(...args),
}));

jest.mock('@/services/error-reporting', () => ({
    reportError: (...args: unknown[]) => mockReportError(...args),
}));

const loadServiceModule = () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('.');
};

const completedWorkout = (overrides: Partial<any> = {}) => ({
    id: 'workout_1',
    userId: 'user_1',
    duration: 15 * 60 + 1,
    ...overrides,
});

describe('app review prompt crud', () => {
    beforeEach(() => {
        mockPrompts = [];
        mockWorkoutWhereConditions = [];
        mockQualifyingWorkoutCount = 5;
        mockNextId = 1;
        mockQueueSyncOperation.mockClear();
        mockReportError.mockClear();
    });

    test('qualifying workout count filters current user, completed status, and duration threshold', async () => {
        const { countQualifyingCompletedWorkouts } = loadServiceModule();

        await expect(countQualifyingCompletedWorkouts('user_1')).resolves.toBe(5);

        const condition = mockWorkoutWhereConditions[0];
        expect(findEq(condition, mockWorkoutTable.userId)).toBe('user_1');
        expect(findEq(condition, mockWorkoutTable.status)).toBe('completed');
        expect(findGt(condition, mockWorkoutTable.duration)).toBe(15 * 60);
    });

    test('first eligible phone completion creates a shown prompt', async () => {
        const { resolvePostWorkoutAppReviewPromptResult } = loadServiceModule();

        const result = await resolvePostWorkoutAppReviewPromptResult({
            workout: completedWorkout(),
            completionSource: 'phone',
        });

        expect(result.action).toBe('show');
        expect(result.prompt.status).toBe('shown');
        expect(result.prompt.shownWorkoutId).toBe('workout_1');
        expect(result.prompt.eligibleWorkoutCount).toBe(5);
        expect(mockQueueSyncOperation).toHaveBeenCalledWith(
            expect.objectContaining({
                tableName: 'app_review_prompt',
                operation: 'create',
            }),
        );
    });

    test('first eligible watch completion creates a deferred prompt', async () => {
        const { resolvePostWorkoutAppReviewPromptResult } = loadServiceModule();

        const result = await resolvePostWorkoutAppReviewPromptResult({
            workout: completedWorkout(),
            completionSource: 'watch',
        });

        expect(result.action).toBe('defer');
        expect(result.prompt.status).toBe('deferred');
        expect(result.prompt.triggerWorkoutId).toBe('workout_1');
        expect(result.prompt.completionSource).toBe('watch');
    });

    test('deferred prompt is shown on next phone completion regardless of duration', async () => {
        const { resolvePostWorkoutAppReviewPromptResult } = loadServiceModule();

        mockPrompts.push({
            id: 'prompt_existing',
            userId: 'user_1',
            promptKey: 'post_workout_review',
            cycleIndex: 0,
            status: 'deferred',
            triggerWorkoutId: 'workout_watch',
            eligibleWorkoutCount: 5,
            createdAt: new Date(1000),
            updatedAt: new Date(1000),
        });

        const result = await resolvePostWorkoutAppReviewPromptResult({
            workout: completedWorkout({ duration: 10 }),
            completionSource: 'phone',
        });

        expect(result.action).toBe('show');
        expect(result.wasDeferred).toBe(true);
        expect(result.prompt.status).toBe('shown');
        expect(result.prompt.shownWorkoutId).toBe('workout_1');
    });

    test('deferred prompt stays deferred on another watch completion', async () => {
        const { resolvePostWorkoutAppReviewPromptResult } = loadServiceModule();

        mockPrompts.push({
            id: 'prompt_existing',
            userId: 'user_1',
            promptKey: 'post_workout_review',
            cycleIndex: 0,
            status: 'deferred',
            triggerWorkoutId: 'workout_watch',
            eligibleWorkoutCount: 5,
            createdAt: new Date(1000),
            updatedAt: new Date(1000),
        });

        const result = await resolvePostWorkoutAppReviewPromptResult({
            workout: completedWorkout({ id: 'workout_2' }),
            completionSource: 'watch',
        });

        expect(result.action).toBe('skip');
        expect(mockPrompts[0].status).toBe('deferred');
        expect(mockPrompts[0].shownWorkoutId).toBeUndefined();
    });

    test.each(['dismissed', 'submitted'])(
        '%s prompt is terminal for cycle zero',
        async (status) => {
            const { resolvePostWorkoutAppReviewPromptResult } = loadServiceModule();

            mockPrompts.push({
                id: 'prompt_existing',
                userId: 'user_1',
                promptKey: 'post_workout_review',
                cycleIndex: 0,
                status,
                eligibleWorkoutCount: 5,
                createdAt: new Date(1000),
                updatedAt: new Date(1000),
            });

            const result = await resolvePostWorkoutAppReviewPromptResult({
                workout: completedWorkout({ id: 'workout_2' }),
                completionSource: 'phone',
            });

            expect(result.action).toBe('skip');
            expect(mockPrompts[0].status).toBe(status);
        },
    );
});
