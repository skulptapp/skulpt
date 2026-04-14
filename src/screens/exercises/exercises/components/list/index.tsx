import { FC } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { FlashList, ViewToken } from '@shopify/flash-list';

import { Box } from '@/components/primitives/box';
import { ExerciseListItem } from '@/hooks/use-exercises';

import { StickyHeader, StickyHeaderState } from '../header';
import { EmptyState } from '../empty';
import { LoadingState } from '../loading';

const styles = StyleSheet.create((theme, rt) => ({
    listContainer: {
        flex: 1,
    },
}));

interface ExerciseListProps<T = React.ReactElement> {
    data: ExerciseListItem[];
    renderItem: ({ item, index }: { item: ExerciseListItem; index: number }) => T;
    getItemType: (item: ExerciseListItem) => string;
    onViewableItemsChanged?: ({
        viewableItems,
    }: {
        viewableItems: ViewToken<ExerciseListItem>[];
    }) => void;
    stickyHeaderState: StickyHeaderState;
    extraData?: unknown;
    isLoading?: boolean;
    error?: unknown;
    contentContainerStyle?: StyleProp<ViewStyle>;
}

export const ExerciseList: FC<ExerciseListProps> = ({
    data,
    renderItem,
    getItemType,
    onViewableItemsChanged,
    stickyHeaderState,
    extraData,
    isLoading,
    error,
    contentContainerStyle,
}) => {
    if (isLoading) return <LoadingState />;
    if (error) return <EmptyState />;
    if (!data || data.length === 0) return <EmptyState />;

    return (
        <Box style={styles.listContainer}>
            <StickyHeader state={stickyHeaderState} />
            <FlashList
                data={data}
                renderItem={renderItem}
                getItemType={getItemType}
                drawDistance={250}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={{ itemVisiblePercentThreshold: 10 }}
                contentContainerStyle={contentContainerStyle}
                extraData={extraData}
                keyExtractor={(item, index) => {
                    if (item.type === 'exercise') {
                        return item.exercise.id;
                    }
                    return `${item.type}-${item.name}-${index}`;
                }}
            />
        </Box>
    );
};
