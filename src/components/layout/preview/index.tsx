import { FC, memo, useCallback, useMemo } from 'react';
import { GestureResponderEvent } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Image as ExpoImage } from 'expo-image';

import { Pressable } from '@/components/primitives/pressable';
import { buildExerciseGifUrl, EXERCISE_GIF_THUMBNAIL_RESOLUTION } from '@/constants/skulpt';
import { BoxProps } from '@/components/primitives/box';

const styles = StyleSheet.create((theme) => ({
    gifPreviewPressable: {
        width: theme.space(12),
        height: theme.space(12),
        marginRight: theme.space(4),
        borderRadius: theme.space(2),
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.background,
    },
    gifPreviewImage: {
        width: '100%',
        height: '100%',
    },
}));

interface PreviewThumbnailProps {
    name: string;
    gifFilename?: string | null;
    onOpen?: (name: string, gifFilename: string) => void;
    containerStyle?: BoxProps['style'];
}

const PreviewThumbnailComponent: FC<PreviewThumbnailProps> = ({
    name,
    gifFilename,
    onOpen,
    containerStyle,
}) => {
    const gifThumbnailUrl = useMemo(() => {
        if (!gifFilename) return '';
        return buildExerciseGifUrl(gifFilename, EXERCISE_GIF_THUMBNAIL_RESOLUTION);
    }, [gifFilename]);

    const handlePress = useCallback(
        (event: GestureResponderEvent) => {
            if (!gifFilename) return;
            event.stopPropagation();
            onOpen?.(name, gifFilename);
        },
        [name, gifFilename, onOpen],
    );

    if (!gifThumbnailUrl) return null;

    return (
        <Pressable
            onPress={handlePress}
            hitSlop={8}
            style={[styles.gifPreviewPressable, containerStyle]}
        >
            <ExpoImage
                source={{ uri: gifThumbnailUrl }}
                style={styles.gifPreviewImage}
                contentFit="cover"
                autoplay={false}
            />
        </Pressable>
    );
};

export const PreviewThumbnail = memo(PreviewThumbnailComponent);
