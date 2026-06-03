import { FC, useCallback, useMemo, useState } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { ViewToken } from '@shopify/flash-list';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';

import { PreviewThumbnail } from '@/components/layout/preview';

import { ExerciseList } from './index';
import { ExerciseListItemComponent } from '../card';
import {
    ExerciseCard,
    ExerciseListItem,
    createExerciseSearchIndex,
    filterGroupedExercisesByName,
    groupExercises,
    useDeleteExercise,
} from '@/hooks/use-exercises';
import type { ExerciseListSelect } from '@/crud/exercise';
import { StickyHeaderState } from '../header';
import { isSkulptExerciseUserId } from '@/constants/skulpt';

type ModeBrowse = {
    mode: 'browse';
    onExercisePress?: (exerciseId: string) => void;
};

type ModeSelect = {
    mode: 'select';
    selected: string[];
    onToggle: (exerciseId: string) => void;
};

type BaseProps = {
    rawExercises: ExerciseListSelect[] | undefined;
    query: string;
    isLoading?: boolean;
    error?: unknown;
    extraData?: unknown;
    contentContainerStyle?: StyleProp<ViewStyle>;
};

type ExercisesListContainerProps = BaseProps & (ModeBrowse | ModeSelect);

const styles = StyleSheet.create((theme) => ({
    previewThumbContainer: {
        marginLeft: theme.space(8),
    },
}));

const getListItemIdentity = (item: ExerciseListItem) => {
    if (item.type === 'exercise') {
        return `exercise:${item.exercise.id}`;
    }

    return `${item.type}:${item.name}`;
};

export const ExercisesListContainer: FC<ExercisesListContainerProps> = ({
    rawExercises,
    query,
    isLoading,
    error,
    extraData,
    contentContainerStyle,
    ...rest
}) => {
    const [stickyHeaderState, setStickyHeaderState] = useState<StickyHeaderState>({});

    const deleteExercise = useDeleteExercise();

    const groupedData = useMemo<ExerciseListItem[]>(() => {
        if (!rawExercises) return [];
        return groupExercises(rawExercises);
    }, [rawExercises]);

    const exerciseSearchIndex = useMemo(() => {
        return createExerciseSearchIndex(groupedData);
    }, [groupedData]);

    const data = useMemo<ExerciseListItem[]>(() => {
        const trimmedQuery = query.trim();
        if (!trimmedQuery) {
            return groupedData;
        }

        return filterGroupedExercisesByName(groupedData, trimmedQuery, exerciseSearchIndex);
    }, [exerciseSearchIndex, groupedData, query]);

    const stickyLookup = useMemo(() => {
        const categoryByIndex: (string | undefined)[] = [];
        const muscleGroupByIndex: (string | undefined)[] = [];
        let currentCategory: string | undefined;
        let currentMuscleGroup: string | undefined;

        for (let i = 0; i < data.length; i += 1) {
            const item = data[i];
            if (item?.type === 'category') {
                currentCategory = item.name;
                currentMuscleGroup = undefined;
            } else if (item?.type === 'muscle-group') {
                currentMuscleGroup = item.name;
            }

            categoryByIndex[i] = currentCategory;
            muscleGroupByIndex[i] = currentMuscleGroup;
        }

        return { categoryByIndex, muscleGroupByIndex };
    }, [data]);

    const listRemountKey = useMemo(() => {
        const rawCount = rawExercises?.length ?? 0;
        return `${rawCount}:${data.map(getListItemIdentity).join('|')}`;
    }, [data, rawExercises?.length]);

    const handleDelete = useCallback(
        (exerciseId: string) => {
            deleteExercise.mutate(exerciseId);
        },
        [deleteExercise],
    );

    const mode = rest.mode;
    const selectedList = mode === 'select' ? rest.selected : undefined;
    const onToggle = mode === 'select' ? rest.onToggle : undefined;
    const onExercisePress = mode === 'browse' ? rest.onExercisePress : undefined;

    const handleGifPreviewOpen = useCallback((name: string, gifFilename: string) => {
        router.navigate({
            pathname: '/preview',
            params: { name, gifFilename },
        });
    }, []);

    const renderGifAccessory = useCallback(
        (exerciseItem: ExerciseCard) => {
            return (
                <PreviewThumbnail
                    name={exerciseItem.exercise.name}
                    gifFilename={exerciseItem.exercise.gifFilename}
                    onOpen={handleGifPreviewOpen}
                    containerStyle={styles.previewThumbContainer}
                />
            );
        },
        [handleGifPreviewOpen],
    );

    const renderItem = useCallback(
        ({ item, index }: { item: ExerciseListItem; index: number }) => {
            if (item.type !== 'exercise') {
                return <ExerciseListItemComponent item={item} index={index} data={data} />;
            }

            if (mode === 'select' && selectedList && onToggle) {
                const canDelete = !isSkulptExerciseUserId(item.exercise.userId);
                return (
                    <ExerciseListItemComponent
                        item={item}
                        index={index}
                        data={data}
                        onDelete={canDelete ? handleDelete : undefined}
                        selectable
                        selected={selectedList.includes(item.exercise.id)}
                        onSelectToggle={onToggle}
                        selectionPosition="left"
                        renderRightAccessory={renderGifAccessory}
                    />
                );
            }

            if (mode === 'browse') {
                const canDelete = !isSkulptExerciseUserId(item.exercise.userId);
                return (
                    <ExerciseListItemComponent
                        item={item}
                        index={index}
                        data={data}
                        onDelete={canDelete ? handleDelete : undefined}
                        onPress={() => onExercisePress?.(item.exercise.id)}
                        renderRightAccessory={renderGifAccessory}
                    />
                );
            }

            return <></>;
        },
        [data, mode, selectedList, onToggle, onExercisePress, handleDelete, renderGifAccessory],
    );

    const getItemType = useCallback((item: ExerciseListItem) => item.type, []);

    const onViewableItemsChanged = useCallback(
        ({ viewableItems }: { viewableItems: ViewToken<ExerciseListItem>[] }) => {
            if (viewableItems.length === 0 || data.length === 0) {
                setStickyHeaderState((prev) =>
                    prev.category || prev.muscleGroup
                        ? { category: undefined, muscleGroup: undefined }
                        : prev,
                );
                return;
            }

            const firstVisibleIndex = Math.max(
                0,
                Math.min(viewableItems[0].index || 0, data.length - 1),
            );
            const category = stickyLookup.categoryByIndex[firstVisibleIndex];
            const muscleGroup = stickyLookup.muscleGroupByIndex[firstVisibleIndex];

            setStickyHeaderState((prev) =>
                prev.category === category && prev.muscleGroup === muscleGroup
                    ? prev
                    : { category, muscleGroup },
            );
        },
        [data, stickyLookup],
    );

    return (
        // Remount FlashList when the displayed rows change. Its internal
        // viewability/layout state can otherwise keep stale indices after
        // search or sync updates and crash before our viewability callback runs.
        <ExerciseList
            key={listRemountKey}
            data={data}
            renderItem={renderItem}
            getItemType={getItemType}
            onViewableItemsChanged={onViewableItemsChanged}
            stickyHeaderState={stickyHeaderState}
            extraData={extraData}
            isLoading={isLoading}
            error={error}
            contentContainerStyle={contentContainerStyle}
        />
    );
};
