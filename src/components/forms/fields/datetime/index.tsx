import { useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import {
    Control,
    FieldError,
    FieldPath,
    FieldValues,
    Merge,
    PathValue,
    useController,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { Box, BoxProps } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { useUser } from '@/hooks/use-user';

import { Error } from '../components';

interface DatetimeProps<
    T extends FieldValues = FieldValues,
    TName extends FieldPath<T> = FieldPath<T>,
> {
    control: Control<T>;
    name: TName;
    value?: PathValue<T, TName>;
    title: string;
    mode?: 'date' | 'datetime';
    minimumDate?: Date;
    maximumDate?: Date;
    description?: string;
    error?: Merge<FieldError, (FieldError | undefined)[]> | undefined;
    containerStyle?: BoxProps['style'];
}

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        paddingVertical: theme.space(3),
        paddingHorizontal: theme.space(5),
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: (error: boolean) => ({
        fontWeight: theme.fontWeight.medium.fontWeight,
        color: error ? theme.colors.red[500] : theme.colors.typography,
    }),
    selectContainer: {
        alignItems: 'center',
        gap: theme.space(2),
    },
    androidValueButton: {
        paddingVertical: theme.space(2),
        paddingHorizontal: theme.space(3),
        borderRadius: theme.radius.full,
        alignItems: 'center',
        backgroundColor:
            rt.themeName === 'dark' ? theme.colors.neutral[900] : theme.colors.neutral[100],
    },
    androidValueText: {
        color: theme.colors.typography,
    },
    errorContainer: {
        paddingHorizontal: theme.space(5),
        marginTop: -theme.space(2),
        marginBottom: theme.space(3),
    },
}));

export function Datetime<T extends FieldValues, TName extends FieldPath<T>>({
    control,
    name,
    value: defaultValue,
    title,
    mode = 'datetime',
    minimumDate,
    maximumDate,
    description,
    error,
    containerStyle,
}: DatetimeProps<T, TName>) {
    const { theme, rt } = useUnistyles();
    const { t, i18n } = useTranslation(['common']);
    const { user } = useUser();

    const {
        field: { onChange, value },
    } = useController({ name, control, defaultValue });
    const [androidPickerMode, setAndroidPickerMode] = useState<'date' | 'time' | null>(null);

    const pickerValue = useMemo(
        () => (value ?? defaultValue ?? new Date()) as Date,
        [defaultValue, value],
    );
    const isAndroid = Platform.OS === 'android';

    const formattedDate = useMemo(
        () => pickerValue.toLocaleDateString(i18n.language),
        [i18n.language, pickerValue],
    );
    const formattedTime = useMemo(
        () =>
            pickerValue.toLocaleTimeString(i18n.language, {
                hour: '2-digit',
                minute: '2-digit',
                hour12: user?.timeFormat === '12h',
            }),
        [i18n.language, pickerValue, user?.timeFormat],
    );

    const mergeDate = (base: Date, selectedDate: Date) => {
        const next = new Date(base);
        next.setFullYear(
            selectedDate.getFullYear(),
            selectedDate.getMonth(),
            selectedDate.getDate(),
        );

        return next;
    };

    const mergeTime = (base: Date, selectedTime: Date) => {
        const next = new Date(base);
        next.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);

        return next;
    };

    const handleDateChange = (event: DateTimePickerEvent, selected: Date | undefined) => {
        if (isAndroid) {
            setAndroidPickerMode(null);
        }

        if (event.type === 'set') {
            if (!selected) {
                return;
            }

            onChange(mergeDate(pickerValue, selected));
        }
    };

    const handleTimeChange = (event: DateTimePickerEvent, selected: Date | undefined) => {
        if (isAndroid) {
            setAndroidPickerMode(null);
        }

        if (event.type === 'set') {
            if (!selected) {
                return;
            }

            onChange(mergeTime(pickerValue, selected));
        }
    };

    return (
        <VStack>
            <HStack style={[styles.container, containerStyle]}>
                <VStack>
                    <Box>
                        <Text style={styles.title(!!error)}>{title}</Text>
                    </Box>
                    {description && (
                        <Box>
                            <Text>{description}</Text>
                        </Box>
                    )}
                </VStack>
                <HStack style={styles.selectContainer}>
                    {isAndroid ? (
                        <>
                            <Pressable
                                style={styles.androidValueButton}
                                onPress={() => setAndroidPickerMode('date')}
                            >
                                <Text style={styles.androidValueText}>{formattedDate}</Text>
                            </Pressable>
                            {mode === 'datetime' && (
                                <Pressable
                                    style={styles.androidValueButton}
                                    onPress={() => setAndroidPickerMode('time')}
                                >
                                    <Text style={styles.androidValueText}>{formattedTime}</Text>
                                </Pressable>
                            )}
                            {androidPickerMode && (
                                <DateTimePicker
                                    value={pickerValue}
                                    mode={androidPickerMode}
                                    locale={i18n.language}
                                    display="default"
                                    minimumDate={
                                        androidPickerMode === 'date' ? minimumDate : undefined
                                    }
                                    maximumDate={
                                        androidPickerMode === 'date' ? maximumDate : undefined
                                    }
                                    is24Hour={
                                        androidPickerMode === 'time'
                                            ? user?.timeFormat === '24h'
                                            : undefined
                                    }
                                    onChange={
                                        androidPickerMode === 'date'
                                            ? handleDateChange
                                            : handleTimeChange
                                    }
                                    themeVariant={rt.themeName}
                                    textColor={theme.colors.typography}
                                    accentColor={theme.colors.neutral[950]}
                                />
                            )}
                        </>
                    ) : (
                        <DateTimePicker
                            value={pickerValue}
                            mode="date"
                            locale={i18n.language}
                            display="default"
                            minimumDate={minimumDate}
                            maximumDate={maximumDate}
                            onChange={handleDateChange}
                            themeVariant={rt.themeName}
                            textColor={theme.colors.typography}
                            accentColor={theme.colors.neutral[950]}
                        />
                    )}
                    {!isAndroid && mode === 'datetime' && (
                        <DateTimePicker
                            value={pickerValue}
                            mode="time"
                            locale={i18n.language}
                            display="default"
                            is24Hour={user?.timeFormat === '24h'}
                            onChange={handleTimeChange}
                            themeVariant={rt.themeName}
                            textColor={theme.colors.typography}
                            accentColor={theme.colors.neutral[950]}
                        />
                    )}
                </HStack>
            </HStack>
            {error?.message && (
                <Error containerStyle={styles.errorContainer}>
                    {t(error.message, { ns: 'common' })}
                </Error>
            )}
        </VStack>
    );
}
