import { describe, expect, test } from '@jest/globals';

import { getNotificationNavigation } from './notification-navigation';

describe('getNotificationNavigation', () => {
    test('does not navigate when the notification exercise is already open', () => {
        expect(
            getNotificationNavigation(
                'workout/workout-1/exercise-1/',
                '/workout/workout-1/exercise-1',
            ),
        ).toBeNull();
    });

    test('replaces an open workout exercise with the notification exercise', () => {
        expect(
            getNotificationNavigation(
                'workout/workout-1/exercise-2',
                '/workout/workout-1/exercise-1',
            ),
        ).toEqual({
            action: 'replace',
            path: '/workout/workout-1/exercise-2',
        });
    });

    test('navigates when no workout exercise is currently open', () => {
        expect(
            getNotificationNavigation('workout/workout-1/exercise-2', '/workout/workout-1'),
        ).toEqual({
            action: 'navigate',
            path: '/workout/workout-1/exercise-2',
        });
    });
});
