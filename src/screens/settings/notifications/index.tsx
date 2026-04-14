import { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { ScrollView } from '@/components/primitives/scrollview';
import { EditUserFormData, editUserSchema, useUser } from '@/hooks/use-user';
import { Box } from '@/components/primitives/box';
import { VStack } from '@/components/primitives/vstack';
import { Title } from '@/components/typography/title';
import { Text } from '@/components/primitives/text';
import { Separator } from '@/components/layout/separator';
import { Switch } from '@/components/forms/fields/switch';
import { usePermissionsStore } from '@/stores/permissions';
import { RESULTS } from 'react-native-permissions';
import { useNotifications } from '@/hooks/use-notifications';
import { reportError } from '@/services/error-reporting';
import { markFormValuesSyncing, submitAutoSaveForm } from '../shared';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.space(4),
    },
    content: {
        ...theme.screenContentPadding('child'),
        gap: theme.space(5),
    },
    headerContainer: {
        padding: theme.space(5),
        backgroundColor: theme.colors.background,
        borderRadius: theme.radius['4xl'],
        gap: theme.space(5),
    },
    headerTitleContainer: {
        gap: theme.space(2),
    },
    description: {
        fontSize: theme.fontSize.lg.fontSize,
        color: theme.colors.typography,
        opacity: 0.6,
    },
    iconContainer: {
        height: theme.space(15),
        width: theme.space(15),
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: rt.themeName === 'dark' ? theme.colors.white : theme.colors.neutral[950],
        borderRadius: theme.radius['2xl'],
        marginBottom: theme.space(2),
    },
    pushes: {
        paddingVertical: 0,
        paddingHorizontal: 0,
    },
}));

const NotificationsScreen = () => {
    const { user, updateUser } = useUser();
    const { t } = useTranslation(['screens']);
    const { theme, rt } = useUnistyles();
    const { requestPermissions } = useNotifications();

    const notifications = usePermissionsStore((state) => state.permissions.notifications);

    const value = useMemo(() => {
        if (notifications !== RESULTS.GRANTED) return false;
        return user?.pushes || false;
    }, [user, notifications]);

    const {
        control,
        handleSubmit,
        watch,
        reset,
        formState: { errors },
    } = useForm<EditUserFormData>({
        resolver: zodResolver(editUserSchema),
        defaultValues: {
            pushes: value,
        },
    });

    const watchedPushes = watch('pushes');
    const isUserLoaded = user !== undefined;
    const isSyncingFormRef = useRef(false);
    const isAutoSavingRef = useRef(false);

    const onSubmit = useCallback(
        async (data: EditUserFormData) => {
            try {
                await updateUser(data);
            } catch (error) {
                reportError(error, 'Failed to update user notifications preferences:');
            }
        },
        [updateUser],
    );

    const submitCurrentValues = useCallback(() => {
        submitAutoSaveForm(
            isSyncingFormRef,
            isAutoSavingRef,
            handleSubmit,
            onSubmit,
            'Failed to submit notification settings form:',
        );
    }, [handleSubmit, onSubmit]);

    useEffect(() => {
        if (!isUserLoaded) return;

        markFormValuesSyncing(isSyncingFormRef, () => {
            reset({
                pushes: value,
            });
        });
    }, [isUserLoaded, value, reset]);

    useEffect(() => {
        if (isSyncingFormRef.current) return;

        if (isUserLoaded && typeof watchedPushes === 'boolean' && watchedPushes !== value) {
            submitCurrentValues();
            if (watchedPushes && notifications !== RESULTS.GRANTED) {
                requestPermissions();
            }
        }
    }, [
        isUserLoaded,
        watchedPushes,
        value,
        submitCurrentValues,
        notifications,
        requestPermissions,
    ]);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <VStack style={styles.headerContainer}>
                <VStack style={styles.headerTitleContainer}>
                    <Box style={styles.iconContainer}>
                        <Bell
                            size={theme.space(8)}
                            strokeWidth={theme.space(0.375)}
                            color={
                                rt.themeName === 'dark'
                                    ? theme.colors.neutral[950]
                                    : theme.colors.white
                            }
                        />
                    </Box>
                    <Box>
                        <Title type="h3">{t('notifications.title', { ns: 'screens' })}</Title>
                    </Box>
                    <Box>
                        <Text style={styles.description}>
                            {t('notifications.description', { ns: 'screens' })}
                        </Text>
                    </Box>
                </VStack>
                <Separator />
                <VStack>
                    <Box>
                        <Switch
                            name="pushes"
                            control={control}
                            title={t('notifications.title', { ns: 'screens' })}
                            error={errors.pushes}
                            containerStyle={styles.pushes}
                        />
                    </Box>
                </VStack>
            </VStack>
        </ScrollView>
    );
};

export default NotificationsScreen;
