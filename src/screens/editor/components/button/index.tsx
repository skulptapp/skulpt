import { FC, ReactNode } from 'react';
import { StyleSheet } from 'react-native-unistyles';

import { Box } from '@/components/primitives/box';
import { Button as BaseButton } from '@/components/buttons/base';

interface ButtonProps {
    handleSubmit: () => void;
    loading?: boolean;
    submitDisabled?: boolean;
    title: string;
    prefix?: ReactNode;
    suffix?: ReactNode;
}

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        position: 'absolute',
        bottom: 0,
        paddingHorizontal: theme.space(4),
        paddingBottom: theme.space(5) + rt.insets.bottom,
        width: '100%',
    },
}));

const Button: FC<ButtonProps> = ({
    title,
    loading,
    submitDisabled,
    handleSubmit,
    prefix,
    suffix,
}) => {
    return (
        <Box style={styles.container}>
            <BaseButton
                prefix={prefix}
                onPress={handleSubmit}
                loading={loading}
                disabled={submitDisabled}
                title={title}
                suffix={suffix}
            />
        </Box>
    );
};

export default Button;
