import { FC, PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native-unistyles';

import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';

const styles = StyleSheet.create((theme) => ({
    container: {
        marginTop: theme.space(1.5),
    },
    help: {
        color: theme.colors.neutral[600],
    },
}));

const Help: FC<PropsWithChildren> = ({ children }) => (
    <Box style={[styles.container]}>
        <Text fontSize="xs" style={styles.help}>
            {children}
        </Text>
    </Box>
);

export { Help };
