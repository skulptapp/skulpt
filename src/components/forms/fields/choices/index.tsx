import React, { FC, isValidElement, ReactNode, useMemo, useState } from 'react';
import {
    FieldError,
    FieldPath,
    FieldValues,
    Merge,
    PathValue,
    useController,
} from 'react-hook-form';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Undo2 } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Pressable } from '@/components/primitives/pressable';
import { HStack } from '@/components/primitives/hstack';
import { Box, BoxProps } from '@/components/primitives/box';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Button } from '@/components/buttons/base';
import { stableOutlineWidth } from '@/helpers/styles';

import { Label, Error } from '../components';
import { ControlledInputType } from '../types';

export type ChoicesType = 'radio' | 'checkbox';

export type ValueType =
    | string
    | number
    | boolean
    | null
    | (string | number | boolean | (string | number)[])[];

export interface ChoiceType {
    value: string | number | boolean | null | (string | number)[];
    title: string;
    description?: ReactNode;
    children?: ChoiceType[];
}

export interface ChoiceGroupType {
    title?: string;
    description?: ReactNode;
    choices: ChoiceType[];
}

export interface ChoicesFieldType<
    T extends FieldValues = FieldValues,
    TName extends FieldPath<T> = FieldPath<T>,
> extends ControlledInputType<T, TName> {
    label?: string;
    type?: ChoicesType;
    value?: PathValue<T, TName>;
    choices?: ChoiceType[];
    groups?: ChoiceGroupType[];
    error?: Merge<FieldError, (FieldError | undefined)[]> | undefined;
    style?: 'compact';
    expandable?: boolean;
    maxVisibleChoices?: number;
    selectPosition?: 'left' | 'right';
    containerStyle?: BoxProps['style'];
    uncheckedIndicatorBackgroundColor?: string;
    onChange?: (value: ValueType) => void;
}

const styles = StyleSheet.create((theme) => ({
    choicesContainer: {
        gap: theme.space(0.5),
        backgroundColor: theme.colors.background,
        borderRadius: theme.radius['4xl'],
        padding: theme.space(5),
    },
    choicesWrapper: {
        gap: theme.space(3),
    },
    labelContainer: {
        marginBottom: theme.space(2),
    },
    errorContainer: (expanded: null | boolean) => ({
        marginTop: expanded === null ? theme.space(2) : expanded ? theme.space(2) : -theme.space(2),
    }),
    choiceContainer: (selectPosition?: 'left' | 'right') => ({
        flexDirection: selectPosition === 'left' ? 'row' : 'row-reverse',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: theme.space(3),
    }),
    choiceSeparator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
    },
    choicePressable: {
        width: '100%',
        alignSelf: 'stretch',
    },
    iconContainer: (showTopBorder: boolean, showBottomBorder: boolean) => ({
        paddingTop: showTopBorder ? theme.space(3) : 0,
        paddingBottom: showBottomBorder ? theme.space(3) : 0,
    }),
    iconWrapper: (
        checked: boolean,
        error: boolean,
        uncheckedIndicatorBackgroundColor?: string,
    ) => ({
        borderWidth: stableOutlineWidth,
        borderColor: error
            ? theme.colors.red[500]
            : checked
              ? theme.colors.typography
              : theme.colors.border,
        backgroundColor: checked
            ? theme.colors.typography
            : (uncheckedIndicatorBackgroundColor ?? theme.colors.background),
        borderRadius: theme.radius.full,
        height: theme.space(6),
        width: theme.space(6),
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: theme.space(0.25),
    }),
    choiceTitleContainer: (showTopBorder: boolean, showBottomBorder: boolean) => ({
        flex: 1,
        gap: theme.space(2),
        paddingTop: showTopBorder ? theme.space(3) : 0,
        paddingBottom: showBottomBorder ? theme.space(3) : 0,
    }),
    choiceTitle: (checked: boolean, error: boolean) => ({
        color: error
            ? theme.colors.red[500]
            : checked
              ? theme.colors.typography
              : theme.colors.typography,
    }),
    selectedContainer: {
        flex: 1,
        borderRadius: theme.radius['4xl'],
    },
    selectedWrapper: {
        flex: 1,
        gap: theme.space(4),
        paddingTop: theme.space(0.25),
        paddingLeft: theme.space(3),
    },
    selectedTitle: {
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    expandableContent: {
        overflow: 'hidden',
    },
    expandButtonContainer: (isExpanded: boolean) => ({
        marginTop: isExpanded ? 0 : -theme.space(3),
        justifyContent: 'center',
        alignItems: 'center',
    }),
    expandButtonDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
        width: '100%',
    },
    expandButton: {
        marginTop: theme.space(4),
    },
    groupContainer: {
        gap: theme.space(4),
    },
    groupHeader: {
        gap: theme.space(2),
        paddingBottom: theme.space(2),
    },
    groupHeaderDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
    },
    groupTitle: {
        fontWeight: theme.fontWeight.extrabold.fontWeight,
        color: theme.colors.typography,
    },
    groupDescription: {
        color: theme.colors.typography,
        opacity: 0.6,
    },
    groupChoicesContainer: (hasTitle: boolean) => ({
        gap: theme.space(3),
        paddingLeft: hasTitle ? theme.space(5) : 0,
        width: '100%',
        alignSelf: 'stretch',
    }),
    nestedChoicesContainer: (depth: number) => ({
        gap: theme.space(3),
        paddingLeft: depth > 0 ? theme.space(5) : 0,
        width: '100%',
        alignSelf: 'stretch',
    }),
}));

const flattenChoiceTree = (choiceList: ChoiceType[]): ChoiceType[] => {
    return choiceList.flatMap((choice) => {
        return [choice, ...(choice.children ? flattenChoiceTree(choice.children) : [])];
    });
};

const Choice: FC<{
    choice: ChoiceType;
    showTopBorder: boolean;
    showBottomBorder: boolean;
    onPress: (choice: ChoiceType) => void;
    checked: boolean;
    error?: boolean;
    selectPosition?: 'left' | 'right';
    uncheckedIndicatorBackgroundColor?: string;
}> = ({
    choice,
    showTopBorder,
    showBottomBorder,
    onPress,
    checked,
    error,
    selectPosition = 'left',
    uncheckedIndicatorBackgroundColor,
}) => {
    return (
        <Pressable style={styles.choicePressable} onPress={() => onPress(choice)}>
            <VStack>
                {showTopBorder && <Box style={styles.choiceSeparator} />}
                <HStack style={styles.choiceContainer(selectPosition)}>
                    <Box style={styles.iconContainer(showTopBorder, showBottomBorder)}>
                        <Box
                            style={styles.iconWrapper(
                                checked,
                                !!error,
                                uncheckedIndicatorBackgroundColor,
                            )}
                        />
                    </Box>
                    <VStack style={styles.choiceTitleContainer(showTopBorder, showBottomBorder)}>
                        <Box>
                            <Text fontWeight="medium" style={styles.choiceTitle(checked, !!error)}>
                                {choice.title}
                            </Text>
                        </Box>
                    </VStack>
                </HStack>
                {showBottomBorder && <Box style={styles.choiceSeparator} />}
            </VStack>
        </Pressable>
    );
};

type RenderChoiceTreeFn = (choices: ChoiceType[], depth: number) => ReactNode;

const GroupChoice: FC<{
    choice: ChoiceType;
    index: number;
    realIndex: number;
    isLastOnLevel: boolean;
    hasChildrenOnLevel: boolean;
    previousChoiceHasChildren: boolean;
    depth: number;
    onChoicePress: (choice: ChoiceType) => void;
    getCheckedValue: (choice: ChoiceType) => boolean;
    error?: boolean;
    selectPosition?: 'left' | 'right';
    uncheckedIndicatorBackgroundColor?: string;
    renderChoiceTree: RenderChoiceTreeFn;
}> = ({
    choice,
    index,
    realIndex,
    isLastOnLevel,
    hasChildrenOnLevel,
    previousChoiceHasChildren,
    depth,
    onChoicePress,
    getCheckedValue,
    error,
    selectPosition,
    uncheckedIndicatorBackgroundColor,
    renderChoiceTree,
}) => {
    const hasChildren = (choice.children?.length ?? 0) > 0;
    const showTopBorder = hasChildrenOnLevel
        ? (depth === 0 && index === 0 && realIndex > 0) || (index > 0 && previousChoiceHasChildren)
        : depth === 0
          ? realIndex > 0
          : index > 0;
    const showBottomBorder =
        hasChildrenOnLevel &&
        !(depth === 0 && !hasChildren) &&
        !(depth === 1 && isLastOnLevel && !hasChildren);

    return (
        <React.Fragment>
            <Choice
                showTopBorder={showTopBorder}
                showBottomBorder={showBottomBorder}
                choice={choice}
                onPress={onChoicePress}
                checked={getCheckedValue(choice)}
                error={error}
                selectPosition={selectPosition}
                uncheckedIndicatorBackgroundColor={uncheckedIndicatorBackgroundColor}
            />
            {choice.children && choice.children.length > 0 && (
                <VStack style={styles.nestedChoicesContainer(depth + 1)}>
                    {renderChoiceTree(choice.children, depth + 1)}
                </VStack>
            )}
        </React.Fragment>
    );
};

const ChoiceGroup: FC<{
    group: ChoiceGroupType;
    groupIndex: number;
    groupsLength: number;
    onChoicePress: (choice: ChoiceType) => void;
    getCheckedValue: (choice: ChoiceType) => boolean;
    error?: boolean;
    selectPosition?: 'left' | 'right';
    uncheckedIndicatorBackgroundColor?: string;
}> = ({
    group,
    groupIndex,
    groupsLength,
    onChoicePress,
    getCheckedValue,
    error,
    selectPosition = 'left',
    uncheckedIndicatorBackgroundColor,
}) => {
    const renderChoiceTree: RenderChoiceTreeFn = (choices, depth = 0) => {
        const hasChildrenOnLevel = choices.some(
            (item) => !!item.children && item.children.length > 0,
        );

        return choices.map((choice, index) => {
            const realIndex = depth === 0 ? (group.title ? index : groupIndex + index) : index;

            return (
                <GroupChoice
                    key={`${String(choice.value)}-${depth}-${index}`}
                    choice={choice}
                    index={index}
                    realIndex={realIndex}
                    isLastOnLevel={index === choices.length - 1}
                    hasChildrenOnLevel={hasChildrenOnLevel}
                    previousChoiceHasChildren={
                        index > 0 && (choices[index - 1]?.children?.length ?? 0) > 0
                    }
                    depth={depth}
                    onChoicePress={onChoicePress}
                    getCheckedValue={getCheckedValue}
                    error={error}
                    selectPosition={selectPosition}
                    uncheckedIndicatorBackgroundColor={uncheckedIndicatorBackgroundColor}
                    renderChoiceTree={renderChoiceTree}
                />
            );
        });
    };

    if (!group.title) {
        return (
            <VStack style={styles.groupChoicesContainer(!!group.title)}>
                {renderChoiceTree(group.choices, 0)}
            </VStack>
        );
    }

    return (
        <VStack style={styles.groupContainer}>
            <VStack style={styles.groupHeader}>
                <Text style={styles.groupTitle}>{group.title}</Text>
                {group.description && (
                    <Text style={styles.groupDescription}>{group.description}</Text>
                )}
                <Box style={styles.groupHeaderDivider} />
            </VStack>
            <VStack style={styles.groupChoicesContainer(!!group.title)}>
                {renderChoiceTree(group.choices, 0)}
            </VStack>
        </VStack>
    );
};

const ExpandableChoices: FC<{
    choices: ChoiceType[];
    visibleChoices: ChoiceType[];
    onChoicePress: (choice: ChoiceType) => void;
    getCheckedValue: (choice: ChoiceType) => boolean;
    error?: Merge<FieldError, (FieldError | undefined)[]> | undefined;
    selectPosition?: 'left' | 'right';
    uncheckedIndicatorBackgroundColor?: string;
}> = ({
    choices,
    visibleChoices,
    onChoicePress,
    getCheckedValue,
    error,
    selectPosition = 'left',
    uncheckedIndicatorBackgroundColor,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [contentHeight, setContentHeight] = useState(0);
    const animatedHeight = useSharedValue(0);
    const { t } = useTranslation(['common']);

    const animatedStyle = useAnimatedStyle(() => ({
        height: animatedHeight.value,
    }));

    const hasMoreChoices = choices.length > visibleChoices.length;
    const hiddenChoicesCount = choices.length - visibleChoices.length;
    const estimatedItemHeight = 60;
    const estimatedContentHeight = hiddenChoicesCount * estimatedItemHeight;

    return (
        <VStack style={styles.choicesWrapper}>
            {visibleChoices.map((choice, index) => (
                <Choice
                    key={index}
                    showTopBorder={index > 0}
                    showBottomBorder={
                        !hasMoreChoices &&
                        index === visibleChoices.length - 1 &&
                        (choice.children?.length ?? 0) > 0
                    }
                    choice={choice}
                    onPress={onChoicePress}
                    checked={getCheckedValue(choice)}
                    error={!!error}
                    selectPosition={selectPosition}
                    uncheckedIndicatorBackgroundColor={uncheckedIndicatorBackgroundColor}
                />
            ))}

            {hasMoreChoices && (
                <VStack
                    style={[
                        styles.choicesWrapper,
                        { position: 'absolute', opacity: 0, zIndex: -1 },
                    ]}
                    onLayout={(e) => {
                        setContentHeight(e.nativeEvent.layout.height);
                    }}
                >
                    {choices.slice(visibleChoices.length).map((choice, index) => {
                        const absoluteIndex = visibleChoices.length + index;
                        return (
                            <Choice
                                key={visibleChoices.length + index}
                                showTopBorder={absoluteIndex > 0}
                                showBottomBorder={
                                    absoluteIndex === choices.length - 1 &&
                                    (choice.children?.length ?? 0) > 0
                                }
                                choice={choice}
                                onPress={onChoicePress}
                                checked={getCheckedValue(choice)}
                                error={!!error}
                                selectPosition={selectPosition}
                                uncheckedIndicatorBackgroundColor={
                                    uncheckedIndicatorBackgroundColor
                                }
                            />
                        );
                    })}
                </VStack>
            )}

            {hasMoreChoices && (
                <Animated.View style={[styles.expandableContent, animatedStyle]}>
                    <VStack style={styles.choicesWrapper}>
                        {choices.slice(visibleChoices.length).map((choice, index) => {
                            const absoluteIndex = visibleChoices.length + index;
                            return (
                                <Choice
                                    key={visibleChoices.length + index}
                                    showTopBorder={absoluteIndex > 0}
                                    showBottomBorder={
                                        absoluteIndex === choices.length - 1 &&
                                        (choice.children?.length ?? 0) > 0
                                    }
                                    choice={choice}
                                    onPress={onChoicePress}
                                    checked={getCheckedValue(choice)}
                                    error={!!error}
                                    selectPosition={selectPosition}
                                    uncheckedIndicatorBackgroundColor={
                                        uncheckedIndicatorBackgroundColor
                                    }
                                />
                            );
                        })}
                    </VStack>
                </Animated.View>
            )}

            {error?.message && (
                <Error containerStyle={styles.errorContainer(isExpanded)}>
                    {t(error.message, { ns: 'common' })}
                </Error>
            )}

            {hasMoreChoices && (
                <Box style={styles.expandButtonContainer(isExpanded)}>
                    <Box style={styles.expandButtonDivider} />
                    <Button
                        type="link"
                        size="sm"
                        title={
                            isExpanded
                                ? t('hide', { ns: 'common' })
                                : t('showMoreN', {
                                      ns: 'common',
                                      number: choices.length - visibleChoices.length,
                                  })
                        }
                        containerStyle={styles.expandButton}
                        onPress={() => {
                            const newExpanded = !isExpanded;

                            setIsExpanded(newExpanded);
                            if (newExpanded) {
                                const targetHeight =
                                    contentHeight > 0 ? contentHeight : estimatedContentHeight;
                                animatedHeight.value = withTiming(targetHeight, {
                                    duration: 300,
                                });
                            } else {
                                animatedHeight.value = withTiming(0, {
                                    duration: 300,
                                });
                            }
                        }}
                    />
                </Box>
            )}
        </VStack>
    );
};

function Choices<T extends FieldValues, TName extends FieldPath<T>>({
    control,
    name,
    label,
    type = 'radio',
    choices,
    groups,
    value: defaultValue,
    error,
    style,
    expandable = false,
    maxVisibleChoices = 5,
    selectPosition = 'left',
    containerStyle,
    uncheckedIndicatorBackgroundColor,
    onChange: customOnChange,
}: ChoicesFieldType<T, TName>) {
    const { theme } = useUnistyles();
    const { t } = useTranslation(['common']);

    const {
        field: { onChange: formOnChange, value: fieldValue },
    } = useController({ name, control, defaultValue });

    const value = fieldValue as ValueType;

    const handleChange = customOnChange || formOnChange;

    const allChoices = useMemo(() => {
        if (groups) {
            return groups.flatMap((group) => flattenChoiceTree(group.choices));
        }
        return flattenChoiceTree(choices || []);
    }, [choices, groups]);

    const selectedChoices = useMemo(() => {
        if (!value) return [];

        if (Array.isArray(value)) {
            const selected = allChoices.filter((choice) => {
                if (Array.isArray(choice.value)) {
                    return JSON.stringify(choice.value) === JSON.stringify(value);
                } else {
                    return value.includes(
                        choice.value as string | number | boolean | (string | number)[],
                    );
                }
            });
            return selected;
        } else {
            const selectedChoice = allChoices.find((choice) => {
                if (Array.isArray(choice.value)) {
                    const matches = JSON.stringify(choice.value) === JSON.stringify(value);
                    return matches;
                } else {
                    const matches = choice.value === value;
                    return matches;
                }
            });
            return selectedChoice ? [selectedChoice] : [];
        }
    }, [value, allChoices]);

    const hideChoices = useMemo(() => {
        if (type === 'checkbox') return false;
        if (style === 'compact' && selectedChoices.length > 0) return true;
        return false;
    }, [selectedChoices, style, type]);

    const handleReset = () => {
        handleChange(null);
    };

    const handleOnChange = (choice: ChoiceType) => {
        if (type === 'radio') {
            if (Array.isArray(choice.value)) {
                if (
                    Array.isArray(value) &&
                    JSON.stringify(value) === JSON.stringify(choice.value)
                ) {
                    handleChange(null);
                } else {
                    handleChange(choice.value);
                }
            } else {
                if (value === choice.value) {
                    handleChange(null);
                } else {
                    handleChange(choice.value);
                }
            }
        }

        if (type === 'checkbox') {
            let s: (string | number | boolean | (string | number)[])[];

            if (value) {
                if (Array.isArray(value)) {
                    s = [...value];
                } else {
                    s = [value];
                }
            } else {
                s = [];
            }

            if (choice.value !== null) {
                if (Array.isArray(choice.value)) {
                    const choiceValueArray = choice.value as (string | number)[];
                    const hasArray = s.some(
                        (i) =>
                            Array.isArray(i) &&
                            JSON.stringify(i) === JSON.stringify(choiceValueArray),
                    );
                    if (hasArray) {
                        s = s.filter(
                            (i) =>
                                !(
                                    Array.isArray(i) &&
                                    JSON.stringify(i) === JSON.stringify(choiceValueArray)
                                ),
                        );
                    } else {
                        s = [...s, choiceValueArray];
                    }
                } else {
                    const singleValue = choice.value as string | number | boolean;
                    if (s.some((i) => i === singleValue)) {
                        s = s.filter((i) => i !== singleValue);
                    } else {
                        s = [...s, singleValue];
                    }
                }
            }

            if (s.length > 0) {
                handleChange(s);
            } else {
                handleChange(null);
            }
        }
    };

    const getCheckedValue = (choice: ChoiceType) => {
        if (type === 'radio') {
            if (Array.isArray(choice.value)) {
                return (
                    Array.isArray(value) && JSON.stringify(value) === JSON.stringify(choice.value)
                );
            } else {
                return value === choice.value;
            }
        }

        if (Array.isArray(value)) {
            if (Array.isArray(choice.value)) {
                return value.some(
                    (item) =>
                        Array.isArray(item) &&
                        JSON.stringify(item) === JSON.stringify(choice.value),
                );
            } else {
                return value.includes(
                    choice.value as string | number | boolean | (string | number)[],
                );
            }
        }
        if (Array.isArray(choice.value)) {
            return choice.value.some((item) => value === item);
        }
        return value === choice.value;
    };

    const visibleChoices = expandable ? allChoices.slice(0, maxVisibleChoices) : allChoices;

    return (
        <VStack style={[styles.choicesContainer, containerStyle]}>
            {label && <Label containerStyle={styles.labelContainer}>{label}</Label>}
            {!hideChoices &&
                (groups ? (
                    <VStack style={styles.choicesWrapper}>
                        {groups.map((group, groupIndex) => (
                            <ChoiceGroup
                                key={groupIndex}
                                group={group}
                                groupIndex={groupIndex}
                                groupsLength={groups.length}
                                onChoicePress={handleOnChange}
                                getCheckedValue={getCheckedValue}
                                error={!!error}
                                selectPosition={selectPosition}
                                uncheckedIndicatorBackgroundColor={
                                    uncheckedIndicatorBackgroundColor
                                }
                            />
                        ))}
                    </VStack>
                ) : expandable ? (
                    <ExpandableChoices
                        choices={allChoices}
                        visibleChoices={visibleChoices}
                        onChoicePress={handleOnChange}
                        getCheckedValue={getCheckedValue}
                        error={error}
                        selectPosition={selectPosition}
                        uncheckedIndicatorBackgroundColor={uncheckedIndicatorBackgroundColor}
                    />
                ) : (
                    <VStack style={styles.choicesWrapper}>
                        {allChoices.map((choice, index) => (
                            <Choice
                                key={index}
                                showTopBorder={index > 0}
                                showBottomBorder={
                                    index === allChoices.length - 1 &&
                                    (choice.children?.length ?? 0) > 0
                                }
                                choice={choice}
                                onPress={handleOnChange}
                                checked={getCheckedValue(choice)}
                                error={!!error}
                                selectPosition={selectPosition}
                                uncheckedIndicatorBackgroundColor={
                                    uncheckedIndicatorBackgroundColor
                                }
                            />
                        ))}
                    </VStack>
                ))}
            {style === 'compact' && selectedChoices.length > 0 && (
                <HStack style={styles.selectedContainer}>
                    <Pressable onPress={handleReset}>
                        <Box style={styles.iconWrapper(true, false)} />
                    </Pressable>
                    <VStack style={styles.selectedWrapper}>
                        <Box>
                            <Text style={styles.selectedTitle}>{selectedChoices[0].title}</Text>
                        </Box>
                        {isValidElement(selectedChoices[0].description) ? (
                            selectedChoices[0].description
                        ) : (
                            <Box>
                                <Text>{selectedChoices[0].description}</Text>
                            </Box>
                        )}
                        <Box>
                            <Button
                                type="link"
                                prefix={
                                    <Undo2
                                        size={theme.space(4.5)}
                                        color={theme.colors.typography}
                                    />
                                }
                                title={t('change', { ns: 'common' })}
                                onPress={handleReset}
                            />
                        </Box>
                    </VStack>
                </HStack>
            )}
            {error?.message && !expandable && (
                <Error containerStyle={styles.errorContainer(null)}>
                    {t(error.message, { ns: 'common' })}
                </Error>
            )}
        </VStack>
    );
}

export { Choices };
