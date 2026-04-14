import { FC, PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native-unistyles';

import { Box, BoxProps } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';

interface ErrorProps extends PropsWithChildren {
    containerStyle?: BoxProps['style'];
}

const styles = StyleSheet.create((theme) => ({
    container: {
        marginTop: theme.space(1.5),
    },
    error: {
        color: theme.colors.red[500],
    },
}));

const Error: FC<ErrorProps> = ({ containerStyle, children }) => (
    <Box style={[styles.container, containerStyle]}>
        <Text fontSize="xs" style={styles.error}>
            {children}
        </Text>
    </Box>
);

export { Error };
