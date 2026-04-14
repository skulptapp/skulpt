import { FC } from 'react';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import { Plus } from 'lucide-react-native';

import { Pressable } from '../primitives/pressable';
import { Box, BoxProps } from '../primitives/box';

interface CreateButtonProps {
    onPressHandler: () => void;
    containerStyle?: BoxProps['style'];
    iconSize?: number;
    iconColor?: string;
}

const styles = StyleSheet.create((theme, rt) => ({
    createContainer: {
        height: theme.space(11),
        width: theme.space(11),
        backgroundColor: rt.themeName === 'dark' ? theme.colors.white : theme.colors.neutral[950],
        borderRadius: theme.radius.full,
        justifyContent: 'center',
        alignItems: 'center',
    },
}));

const CreateButton: FC<CreateButtonProps> = ({
    onPressHandler,
    containerStyle,
    iconSize,
    iconColor,
}) => {
    const { theme, rt } = useUnistyles();

    return (
        <Pressable onPress={onPressHandler}>
            <Box style={[styles.createContainer, containerStyle]}>
                <Plus
                    size={iconSize || theme.space(7)}
                    color={
                        iconColor
                            ? iconColor
                            : rt.themeName === 'dark'
                              ? theme.colors.neutral[950]
                              : theme.colors.neutral[50]
                    }
                />
            </Box>
        </Pressable>
    );
};

export { CreateButton };
