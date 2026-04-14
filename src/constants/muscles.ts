export interface MuscleChoice {
    value: string;
    choices?: MuscleChoice[];
}

export interface MuscleGroup {
    title?: string;
    value?: string;
    choices: MuscleChoice[];
}

export type MuscleSelection = string[] | null | undefined;

export const muscles: MuscleGroup[] = [
    {
        choices: [
            {
                value: 'neck',
                choices: [
                    { value: 'sternocleidomastoid' },
                    { value: 'scalenes' },
                    { value: 'splenius_capitis' },
                ],
            },
        ],
    },
    {
        value: 'shoulders',
        choices: [
            { value: 'front_deltoid' },
            { value: 'lateral_deltoid' },
            { value: 'rear_deltoid' },
            {
                value: 'rotator_cuff',
                choices: [
                    { value: 'supraspinatus' },
                    { value: 'infraspinatus' },
                    { value: 'teres_minor' },
                    { value: 'subscapularis' },
                ],
            },
        ],
    },
    {
        value: 'chest',
        choices: [
            {
                value: 'pectoralis_major',
                choices: [
                    { value: 'clavicular_head' },
                    { value: 'sternal_head' },
                    { value: 'abdominal_head' },
                ],
            },
            { value: 'pectoralis_minor' },
            { value: 'serratus_anterior' },
        ],
    },
    {
        value: 'arms',
        choices: [
            {
                value: 'biceps',
                choices: [
                    { value: 'biceps_long_head' },
                    { value: 'biceps_short_head' },
                    { value: 'brachialis' },
                ],
            },
            {
                value: 'triceps',
                choices: [
                    { value: 'triceps_long_head' },
                    { value: 'triceps_lateral_head' },
                    { value: 'triceps_medial_head' },
                ],
            },
            {
                value: 'forearms',
                choices: [
                    { value: 'brachioradialis' },
                    { value: 'wrist_flexors' },
                    { value: 'wrist_extensors' },
                ],
            },
        ],
    },
    {
        value: 'back',
        choices: [
            {
                value: 'traps',
                choices: [
                    { value: 'upper_traps' },
                    { value: 'middle_traps' },
                    { value: 'lower_traps' },
                ],
            },
            {
                value: 'lats',
                choices: [{ value: 'latissimus_dorsi' }, { value: 'teres_major' }],
            },
            {
                value: 'rhomboids',
                choices: [{ value: 'rhomboid_major' }, { value: 'rhomboid_minor' }],
            },
            {
                value: 'lower_back',
                choices: [
                    { value: 'erector_spinae' },
                    { value: 'multifidus' },
                    { value: 'quadratus_lumborum' },
                ],
            },
        ],
    },
    {
        value: 'abs',
        choices: [
            {
                value: 'rectus_abdominis',
                choices: [{ value: 'upper_abs' }, { value: 'lower_abs' }],
            },
            {
                value: 'transverse_abdominis',
            },
            {
                value: 'obliques',
                choices: [{ value: 'external_obliques' }, { value: 'internal_obliques' }],
            },
        ],
    },
    {
        value: 'legs',
        choices: [
            {
                value: 'glutes',
                choices: [
                    { value: 'gluteus_maximus' },
                    { value: 'gluteus_medius' },
                    { value: 'gluteus_minimus' },
                ],
            },
            {
                value: 'hip_abductors',
                choices: [{ value: 'tensor_fasciae_latae' }],
            },
            {
                value: 'hip_external_rotators',
                choices: [{ value: 'piriformis' }, { value: 'obturator_internus' }],
            },
            {
                value: 'adductors',
                choices: [
                    { value: 'adductor_longus' },
                    { value: 'adductor_brevis' },
                    { value: 'adductor_magnus' },
                    { value: 'gracilis' },
                ],
            },
            {
                value: 'hip_flexors',
                choices: [{ value: 'iliopsoas' }, { value: 'sartorius' }, { value: 'pectineus' }],
            },
            {
                value: 'hamstrings',
                choices: [
                    { value: 'biceps_femoris' },
                    { value: 'semitendinosus' },
                    { value: 'semimembranosus' },
                ],
            },
            {
                value: 'quads',
                choices: [
                    { value: 'rectus_femoris' },
                    { value: 'vastus_lateralis' },
                    { value: 'vastus_medialis' },
                    { value: 'vastus_intermedius' },
                ],
            },
            {
                value: 'calves',
                choices: [
                    { value: 'gastrocnemius_medial_head' },
                    { value: 'gastrocnemius_lateral_head' },
                    { value: 'soleus' },
                ],
            },
            {
                value: 'shins',
                choices: [{ value: 'tibialis_anterior' }],
            },
        ],
    },
];

// Backward compatibility with production values from the previous muscle schema.
export const legacyMuscleAliasMap: Record<string, string> = {
    upper_chest: 'clavicular_head',
    middle_chest: 'sternal_head',
    lower_chest: 'abdominal_head',
    abductors: 'hip_abductors',
};

export const normalizeMuscleValue = (value: string | null | undefined): string | null => {
    if (!value) return null;
    return legacyMuscleAliasMap[value] || value;
};

const muscleToTopLevelMap: Record<string, string> = {};
const muscleParentMap: Record<string, string | null> = {};

const mapChoices = (choices: MuscleChoice[], topLevelValue: string, parentValue: string) => {
    choices.forEach((choice) => {
        muscleToTopLevelMap[choice.value] = topLevelValue;
        muscleParentMap[choice.value] = parentValue;
        if (choice.choices?.length) {
            mapChoices(choice.choices, topLevelValue, choice.value);
        }
    });
};

muscles.forEach((group) => {
    if (group.value) {
        muscleToTopLevelMap[group.value] = group.value;
        muscleParentMap[group.value] = null;
        mapChoices(group.choices, group.value, group.value);
        return;
    }

    if (group.title) {
        group.choices.forEach((choice) => {
            muscleToTopLevelMap[choice.value] = group.title!;
            muscleParentMap[choice.value] = null;
            if (choice.choices?.length) {
                mapChoices(choice.choices, group.title!, choice.value);
            }
        });
        return;
    }

    group.choices.forEach((choice) => {
        muscleToTopLevelMap[choice.value] = choice.value;
        muscleParentMap[choice.value] = null;
        if (choice.choices?.length) {
            mapChoices(choice.choices, choice.value, choice.value);
        }
    });
});

Object.entries(legacyMuscleAliasMap).forEach(([legacyValue, canonicalValue]) => {
    muscleToTopLevelMap[legacyValue] = muscleToTopLevelMap[canonicalValue] || canonicalValue;
    muscleParentMap[legacyValue] = muscleParentMap[canonicalValue] || null;
});

export const getTopLevelMuscleValue = (value: string | null | undefined): string | null => {
    const normalizedValue = normalizeMuscleValue(value);
    if (!normalizedValue) return null;
    return muscleToTopLevelMap[normalizedValue] || normalizedValue;
};

const isMuscleAncestor = (candidate: string, value: string): boolean => {
    let current = muscleParentMap[value] || null;

    while (current) {
        if (current === candidate) {
            return true;
        }
        current = muscleParentMap[current] || null;
    }

    return false;
};

export const muscleValuesConflict = (
    left: string | null | undefined,
    right: string | null | undefined,
): boolean => {
    const normalizedLeft = normalizeMuscleValue(left);
    const normalizedRight = normalizeMuscleValue(right);

    if (!normalizedLeft || !normalizedRight) {
        return false;
    }

    return (
        normalizedLeft === normalizedRight ||
        isMuscleAncestor(normalizedLeft, normalizedRight) ||
        isMuscleAncestor(normalizedRight, normalizedLeft)
    );
};

export const normalizeMuscleValues = (values: MuscleSelection): string[] | null => {
    if (!Array.isArray(values) || values.length === 0) {
        return null;
    }

    const unique = values.reduce<string[]>((acc, value) => {
        const normalized = normalizeMuscleValue(value);

        if (!normalized || acc.includes(normalized)) {
            return acc;
        }

        acc.push(normalized);
        return acc;
    }, []);

    const withoutAncestors = unique.filter(
        (value, index) =>
            !unique.some(
                (otherValue, otherIndex) =>
                    index !== otherIndex && isMuscleAncestor(value, otherValue),
            ),
    );

    return withoutAncestors.length > 0 ? withoutAncestors : null;
};

export const getTopLevelMuscleValues = (values: MuscleSelection): string[] | null => {
    const normalized = normalizeMuscleValues(values);

    if (!normalized) {
        return null;
    }

    const uniqueTopLevel = normalized.reduce<string[]>((acc, value) => {
        const topLevel = getTopLevelMuscleValue(value);

        if (!topLevel || acc.includes(topLevel)) {
            return acc;
        }

        acc.push(topLevel);
        return acc;
    }, []);

    return uniqueTopLevel.length > 0 ? uniqueTopLevel : null;
};

export const getPrimaryAnchorMuscleValue = (values: MuscleSelection): string | null => {
    return getTopLevelMuscleValues(values)?.[0] || null;
};

export const sanitizeMuscleGroupSelections = ({
    primary,
    secondary,
}: {
    primary: MuscleSelection;
    secondary: MuscleSelection;
}): {
    primary: string[] | null;
    secondary: string[] | null;
} => {
    const normalizedPrimary = normalizeMuscleValues(primary);
    const normalizedSecondary = normalizeMuscleValues(secondary);

    if (!normalizedPrimary) {
        return {
            primary: null,
            secondary: normalizedSecondary,
        };
    }

    const filteredSecondary =
        normalizedSecondary?.filter(
            (secondaryValue) =>
                !normalizedPrimary.some((primaryValue) =>
                    muscleValuesConflict(primaryValue, secondaryValue),
                ),
        ) || null;

    return {
        primary: normalizedPrimary,
        secondary: filteredSecondary && filteredSecondary.length > 0 ? filteredSecondary : null,
    };
};

/**
 * Expands a list of muscle values to include all conflicting values
 * (self + all ancestors + all descendants) for use in SQL filtering.
 */
export const expandMuscleValues = (values: string[]): string[] => {
    const allMuscleKeys = Object.keys(muscleParentMap);
    const expanded = new Set<string>();

    for (const value of values) {
        const normalized = normalizeMuscleValue(value);
        if (!normalized) continue;

        for (const key of allMuscleKeys) {
            if (muscleValuesConflict(normalized, key)) {
                expanded.add(key);
            }
        }
    }

    return Array.from(expanded);
};
