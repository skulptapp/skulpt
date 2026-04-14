import { FC } from 'react';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import { ListFilter } from 'lucide-react-native';

import { Pressable } from '../primitives/pressable';
import { Box, BoxProps } from '../primitives/box';

interface FilterButtonProps {
    onPress: () => void;
    active?: boolean;
    containerStyle?: BoxProps['style'];
    dotStyle?: BoxProps['style'];
    iconSize?: number;
    iconColor?: string;
}

const styles = StyleSheet.create((theme) => ({
    container: {
        height: theme.space(11),
        width: theme.space(11),
        paddingTop: theme.space(0.5),
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius.full,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dot: {
        position: 'absolute',
        top: 0,
        right: 4,
        height: theme.space(2),
        width: theme.space(2),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.lime[500],
    },
}));

const FilterButton: FC<FilterButtonProps> = ({
    onPress,
    active,
    containerStyle,
    dotStyle,
    iconSize,
    iconColor,
}) => {
    const { theme } = useUnistyles();

    return (
        <Pressable onPress={onPress}>
            <Box style={[styles.container, containerStyle]}>
                <ListFilter
                    size={iconSize ?? theme.space(5.5)}
                    color={iconColor ?? theme.colors.typography}
                />
            </Box>
            {active && <Box style={[styles.dot, dotStyle]} />}
        </Pressable>
    );
};

export { FilterButton };
