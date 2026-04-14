import { FC } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Box } from '@/components/primitives/box';
import Spinner from '@/components/feedback/spinner';

const styles = StyleSheet.create((_, rt) => ({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: rt.insets.bottom,
    },
}));

const LoadingState: FC = () => {
    const { theme } = useUnistyles();

    return (
        <Box style={styles.loadingContainer}>
            <Spinner size={theme.space(7)} />
        </Box>
    );
};

export { LoadingState };
