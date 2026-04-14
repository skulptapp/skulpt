export const WEIGHT_MEASUREMENT_METRICS = [
    'body_weight',
    'body_fat_percentage',
    'lean_body_mass',
    'bone_mass',
    'body_water_mass',
    'body_mass_index',
    'waist_circumference',
] as const;

export const BODY_MEASUREMENT_METRICS = [
    'neck',
    'shoulders',
    'forearm_left',
    'forearm_right',
    'biceps_left',
    'biceps_right',
    'chest',
    'waist',
    'abdomen',
    'hips',
    'thigh_left',
    'thigh_right',
    'calf_left',
    'calf_right',
] as const;

export const ALL_MEASUREMENT_METRICS = [
    ...WEIGHT_MEASUREMENT_METRICS,
    ...BODY_MEASUREMENT_METRICS,
] as const;

export type MeasurementMetric = (typeof ALL_MEASUREMENT_METRICS)[number];

export const DEFAULT_MEASUREMENT_UNIT_BY_METRIC: Record<MeasurementMetric, string> = {
    body_weight: 'kg',
    body_fat_percentage: 'percent',
    lean_body_mass: 'kg',
    bone_mass: 'kg',
    body_water_mass: 'kg',
    body_mass_index: 'bmi',
    waist_circumference: 'cm',
    neck: 'cm',
    shoulders: 'cm',
    forearm_left: 'cm',
    forearm_right: 'cm',
    biceps_left: 'cm',
    biceps_right: 'cm',
    chest: 'cm',
    waist: 'cm',
    abdomen: 'cm',
    hips: 'cm',
    thigh_left: 'cm',
    thigh_right: 'cm',
    calf_left: 'cm',
    calf_right: 'cm',
};

export const BILATERAL_BODY_MEASUREMENT_GROUPS = [
    {
        key: 'forearms',
        left: 'forearm_left',
        right: 'forearm_right',
    },
    {
        key: 'biceps',
        left: 'biceps_left',
        right: 'biceps_right',
    },
    {
        key: 'thighs',
        left: 'thigh_left',
        right: 'thigh_right',
    },
    {
        key: 'calves',
        left: 'calf_left',
        right: 'calf_right',
    },
] as const;

export type MeasurementSource = 'manual' | 'health';
export type MeasurementSourcePlatform = 'ios_healthkit' | 'android_health_connect';
