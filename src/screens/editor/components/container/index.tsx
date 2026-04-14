import { FC, ReactNode, useMemo } from 'react';
import { Platform } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { VStack } from '@/components/primitives/vstack';
import { ScrollView } from '@/components/primitives/scrollview';
import { Box } from '@/components/primitives/box';
import { KeyboardAvoidingView } from '@/components/primitives/keyboard';

import { Header } from '../header';
import Button from '../button';

interface ContainerProps {
    title?: string | null;
    description?: string | null;
    loading?: boolean;
    submitDisabled?: boolean;
    buttonHidden?: boolean;
    handleSubmit: () => void;
    handleClose: () => void;
    buttonLabel?: string;
    children: ReactNode;
}

const styles = StyleSheet.create((theme, rt) => ({
    keyboard: {
        flex: 1,
    },
    container: {
        flex: 1,
        backgroundColor: theme.colors.foreground,
    },
    contentWrapper: {
        flexGrow: 1,
        ...theme.screenContentPadding('editor'),
    },
    content: {
        flex: 1,
        gap: theme.space(3),
    },
}));

const Container: FC<ContainerProps> = ({
    title,
    description,
    loading,
    submitDisabled,
    buttonHidden,
    handleSubmit,
    handleClose,
    buttonLabel,
    children,
}) => {
    const { t } = useTranslation(['common']);
    const { rt } = useUnistyles();

    const button = useMemo(() => {
        if (buttonLabel) {
            return buttonLabel;
        }
        return t('save', { ns: 'common' });
    }, [buttonLabel, t]);

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0 - rt.insets.bottom}
            style={styles.keyboard}
        >
            <Box style={styles.container}>
                <Header title={title} description={description} handleClose={handleClose} />
                <ScrollView contentContainerStyle={styles.contentWrapper}>
                    <VStack style={styles.content}>{children}</VStack>
                </ScrollView>
                {!buttonHidden && (
                    <Button
                        title={button}
                        loading={loading}
                        submitDisabled={submitDisabled}
                        handleSubmit={handleSubmit}
                    />
                )}
            </Box>
        </KeyboardAvoidingView>
    );
};

export { Container };
