import { FC, useCallback, useMemo, useRef, useState } from 'react';
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
    const searchCacheRef = useRef<{
        query: string;
        source: ExerciseListItem[] | null;
        result: ExerciseListItem[];
    }>({
        query: '',
        source: null,
        result: [],
    });

    const deleteExercise = useDeleteExercise();

    const groupedData = useMemo<ExerciseListItem[]>(() => {
        if (!rawExercises) return [];
        return groupExercises(rawExercises);
    }, [rawExercises]);

    const data = useMemo<ExerciseListItem[]>(() => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) {
            searchCacheRef.current = {
                query: '',
                source: groupedData,
                result: groupedData,
            };
            return groupedData;
        }

        const cache = searchCacheRef.current;
        const canReusePrefixSearch =
            cache.source === groupedData &&
            cache.query.length > 0 &&
            normalizedQuery.startsWith(cache.query);
        const source = canReusePrefixSearch ? cache.result : groupedData;
        const result = filterGroupedExercisesByName(source, normalizedQuery);

        searchCacheRef.current = {
            query: normalizedQuery,
            source: groupedData,
            result,
        };

        return result;
    }, [groupedData, query]);

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
        <ExerciseList
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
