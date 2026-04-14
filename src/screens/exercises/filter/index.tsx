import { FC, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { router } from 'expo-router';
import { ScrollView } from 'react-native';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/primitives/box';
import { VStack } from '@/components/primitives/vstack';
import { Buttons } from '@/components/forms/fields/buttons';
import { Choices } from '@/components/forms/fields/choices';
import { Label } from '@/components/forms/fields/components';
import { muscles } from '@/constants/muscles';
import { useFilterStore } from '@/stores/filter';
import type { ExerciseOwnershipFilter } from '@/stores/filter';

import { Header } from './components/header';

const getFilterState = () => useFilterStore.getState();

const categories = ['strength', 'cardio', 'flexibility', 'yoga', 'pilates', 'other'];

const trackingOptions = [
    { value: ['weight', 'reps'] },
    { value: ['time'] },
    { value: ['reps'] },
    { value: ['time', 'reps'] },
];

type FilterForm = {
    ownership: ExerciseOwnershipFilter;
    category: string[] | null;
    tracking: string[][] | null;
    primaryMuscle: string[] | null;
};

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.foreground,
    },
    content: {
        flex: 1,
    },
    scroll: {
        ...theme.screenContentPadding('child'),
        paddingHorizontal: theme.space(4),
        gap: theme.space(6),
    },
    section: {
        gap: theme.space(2),
    },
    muscleContainer: {},
}));

const FilterScreen: FC = () => {
    const { t } = useTranslation(['common', 'screens']);
    const [initialValues] = useState(getFilterState);

    const { control, getValues } = useForm<FilterForm>({
        defaultValues: {
            ownership: initialValues.ownership,
            category: initialValues.category,
            tracking: initialValues.tracking,
            primaryMuscle: initialValues.primaryMuscle,
        },
    });

    const flushToStore = () => {
        const values = getValues();

        const { setOwnership, setCategory, setTracking, setPrimaryMuscle } = getFilterState();

        setOwnership(values.ownership);
        setCategory(values.category);
        setTracking(values.tracking);
        setPrimaryMuscle(values.primaryMuscle);
    };

    const handleClose = () => {
        router.back();
        requestAnimationFrame(flushToStore);
    };

    const ownershipChoices = useMemo(
        () => [
            {
                value: 'all',
                title: t('filter.ownership.all', { ns: 'screens' }),
            },
            {
                value: 'mine',
                title: t('filter.ownership.mine', { ns: 'screens' }),
            },
            {
                value: 'system',
                title: t('filter.ownership.system', { ns: 'screens' }),
            },
        ],
        [t],
    );

    const categoryChoices = useMemo(
        () =>
            categories.map((v) => ({
                value: v,
                title: t(`exerciseCategory.${v}`, { ns: 'common' }),
            })),
        [t],
    );

    const trackingChoices = useMemo(
        () =>
            trackingOptions.map((v) => ({
                value: v.value,
                title: v.value
                    .map((t_) => t(`exerciseTracking.${t_}`, { ns: 'common' }))
                    .join(' + '),
            })),
        [t],
    );

    const muscleGroups = useMemo(() => {
        type MuscleNode = { value: string; choices?: MuscleNode[] };
        type NestedChoice = { value: string; title: string; children?: NestedChoice[] };

        const mapMuscleNodes = (nodes: MuscleNode[]): NestedChoice[] => {
            return nodes.map((node) => ({
                value: node.value,
                title: t(`muscleGroup.${node.value}`, { ns: 'common' }),
                children: node.choices?.length ? mapMuscleNodes(node.choices) : undefined,
            }));
        };

        return muscles.map((muscleGroup) => {
            if (muscleGroup.title) {
                return {
                    title: t(`muscleGroup.${muscleGroup.title}`, { ns: 'common' }),
                    choices: mapMuscleNodes(muscleGroup.choices),
                };
            }

            if (muscleGroup.value) {
                return {
                    choices: mapMuscleNodes([
                        {
                            value: muscleGroup.value,
                            choices: muscleGroup.choices,
                        },
                    ]),
                };
            }

            return {
                choices: mapMuscleNodes(muscleGroup.choices),
            };
        });
    }, [t]);

    return (
        <Box style={styles.container}>
            <Header handleClose={handleClose} />
            <Box style={styles.content}>
                <ScrollView contentContainerStyle={styles.scroll}>
                    <VStack style={styles.section}>
                        <Label>{t('filter.ownership.title', { ns: 'screens' })}</Label>
                        <Buttons
                            name="ownership"
                            control={control}
                            type="radio"
                            choices={ownershipChoices}
                        />
                    </VStack>
                    <VStack style={styles.section}>
                        <Label>{t('filter.category.title', { ns: 'screens' })}</Label>
                        <Buttons
                            name="category"
                            control={control}
                            type="checkbox"
                            choices={categoryChoices}
                        />
                    </VStack>
                    <VStack style={styles.section}>
                        <Label>{t('filter.tracking.title', { ns: 'screens' })}</Label>
                        <Choices
                            name="tracking"
                            control={control}
                            type="checkbox"
                            style="compact"
                            choices={trackingChoices}
                        />
                    </VStack>
                    <VStack style={styles.section}>
                        <Label>{t('filter.primaryMuscle.title', { ns: 'screens' })}</Label>
                        <Choices
                            name="primaryMuscle"
                            control={control}
                            type="checkbox"
                            groups={muscleGroups}
                        />
                    </VStack>
                </ScrollView>
            </Box>
        </Box>
    );
};

export default FilterScreen;
