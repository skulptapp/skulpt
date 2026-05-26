// @ts-nocheck
const mockGet = jest.fn();
const mockPost = jest.fn();
const mockReportError = jest.fn();

jest.mock('axios', () => ({
    create: jest.fn(() => ({
        get: (...args: unknown[]) => mockGet(...args),
        post: (...args: unknown[]) => mockPost(...args),
        interceptors: {
            request: { use: jest.fn() },
            response: { use: jest.fn() },
        },
    })),
    isAxiosError: (error: unknown) =>
        typeof error === 'object' &&
        error !== null &&
        (error as { isAxiosError?: boolean }).isAxiosError === true,
}));

jest.mock('@/services/error-reporting', () => ({
    reportError: (...args: unknown[]) => mockReportError(...args),
}));

jest.mock('@/services/auth', () => ({
    bootstrapAuth: jest.fn(),
    clearToken: jest.fn(),
    getStoredToken: jest.fn(),
    isTokenValid: jest.fn(() => false),
}));

jest.mock('@/storage', () => ({
    storage: {
        getString: jest.fn(),
    },
}));

const loadApiModule = () => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./index');
};

describe('sync API error reporting', () => {
    beforeEach(() => {
        mockGet.mockReset();
        mockPost.mockReset();
        mockReportError.mockReset();
    });

    test('does not report retryable pull HTTP failures to Sentry', async () => {
        const { getServerChanges } = loadApiModule();

        mockGet.mockRejectedValue({
            isAxiosError: true,
            response: {
                status: 504,
                data: '',
            },
        });

        const result = await getServerChanges(1775134883722, 'user_1', {
            syncType: 'skulpt',
            locale: 'en',
        });

        expect(result).toEqual({
            success: false,
            error: 'SERVER_ERROR',
            status: 504,
            type: undefined,
            code: undefined,
            table: undefined,
            id: undefined,
        });
        expect(mockReportError).not.toHaveBeenCalled();
    });

    test('does not report retryable push HTTP failures to Sentry', async () => {
        const { sendChangesToServer } = loadApiModule();

        mockPost.mockRejectedValue({
            isAxiosError: true,
            response: {
                status: 504,
                data: '',
            },
        });

        const result = await sendChangesToServer({
            user: {
                created: [{ id: 'user_1' }],
                updated: [],
                deleted: [],
            },
        });

        expect(result).toEqual({
            success: false,
            error: 'SERVER_ERROR',
            status: 504,
            type: undefined,
            code: undefined,
            table: undefined,
            id: undefined,
        });
        expect(mockReportError).not.toHaveBeenCalled();
    });

    test('still reports non-retryable pull HTTP failures to Sentry', async () => {
        const { getServerChanges } = loadApiModule();
        const error = {
            isAxiosError: true,
            response: {
                status: 400,
                data: { message: 'bad request' },
            },
        };

        mockGet.mockRejectedValue(error);

        const result = await getServerChanges(1000, 'user_1', {
            syncType: 'user',
        });

        expect(result).toEqual({
            success: false,
            error: 'BAD_REQUEST',
            status: 400,
            type: undefined,
            code: undefined,
            table: undefined,
            id: undefined,
        });
        expect(mockReportError).toHaveBeenCalledWith(error, '[sync-api] Request failed:', {
            extras: expect.objectContaining({
                requestType: 'pull',
                resolvedError: 'BAD_REQUEST',
                status: 400,
            }),
            tags: {
                scope: 'sync-api',
            },
        });
    });
});
