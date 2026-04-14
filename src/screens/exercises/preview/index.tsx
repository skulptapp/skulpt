import { FC, useMemo } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { router, useLocalSearchParams } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';

import { Box } from '@/components/primitives/box';
import { buildExerciseGifUrl, EXERCISE_GIF_PREVIEW_RESOLUTION } from '@/constants/skulpt';

import { Header } from './components/header';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.white,
    },
    gifContainer: {
        flex: 1,
        paddingHorizontal: theme.space(4),
        paddingVertical: theme.space(4),
        justifyContent: 'center',
    },
    gifImage: {
        width: '100%',
        height: '100%',
    },
}));

const normalizeParam = (value: string | string[] | undefined): string => {
    if (Array.isArray(value)) {
        return value[0] ?? '';
    }
    return value ?? '';
};

const PreviewScreen: FC = () => {
    const { gifFilename, name } = useLocalSearchParams<{
        gifFilename?: string | string[];
        name?: string;
    }>();

    const gifUrl = useMemo(() => {
        const filename = normalizeParam(gifFilename);
        if (!filename) return '';
        return buildExerciseGifUrl(filename, EXERCISE_GIF_PREVIEW_RESOLUTION);
    }, [gifFilename]);

    const handleClose = () => {
        router.back();
    };

    return (
        <Box style={styles.container}>
            <Header exerciseName={name} handleClose={handleClose} />
            {gifUrl ? (
                <Box style={styles.gifContainer}>
                    <ExpoImage
                        source={{ uri: gifUrl }}
                        style={styles.gifImage}
                        contentFit="contain"
                        autoplay
                    />
                </Box>
            ) : null}
        </Box>
    );
};

export default PreviewScreen;
