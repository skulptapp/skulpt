const normalizeAppPath = (path: string) => {
    const withLeadingSlash = path.startsWith('/') ? path : `/${path}`;

    return withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, '') : withLeadingSlash;
};

const isWorkoutExercisePath = (path: string) => {
    const segments = path.split('/').filter(Boolean);
    return segments.length === 3 && segments[0] === 'workout';
};

export type NotificationNavigation = {
    action: 'navigate' | 'replace';
    path: string;
};

export const getNotificationNavigation = (
    notificationPath: string | null,
    currentPath: string,
): NotificationNavigation | null => {
    if (!notificationPath) return null;

    const targetPath = normalizeAppPath(notificationPath);
    const normalizedCurrentPath = normalizeAppPath(currentPath);
    if (targetPath === normalizedCurrentPath) return null;

    return {
        action:
            isWorkoutExercisePath(targetPath) && isWorkoutExercisePath(normalizedCurrentPath)
                ? 'replace'
                : 'navigate',
        path: targetPath,
    };
};
