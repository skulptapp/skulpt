// @ts-nocheck
const SOURCE_EXERCISE_ID = 'skulptSourceExercise01';
const FORK_EXERCISE_ID = 'skulptForkExercise01';
const USER_ID = 'user_123';

const mockQueueSyncOperation = jest.fn();
const mockNanoid = jest.fn(() => FORK_EXERCISE_ID);
const mockReportError = jest.fn();

const mockExerciseTable = {
    __name: 'exercise',
    id: 'exercise.id',
    userId: 'exercise.user_id',
};

const mockWorkoutExerciseTable = {
    __name: 'workout_exercise',
    id: 'workout_exercise.id',
    workoutId: 'workout_exercise.workout_id',
    exerciseId: 'workout_exercise.exercise_id',
};

const mockWorkoutTable = {
    __name: 'workout',
    id: 'workout.id',
    userId: 'workout.user_id',
};

const mockWorkoutGroupTable = {
    __name: 'workout_group',
    id: 'workout_group.id',
};

const mockExerciseSetTable = {
    __name: 'exercise_set',
    id: 'exercise_set.id',
};

type Condition =
    | { op: 'eq'; column: unknown; value: unknown }
    | { op: 'and' | 'or'; args: Condition[] }
    | undefined;

const findEqValue = (condition: Condition, column: unknown): unknown => {
    if (!condition) {
        return undefined;
    }

    if (condition.op === 'eq') {
        return condition.column === column ? condition.value : undefined;
    }

    for (const nestedCondition of condition.args) {
        const value = findEqValue(nestedCondition, column);
        if (value !== undefined) {
            return value;
        }
    }

    return undefined;
};

let mockInsertedExercise: Record<string, unknown> | null = null;
let mockWorkoutExercisesById: Record<string, Record<string, unknown>> = {};

const mockSourceExercise = {
    id: SOURCE_EXERCISE_ID,
    name: 'Skulpt Bench Press',
    category: 'strength',
    tracking: ['weight', 'reps'],
    weightUnits: 'kg',
    weightAssisted: false,
    weightDoubleInStats: false,
    distanceUnits: null,
    distanceActivityType: null,
    distanceTrackAW: null,
    timeOptions: null,
    timeHalfwayAlert: null,
    source: 'system',
    skulptSourceId: null,
    primaryMuscleGroups: ['chest'],
    secondaryMuscleGroups: ['triceps'],
    equipment: ['barbell', 'bench'],
    mistakes: ['Elbows too wide'],
    instructions: ['Keep scapula retracted'],
    description: 'Skulpt description',
    difficulty: 'beginner',
    gifFilename: 'sk_bench-skulptSourceExercise01',
    userId: '__skulpt__',
    createdAt: new Date('2026-03-22T12:00:00.000Z'),
    updatedAt: new Date('2026-03-22T12:00:00.000Z'),
};

const resolveSelectRows = (ctx: {
    tableName?: string;
    joinedTableName?: string;
    whereCondition?: Condition;
}): Record<string, unknown>[] => {
    if (ctx.tableName === 'exercise') {
        const id = findEqValue(ctx.whereCondition, mockExerciseTable.id);
        if (id === SOURCE_EXERCISE_ID) {
            return [mockSourceExercise];
        }

        if (id === FORK_EXERCISE_ID && mockInsertedExercise) {
            return [mockInsertedExercise];
        }

        return [];
    }

    if (ctx.tableName === 'workout_exercise' && ctx.joinedTableName === 'workout') {
        return [{ id: 'we1' }, { id: 'we2' }];
    }

    if (ctx.tableName === 'workout_exercise') {
        const id = findEqValue(ctx.whereCondition, mockWorkoutExerciseTable.id);
        if (typeof id === 'string' && mockWorkoutExercisesById[id]) {
            return [mockWorkoutExercisesById[id]];
        }

        return [];
    }

    return [];
};

const mockDb = {
    select: jest.fn((projection?: unknown) => {
        const ctx: {
            projection?: unknown;
            tableName?: string;
            joinedTableName?: string;
            whereCondition?: Condition;
        } = { projection };

        const queryBuilder: {
            from: jest.Mock;
            innerJoin: jest.Mock;
            where: jest.Mock;
            limit: jest.Mock;
            orderBy: jest.Mock;
        } = {
            from: jest.fn((table: { __name?: string }) => {
                ctx.tableName = table?.__name;
                return queryBuilder;
            }),
            innerJoin: jest.fn((table: { __name?: string }) => {
                ctx.joinedTableName = table?.__name;
                return queryBuilder;
            }),
            where: jest.fn((condition: Condition) => {
                ctx.whereCondition = condition;
                if (projection) {
                    return Promise.resolve(resolveSelectRows(ctx));
                }
                return queryBuilder;
            }),
            limit: jest.fn(async () => resolveSelectRows(ctx)),
            orderBy: jest.fn(async () => resolveSelectRows(ctx)),
        };

        return queryBuilder;
    }),
    insert: jest.fn((table: { __name?: string }) => ({
        values: jest.fn((values: Record<string, unknown>) => ({
            onConflictDoUpdate: jest.fn(async () => {
                if (table.__name === 'exercise') {
                    mockInsertedExercise = {
                        ...values,
                    };
                }
            }),
        })),
    })),
    update: jest.fn((table: { __name?: string; id?: string }) => ({
        set: jest.fn((values: Record<string, unknown>) => ({
            where: jest.fn(async (condition: Condition) => {
                if (table.__name !== 'workout_exercise') {
                    return;
                }

                const id = findEqValue(condition, table.id);
                if (typeof id === 'string' && mockWorkoutExercisesById[id]) {
                    mockWorkoutExercisesById[id] = {
                        ...mockWorkoutExercisesById[id],
                        ...values,
                        updatedAt: new Date('2026-03-23T10:00:00.000Z'),
                    };
                }
            }),
        })),
    })),
    delete: jest.fn(),
};

jest.mock('drizzle-orm', () => ({
    eq: (column: unknown, value: unknown) => ({ op: 'eq', column, value }),
    and: (...args: Condition[]) => ({ op: 'and', args }),
    or: (...args: Condition[]) => ({ op: 'or', args }),
    desc: (value: unknown) => value,
    inArray: (_column: unknown, values: unknown[]) => values,
}));

jest.mock('@/db', () => ({
    db: mockDb,
}));

jest.mock('@/db/schema', () => ({
    exercise: mockExerciseTable,
    workoutExercise: mockWorkoutExerciseTable,
    workoutGroup: mockWorkoutGroupTable,
    workout: mockWorkoutTable,
    exerciseSet: mockExerciseSetTable,
}));

jest.mock('@/crud/sync', () => ({
    queueSyncOperation: mockQueueSyncOperation,
}));

jest.mock('@/helpers/nanoid', () => ({
    nanoid: mockNanoid,
}));

jest.mock('@/services/error-reporting', () => ({
    reportError: mockReportError,
}));

describe('exercise skulpt flow', () => {
    beforeEach(() => {
        mockInsertedExercise = null;
        mockWorkoutExercisesById = {
            we1: {
                id: 'we1',
                workoutId: 'workout1',
                exerciseId: SOURCE_EXERCISE_ID,
                updatedAt: new Date('2026-03-22T12:00:00.000Z'),
            },
            we2: {
                id: 'we2',
                workoutId: 'workout2',
                exerciseId: SOURCE_EXERCISE_ID,
                updatedAt: new Date('2026-03-22T12:00:00.000Z'),
            },
        };

        mockQueueSyncOperation.mockClear();
        mockNanoid.mockClear();
        mockReportError.mockClear();
        mockDb.select.mockClear();
        mockDb.insert.mockClear();
        mockDb.update.mockClear();
    });

    test('forks skulpt exercise, sets skulptSourceId and remaps workout exercises', async () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { updateExercise } = require('./exercise');

        const savedExercise = await updateExercise(SOURCE_EXERCISE_ID, USER_ID, {
            name: 'Edited Name',
            description: 'Edited description',
        });

        expect(savedExercise.id).toBe(FORK_EXERCISE_ID);
        expect(savedExercise.userId).toBe(USER_ID);
        expect(savedExercise.source).toBe('user');
        expect(savedExercise.skulptSourceId).toBe(SOURCE_EXERCISE_ID);
        expect(savedExercise.name).toBe('Edited Name');
        expect(savedExercise.description).toBe('Edited description');
        expect(savedExercise.equipment).toEqual(['barbell', 'bench']);
        expect(savedExercise.mistakes).toEqual(['Elbows too wide']);
        expect(savedExercise.instructions).toEqual(['Keep scapula retracted']);
        expect(savedExercise.difficulty).toBe('beginner');
        expect(savedExercise.gifFilename).toBe('sk_bench-skulptSourceExercise01');

        expect(mockInsertedExercise).toEqual(
            expect.objectContaining({
                id: FORK_EXERCISE_ID,
                userId: USER_ID,
                source: 'user',
                skulptSourceId: SOURCE_EXERCISE_ID,
                name: 'Edited Name',
                description: 'Edited description',
                equipment: ['barbell', 'bench'],
                mistakes: ['Elbows too wide'],
                instructions: ['Keep scapula retracted'],
                difficulty: 'beginner',
                gifFilename: 'sk_bench-skulptSourceExercise01',
            }),
        );

        expect(mockWorkoutExercisesById.we1.exerciseId).toBe(FORK_EXERCISE_ID);
        expect(mockWorkoutExercisesById.we2.exerciseId).toBe(FORK_EXERCISE_ID);

        expect(mockQueueSyncOperation).toHaveBeenCalledTimes(3);
        expect(mockQueueSyncOperation).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                tableName: 'exercise',
                operation: 'create',
                recordId: FORK_EXERCISE_ID,
                data: expect.objectContaining({
                    skulptSourceId: SOURCE_EXERCISE_ID,
                    source: 'user',
                    equipment: ['barbell', 'bench'],
                    mistakes: ['Elbows too wide'],
                    instructions: ['Keep scapula retracted'],
                    difficulty: 'beginner',
                    description: 'Edited description',
                    gifFilename: 'sk_bench-skulptSourceExercise01',
                }),
            }),
        );

        const remapCalls = mockQueueSyncOperation.mock.calls.slice(1).map((call) => call[0]);
        expect(remapCalls).toHaveLength(2);
        for (const call of remapCalls) {
            expect(call).toEqual(
                expect.objectContaining({
                    tableName: 'workout_exercise',
                    operation: 'update',
                    data: expect.objectContaining({
                        exerciseId: FORK_EXERCISE_ID,
                    }),
                }),
            );
        }
    });
});
