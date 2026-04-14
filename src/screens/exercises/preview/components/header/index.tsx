import { ReactNode } from 'react';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import { X } from 'lucide-react-native';

import { HStack } from '@/components/primitives/hstack';
import { Pressable } from '@/components/primitives/pressable';
import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';

interface HeaderProps {
    exerciseName?: string;
    handleClose: () => void;
    actions?: ReactNode;
}

const styles = StyleSheet.create((theme) => ({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        justifyContent: 'flex-end',
        height: theme.screenHeaderHeight(),
        paddingHorizontal: theme.space(4),
    },
    wrapper: {
        alignItems: 'center',
        gap: theme.space(10),
    },
    nameContainer: {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
        minWidth: 0,
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    name: {
        fontSize: theme.fontSize.default.fontSize,
        fontWeight: theme.fontWeight.extrabold.fontWeight,
        color: theme.colors.neutral[950],
        textAlign: 'left',
    },
    closeContainer: {
        flexShrink: 0,
        height: theme.space(11),
        width: theme.space(11),
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.neutral[950],
        borderRadius: theme.radius.full,
    },
}));

const Header = ({ exerciseName, handleClose, actions }: HeaderProps) => {
    const { theme } = useUnistyles();

    return (
        <Box style={styles.container}>
            <HStack style={styles.wrapper}>
                <Box style={styles.nameContainer}>
                    <Text style={styles.name}>{exerciseName}</Text>
                </Box>
                {actions && actions}
                <Box style={styles.closeContainer}>
                    <Pressable onPress={handleClose}>
                        <X size={theme.space(7)} color={theme.colors.white} />
                    </Pressable>
                </Box>
            </HStack>
        </Box>
    );
};

export { Header };
