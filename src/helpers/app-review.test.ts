// @ts-nocheck
import { isEligibleWorkoutCount, isQualifyingWorkoutDuration } from './app-review';

describe('app review eligibility', () => {
    test('requires workout duration greater than 15 minutes', () => {
        expect(isQualifyingWorkoutDuration(null)).toBe(false);
        expect(isQualifyingWorkoutDuration(15 * 60)).toBe(false);
        expect(isQualifyingWorkoutDuration(15 * 60 + 1)).toBe(true);
    });

    test('requires at least 5 qualifying workouts', () => {
        expect(isEligibleWorkoutCount(4)).toBe(false);
        expect(isEligibleWorkoutCount(5)).toBe(true);
    });
});
