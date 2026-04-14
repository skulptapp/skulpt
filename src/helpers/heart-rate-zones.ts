export type MhrFormula = 'nes' | 'fox' | 'tanaka' | 'inbar' | 'gulati' | 'gellish' | 'manual';
export type HeartRateBiologicalSex = 'female' | 'male' | 'other';
export type HeartRateActivityLevel = 'sedentary' | 'active' | 'trained';

export type ZoneDefinition = {
    zone: 1 | 2 | 3 | 4 | 5;
    name: 'warmUp' | 'fatBurn' | 'cardio' | 'peak' | 'max';
    minPct: number;
    maxPctExclusive: number | null;
};

export const ZONE_DEFINITIONS = [
    { zone: 1, name: 'warmUp', minPct: 50, maxPctExclusive: 60 },
    { zone: 2, name: 'fatBurn', minPct: 60, maxPctExclusive: 70 },
    { zone: 3, name: 'cardio', minPct: 70, maxPctExclusive: 80 },
    { zone: 4, name: 'peak', minPct: 80, maxPctExclusive: 90 },
    { zone: 5, name: 'max', minPct: 90, maxPctExclusive: null },
] as const;

export interface HeartRateProfileSettings {
    mhrFormula?: MhrFormula | null;
    mhrManualValue?: number | null;
    birthday?: Date | null;
    biologicalSex?: HeartRateBiologicalSex | null;
    activityLevel?: HeartRateActivityLevel | null;
}

const roundToSingleDecimal = (value: number): number => Math.round(value * 10) / 10;
const floorMhr = (value: number): number => Math.floor(value);

export function getZoneDefinitions(): readonly ZoneDefinition[] {
    return ZONE_DEFINITIONS;
}

export function calculateAge(birthday: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthday.getFullYear();
    const m = today.getMonth() - birthday.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthday.getDate())) {
        age--;
    }
    return age;
}

export function calculateMHR(
    formula: MhrFormula,
    age: number,
    manualMhr?: number | null,
): number | null {
    switch (formula) {
        case 'nes':
            return 211 - 0.64 * age;
        case 'fox':
            return 220 - age;
        case 'tanaka':
            return 208 - 0.7 * age;
        case 'inbar':
            return 205.8 - 0.685 * age;
        case 'gulati':
            return 206 - 0.88 * age;
        case 'gellish':
            // Keep legacy support for older saved settings.
            return 207 - 0.7 * age;
        case 'manual':
            return manualMhr ?? null;
    }
}

export function resolveMhrFromProfile(
    profile: Pick<HeartRateProfileSettings, 'mhrFormula' | 'mhrManualValue' | 'birthday'>,
): number | null {
    const formula = profile.mhrFormula ?? 'nes';

    if (formula === 'manual') {
        return profile.mhrManualValue ?? null;
    }

    if (!profile.birthday) return null;

    const age = calculateAge(profile.birthday);
    return calculateMHR(formula, age, profile.mhrManualValue);
}

export function getZoneForHeartRate(hr: number, mhr: number): 0 | 1 | 2 | 3 | 4 | 5 {
    const effectiveMhr = Math.max(floorMhr(mhr), 1);
    const pct = (hr / effectiveMhr) * 100;
    if (pct >= 90) return 5;
    if (pct >= 80) return 4;
    if (pct >= 70) return 3;
    if (pct >= 60) return 2;
    if (pct >= 50) return 1;
    return 0;
}

export function calculateIntensity(hr: number, mhr: number): number {
    const effectiveMhr = Math.max(mhr, 1);
    return Math.max(0, Math.round((hr / effectiveMhr) * 100));
}

export interface HeartRateSample {
    timestamp: number;
    bpm: number;
}

export interface WorkoutHealthStats {
    mhrUsed: number;
    avgHeartRate: number;
    minHeartRate: number;
    maxHeartRate: number;
    avgIntensity: number;
    minIntensity: number;
    maxIntensity: number;
    activeScore: number;
    totalTrackedSeconds: number;
    zone1Seconds: number;
    zone2Seconds: number;
    zone3Seconds: number;
    zone4Seconds: number;
    zone5Seconds: number;
    zone1Minutes: number;
    zone2Minutes: number;
    zone3Minutes: number;
    zone4Minutes: number;
    zone5Minutes: number;
}

export function computeWorkoutHealthStats(
    samples: HeartRateSample[],
    mhr: number,
    startDate: Date,
    endDate: Date,
): WorkoutHealthStats | null {
    if (samples.length === 0 || mhr <= 0) return null;

    const sorted = [...samples].sort((a, b) => a.timestamp - b.timestamp);
    const workoutStartMs = startDate.getTime();
    const workoutEndMs = endDate.getTime();

    if (workoutEndMs <= workoutStartMs) return null;

    let weightedBpmTotal = 0;
    let totalDurationMs = 0;
    let minBpm = Infinity;
    let maxBpm = -Infinity;
    const zoneSeconds = [0, 0, 0, 0, 0];

    const accumulateZoneSegment = (bpm: number, segmentStartMs: number, segmentEndMs: number) => {
        if (segmentEndMs <= segmentStartMs) return;

        const durationMs = segmentEndMs - segmentStartMs;
        weightedBpmTotal += bpm * durationMs;
        totalDurationMs += durationMs;

        if (bpm < minBpm) minBpm = bpm;
        if (bpm > maxBpm) maxBpm = bpm;

        const zone = getZoneForHeartRate(bpm, mhr);
        if (zone > 0) {
            zoneSeconds[zone - 1] += durationMs / 1000;
        }
    };

    const inWorkoutSamples = sorted.filter(
        (sample) => sample.timestamp >= workoutStartMs && sample.timestamp <= workoutEndMs,
    );

    if (inWorkoutSamples.length === 0) {
        return null;
    }

    const firstSample = inWorkoutSamples[0];
    const lastSample = inWorkoutSamples[inWorkoutSamples.length - 1];

    if (firstSample.timestamp > workoutStartMs) {
        // Match the reference app more closely by extending the first in-workout sample
        // back to the workout start instead of interpolating against an external sample.
        accumulateZoneSegment(firstSample.bpm, workoutStartMs, firstSample.timestamp);
    }

    for (let i = 0; i < inWorkoutSamples.length - 1; i++) {
        const currentSample = inWorkoutSamples[i];
        const nextSample = inWorkoutSamples[i + 1];
        accumulateZoneSegment(currentSample.bpm, currentSample.timestamp, nextSample.timestamp);
    }

    if (lastSample.timestamp < workoutEndMs) {
        // Use the last in-workout value to cover the tail. This avoids borrowing
        // post-workout recovery samples into the zone breakdown.
        accumulateZoneSegment(lastSample.bpm, lastSample.timestamp, workoutEndMs);
    }

    if (totalDurationMs <= 0 || minBpm === Infinity || maxBpm === -Infinity) {
        return null;
    }

    const avgBpm = Math.round(weightedBpmTotal / totalDurationMs);
    return {
        mhrUsed: floorMhr(mhr),
        avgHeartRate: avgBpm,
        minHeartRate: minBpm,
        maxHeartRate: maxBpm,
        avgIntensity: calculateIntensity(avgBpm, mhr),
        minIntensity: calculateIntensity(minBpm, mhr),
        maxIntensity: calculateIntensity(maxBpm, mhr),
        // Active Score: zone2 × 1 + (zone3 + zone4 + zone5) × 2
        activeScore: Math.round(
            zoneSeconds[1] / 60 + ((zoneSeconds[2] + zoneSeconds[3] + zoneSeconds[4]) / 60) * 2,
        ),
        totalTrackedSeconds: Math.round(totalDurationMs / 1000),
        zone1Seconds: Math.round(zoneSeconds[0]),
        zone2Seconds: Math.round(zoneSeconds[1]),
        zone3Seconds: Math.round(zoneSeconds[2]),
        zone4Seconds: Math.round(zoneSeconds[3]),
        zone5Seconds: Math.round(zoneSeconds[4]),
        zone1Minutes: roundToSingleDecimal(zoneSeconds[0] / 60),
        zone2Minutes: roundToSingleDecimal(zoneSeconds[1] / 60),
        zone3Minutes: roundToSingleDecimal(zoneSeconds[2] / 60),
        zone4Minutes: roundToSingleDecimal(zoneSeconds[3] / 60),
        zone5Minutes: roundToSingleDecimal(zoneSeconds[4] / 60),
    };
}

const getLatestSampleBeforeOrAt = (
    samples: HeartRateSample[],
    targetMs: number,
    minMs: number,
): HeartRateSample | null => {
    for (let index = samples.length - 1; index >= 0; index -= 1) {
        const sample = samples[index]!;
        if (sample.timestamp > targetMs) continue;
        if (sample.timestamp < minMs) break;
        return sample;
    }

    return null;
};

const getEarliestSampleAfterOrAt = (
    samples: HeartRateSample[],
    targetMs: number,
    maxMs: number,
): HeartRateSample | null => {
    for (const sample of samples) {
        if (sample.timestamp < targetMs) continue;
        if (sample.timestamp > maxMs) break;
        return sample;
    }

    return null;
};

const getClosestSample = (
    samples: HeartRateSample[],
    targetMs: number,
    minMs: number,
    maxMs: number,
): HeartRateSample | null => {
    let closest: HeartRateSample | null = null;
    let closestDelta = Infinity;

    for (const sample of samples) {
        if (sample.timestamp < minMs) continue;
        if (sample.timestamp > maxMs) break;

        const delta = Math.abs(sample.timestamp - targetMs);
        if (delta < closestDelta) {
            closest = sample;
            closestDelta = delta;
        }
    }

    return closest;
};

const getInterpolatedBpmAt = (
    samples: HeartRateSample[],
    targetMs: number,
    minMs: number,
    maxMs: number,
): number | null => {
    const before = getLatestSampleBeforeOrAt(samples, targetMs, minMs);
    const after = getEarliestSampleAfterOrAt(samples, targetMs, maxMs);

    if (before && after) {
        if (before.timestamp === after.timestamp) {
            return before.bpm;
        }

        if (before.timestamp === targetMs) {
            return before.bpm;
        }

        if (after.timestamp === targetMs) {
            return after.bpm;
        }

        const span = after.timestamp - before.timestamp;
        if (span > 0) {
            const progress = (targetMs - before.timestamp) / span;
            return before.bpm + (after.bpm - before.bpm) * progress;
        }
    }

    if (before) return before.bpm;
    if (after) return after.bpm;

    return getClosestSample(samples, targetMs, minMs, maxMs)?.bpm ?? null;
};

export function computeHeartRateRecovery(
    samples: HeartRateSample[],
    workoutEndDate: Date,
    mhr: number,
    minutes = 1,
): number | null {
    if (samples.length === 0 || mhr <= 0 || minutes <= 0) return null;

    const sorted = [...samples].sort((a, b) => a.timestamp - b.timestamp);
    const workoutEndMs = workoutEndDate.getTime();
    const stopBpm =
        getLatestSampleBeforeOrAt(sorted, workoutEndMs, workoutEndMs - 30_000)?.bpm ??
        getClosestSample(sorted, workoutEndMs, workoutEndMs - 30_000, workoutEndMs + 15_000)?.bpm;

    if (stopBpm == null) return null;

    const targetMs = workoutEndMs + minutes * 60_000;
    const recoveryBpm = getInterpolatedBpmAt(
        sorted,
        targetMs,
        targetMs - 30_000,
        targetMs + 30_000,
    );

    if (recoveryBpm == null) return null;

    return Math.round(stopBpm - recoveryBpm);
}
