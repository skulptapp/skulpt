import { describe, expect, test } from '@jest/globals';

import {
    getCampaignProperties,
    getSearchRankBucket,
    getSearchScriptGroup,
    isFirstAnalyticsSession,
} from './helpers';

describe('analytics helpers', () => {
    test('keeps only supported campaign fields and normalizes their values', () => {
        expect(
            getCampaignProperties({
                utm_source: '  reddit  ',
                utm_medium: ['social', 'ignored'],
                utm_campaign: 'x'.repeat(120),
                query: 'private search text',
                token: 'secret',
            }),
        ).toEqual({
            campaignSource: 'reddit',
            campaignMedium: 'social',
            campaignName: 'x'.repeat(100),
        });
    });

    test('does not classify an existing user as new when analytics is first introduced', () => {
        const nowMs = Date.parse('2026-07-16T12:00:00.000Z');

        expect(
            isFirstAnalyticsSession({
                hasStartedSession: false,
                userCreatedAtMs: nowMs - 60_000,
                nowMs,
            }),
        ).toBe(true);
        expect(
            isFirstAnalyticsSession({
                hasStartedSession: false,
                userCreatedAtMs: nowMs - 24 * 60 * 60 * 1000,
                nowMs,
            }),
        ).toBe(false);
        expect(
            isFirstAnalyticsSession({
                hasStartedSession: true,
                userCreatedAtMs: nowMs - 60_000,
                nowMs,
            }),
        ).toBe(false);
    });

    const scriptCases: [string, ReturnType<typeof getSearchScriptGroup>][] = [
        ['bench press', 'latin'],
        ['жим лежа', 'cyrillic'],
        ['卧推', 'han'],
        ['बेंच प्रेस', 'devanagari'],
        ['жим press', 'mixed'],
        ['123', 'other'],
    ];

    test.each(scriptCases)('classifies search script for %s', (query, expected) => {
        expect(getSearchScriptGroup(query)).toBe(expected);
    });

    const rankCases: [number, ReturnType<typeof getSearchRankBucket>][] = [
        [1, '1'],
        [2, '2_3'],
        [3, '2_3'],
        [4, '4_10'],
        [10, '4_10'],
        [11, '11_plus'],
    ];

    test.each(rankCases)('buckets result rank %s', (rank, expected) => {
        expect(getSearchRankBucket(rank)).toBe(expected);
    });
});
