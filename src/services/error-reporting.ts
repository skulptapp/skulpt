import * as Sentry from '@sentry/react-native';

type ErrorMetadata = {
    extras?: Record<string, unknown>;
    tags?: Record<string, string>;
};

const toError = (error: unknown, context: string): Error => {
    if (error instanceof Error) {
        return error;
    }

    if (typeof error === 'string' && error.trim().length > 0) {
        return new Error(`${context} ${error}`);
    }

    return new Error(context);
};

export const reportError = (
    error: unknown,
    context: string,
    metadata: ErrorMetadata = {},
): void => {
    if (__DEV__) {
        if (metadata.extras) {
            console.error(context, {
                error,
                ...metadata.extras,
            });
            return;
        }

        console.error(context, error);
        return;
    }

    Sentry.withScope((scope) => {
        scope.setExtra('errorContext', context);

        for (const [key, value] of Object.entries(metadata.extras ?? {})) {
            scope.setExtra(key, value);
        }

        for (const [key, value] of Object.entries(metadata.tags ?? {})) {
            scope.setTag(key, value);
        }

        if (!(error instanceof Error)) {
            scope.setExtra('errorValue', error);
        }

        Sentry.captureException(toError(error, context));
    });
};

export const runInBackground = (
    task: Promise<unknown> | (() => Promise<unknown> | unknown),
    context: string,
): void => {
    try {
        const result = typeof task === 'function' ? task() : task;

        if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
            void Promise.resolve(result).catch((error) => {
                reportError(error, context);
            });
        }
    } catch (error) {
        reportError(error, context);
    }
};
