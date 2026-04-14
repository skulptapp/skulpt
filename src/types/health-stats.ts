export interface HealthStats {
    avgHeartRate: number | null;
    minHeartRate: number | null;
    maxHeartRate: number | null;
    mhrUsed: number | null;
    avgIntensity: number | null;
    minIntensity: number | null;
    maxIntensity: number | null;
    activeCalories: number | null;
    totalCalories: number | null;
    heartRateRecovery: number | null;
    heartRateRecoveryTwoMinutes: number | null;
    activeScore: number | null;
    avgMets: number | null;
    distanceMeters: number | null;
    paceSecondsPerKm: number | null;
    cadence: number | null;
    zone1Seconds: number | null;
    zone2Seconds: number | null;
    zone3Seconds: number | null;
    zone4Seconds: number | null;
    zone5Seconds: number | null;
}

export interface HealthStatsDisplay extends HealthStats {
    zone1Minutes: number | null;
    zone2Minutes: number | null;
    zone3Minutes: number | null;
    zone4Minutes: number | null;
    zone5Minutes: number | null;
    hrTimeSeries: string | null;
    hrRecoverySeries: string | null;
}
