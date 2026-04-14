export const waitForIdle = async (timeoutMs: number = 500): Promise<void> => {
    await new Promise<void>((resolve) => {
        const idleApi = globalThis as typeof globalThis & {
            requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
        };

        if (typeof idleApi.requestIdleCallback === 'function') {
            idleApi.requestIdleCallback(() => resolve(), { timeout: timeoutMs });
            return;
        }

        setTimeout(resolve, 0);
    });
};
