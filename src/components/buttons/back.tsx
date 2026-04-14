import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import { ChevronLeft } from 'lucide-react-native';

import { Pressable } from '../primitives/pressable';
import { Box } from '../primitives/box';

interface BackButtonProps {
    backgroundColor?: string;
    iconColor?: string;
    onPressHandler: () => void;
}

const styles = StyleSheet.create((theme) => ({
    container: (backgroundColor?: string) => ({
        height: theme.space(11),
        width: theme.space(11),
        backgroundColor: backgroundColor || theme.colors.foreground,
        borderRadius: theme.radius.full,
        justifyContent: 'center',
        alignItems: 'center',
    }),
    icon: {
        marginLeft: -theme.space(0.5),
    },
}));

const BackButton = ({ backgroundColor, iconColor, onPressHandler }: BackButtonProps) => {
    const { theme } = useUnistyles();

    return (
        <Pressable onPress={onPressHandler}>
            <Box style={styles.container(backgroundColor)}>
                <ChevronLeft
                    style={styles.icon}
                    size={theme.space(7)}
                    color={iconColor || theme.colors.typography}
                />
            </Box>
        </Pressable>
    );
};

export { BackButton };
