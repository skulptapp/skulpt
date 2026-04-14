import { FC, PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native-unistyles';

import { Box, BoxProps } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';

interface LabelProps extends PropsWithChildren {
    containerStyle?: BoxProps['style'];
}

const styles = StyleSheet.create((theme) => ({
    container: {
        marginBottom: theme.space(2),
    },
    label: {
        color: theme.colors.typography,
    },
}));

const Label: FC<LabelProps> = ({ containerStyle, children }) => (
    <Box style={[styles.container, containerStyle]}>
        <Text fontSize="xs" style={styles.label}>
            {children}
        </Text>
    </Box>
);

export { Label };
