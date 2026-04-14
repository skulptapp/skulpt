import { useEffect, useMemo, useRef, useState } from 'react';
import {
    BottomSheetFooter,
    BottomSheetFooterProps,
    BottomSheetModal,
    BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { FieldPath, FieldValues, useController } from 'react-hook-form';
import { compact } from 'lodash';
import { ChevronsUpDown } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { HStack } from '@/components/primitives/hstack';
import { Box, BoxProps } from '@/components/primitives/box';
import { Pressable } from '@/components/primitives/pressable';
import { Text } from '@/components/primitives/text';
import { Backdrop } from '@/components/overlays/backdrop';
import { Handle } from '@/components/overlays/handle';
import { VStack } from '@/components/primitives/vstack';

import { ChoiceType, ChoicesFieldType, Choices as ChoicesField, ValueType } from '../../choices';
import { Error } from '../../components';

interface SheetChoicesFieldType<
    T extends FieldValues = FieldValues,
    TName extends FieldPath<T> = FieldPath<T>,
> extends ChoicesFieldType<T, TName> {
    title: string;
    description?: string;
    showActions?: boolean;
    containerStyle?: BoxProps['style'];
}

const flattenChoiceTree = (choices: ChoiceType[]): ChoiceType[] => {
    return choices.flatMap((choice) => [
        choice,
        ...(choice.children ? flattenChoiceTree(choice.children) : []),
    ]);
};

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
    sheetBackground: {
        backgroundColor: theme.colors.foreground,
        borderTopRightRadius: theme.radius['4xl'],
        borderTopLeftRadius: theme.radius['4xl'],
    },
    sheetHandle: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        borderTopRightRadius: theme.radius['4xl'],
        borderTopLeftRadius: theme.radius['4xl'],
    },
    sheetHandleIndicator: {
        backgroundColor: theme.colors.typography,
        opacity: 0.2,
    },
    sheetFooterContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: theme.space(5),
        paddingBottom: rt.insets.bottom,
    },
    sheetFooterActionContainer: {
        height: theme.space(14),
    },
    sheetFooterContainerWrapper: {
        height: '100%',
        justifyContent: 'center',
    },
    sheetActionTitle: {
        color: theme.colors.typography,
    },
    scrollContainer: {
        borderTopRightRadius: theme.radius['4xl'],
        borderTopLeftRadius: theme.radius['4xl'],
    },
    contentContainer: (showActions: boolean) => ({
        paddingHorizontal: theme.space(4),
        paddingTop: theme.screenContentPadding('sheet').paddingTop,
        paddingBottom: showActions
            ? theme.space(16) + rt.insets.bottom
            : theme.space(6) + rt.insets.bottom,
    }),
    errorContainer: {
        paddingHorizontal: theme.space(5),
        marginTop: -theme.space(2),
        marginBottom: theme.space(3),
    },
    selectContainer: {
        alignItems: 'center',
        gap: theme.space(2),
        flexShrink: 1,
    },
    selectPressable: {
        flexShrink: 1,
        maxWidth: '60%',
    },
    selectTitle: {
        flexShrink: 1,
        textAlign: 'right',
    },
    selectIcon: {
        paddingTop: theme.space(0.25),
    },
}));

function SheetChoices<T extends FieldValues, TName extends FieldPath<T>>({
    title,
    description,
    showActions = true,
    name,
    control,
    value: defaultValue,
    containerStyle,
    choices,
    groups,
    type = 'radio',
    error,
    ...rest
}: SheetChoicesFieldType<T, TName>) {
    const [visible, setVisible] = useState(false);
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);
    const { theme, rt } = useUnistyles();
    const { t } = useTranslation(['common']);

    const {
        field: { onChange, value: fieldValue },
    } = useController({ name, control, defaultValue });

    const value = fieldValue as ValueType;

    const allChoices = useMemo(() => {
        if (groups) {
            return groups.flatMap((group) => flattenChoiceTree(group.choices));
        }
        return flattenChoiceTree(choices || []);
    }, [choices, groups]);

    const selected = useMemo((): ChoiceType[] | null => {
        if (!value) return null;

        if (Array.isArray(value)) {
            return compact(value.map((v) => allChoices.find((choice) => choice.value === v)));
        } else {
            const selectedChoice = allChoices.find((choice) => choice.value === value);
            return selectedChoice ? [selectedChoice] : [];
        }
    }, [value, allChoices]);

    const selectedTitle = useMemo(() => {
        if (!selected) return null;
        if (selected.length === 1) return selected[0]?.title;
        return `${selected[0]?.title}, +${selected.length - 1}`;
    }, [selected]);

    useEffect(() => {
        if (visible) {
            bottomSheetModalRef.current?.present();
        } else {
            bottomSheetModalRef.current?.close();
        }
    }, [visible]);

    const handleOnChange = (value: ValueType) => {
        onChange(value);
        if (value !== null && type === 'radio') setVisible(!visible);
    };

    const handleReset = () => onChange(null);

    const handleSheet = () => setVisible(!visible);

    const handleSheetChanges = (index: number) => {
        if (index === -1 && visible) {
            handleSheet();
        }
    };

    const Footer = (props: BottomSheetFooterProps) => (
        <BottomSheetFooter {...props}>
            <HStack style={styles.sheetFooterContainer}>
                <Box style={styles.sheetFooterActionContainer}>
                    <Pressable style={styles.sheetFooterContainerWrapper} onPress={handleReset}>
                        <Text style={styles.sheetActionTitle}>{t('reset', { ns: 'common' })}</Text>
                    </Pressable>
                </Box>
                <Box style={styles.sheetFooterActionContainer}>
                    <Pressable style={styles.sheetFooterContainerWrapper} onPress={handleSheet}>
                        <Text fontWeight="bold" style={styles.sheetActionTitle}>
                            {t('done', { ns: 'common' })}
                        </Text>
                    </Pressable>
                </Box>
            </HStack>
        </BottomSheetFooter>
    );

    return (
        <>
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
                    <Pressable style={styles.selectPressable} onPress={handleSheet}>
                        <HStack style={styles.selectContainer}>
                            <Text style={[styles.title(!!error), styles.selectTitle]}>
                                {selectedTitle ? selectedTitle : t('select', { ns: 'common' })}
                            </Text>
                            <Box style={styles.selectIcon}>
                                <ChevronsUpDown
                                    size={theme.space(4)}
                                    color={
                                        !!error ? theme.colors.red[500] : theme.colors.typography
                                    }
                                />
                            </Box>
                        </HStack>
                    </Pressable>
                </HStack>
                {error?.message && (
                    <Error containerStyle={styles.errorContainer}>
                        {t(error.message, { ns: 'common' })}
                    </Error>
                )}
            </VStack>
            <BottomSheetModal
                ref={bottomSheetModalRef}
                backdropComponent={Backdrop}
                handleComponent={(props) => (
                    <Handle title={title} handleClose={handleSheet} {...props} />
                )}
                footerComponent={showActions ? Footer : undefined}
                onChange={handleSheetChanges}
                stackBehavior="push"
                backgroundStyle={styles.sheetBackground}
                topInset={rt.insets.top + theme.space(5)}
                handleStyle={styles.sheetHandle}
                handleIndicatorStyle={styles.sheetHandleIndicator}
            >
                <BottomSheetScrollView
                    style={styles.scrollContainer}
                    contentContainerStyle={styles.contentContainer(showActions)}
                >
                    <ChoicesField
                        name={name}
                        control={control}
                        value={defaultValue}
                        choices={choices}
                        groups={groups}
                        type={type}
                        onChange={handleOnChange}
                        {...rest}
                    />
                </BottomSheetScrollView>
            </BottomSheetModal>
        </>
    );
}

export { SheetChoices };
