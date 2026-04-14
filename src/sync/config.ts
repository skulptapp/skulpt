export const isSyncEnabled = (): boolean =>
    typeof process.env.EXPO_PUBLIC_SYNC_HOST === 'string' &&
    process.env.EXPO_PUBLIC_SYNC_HOST.length > 0;
