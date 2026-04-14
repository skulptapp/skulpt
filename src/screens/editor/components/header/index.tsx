import { FC, ReactNode } from 'react';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import { X } from 'lucide-react-native';

import { HStack } from '@/components/primitives/hstack';
import { Pressable } from '@/components/primitives/pressable';
import { VStack } from '@/components/primitives/vstack';
import { Title } from '@/components/typography/title';
import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';

interface HeaderProps {
    title?: string | null;
    description?: string | null;
    handleClose: () => void;
    closeDisabled?: boolean;
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
    titleContainer: {
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    actionsContainer: {
        gap: theme.space(2),
    },
    closeContainer: {
        height: theme.space(11),
        width: theme.space(11),
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.typography,
        borderRadius: theme.radius.full,
    },
    description: {
        color: theme.colors.neutral[600],
    },
}));

const Header: FC<HeaderProps> = ({
    title,
    description,
    handleClose,
    actions,
    closeDisabled = false,
}) => {
    const { theme, rt } = useUnistyles();

    const handleClosePress = () => {
        if (!closeDisabled) handleClose();
    };

    return (
        <VStack style={styles.container}>
            <HStack style={styles.titleContainer}>
                <Box>{title && <Title type="h2">{title}</Title>}</Box>
                <HStack style={styles.actionsContainer}>
                    {actions && actions}
                    <Box style={styles.closeContainer}>
                        <Pressable onPress={handleClosePress}>
                            <X
                                size={theme.space(7)}
                                color={
                                    rt.themeName === 'dark'
                                        ? theme.colors.neutral[950]
                                        : theme.colors.white
                                }
                            />
                        </Pressable>
                    </Box>
                </HStack>
            </HStack>
            {description && (
                <Box>
                    <Text fontSize="lg" fontWeight="medium" style={styles.description}>
                        {description}
                    </Text>
                </Box>
            )}
        </VStack>
    );
};

export { Header };
