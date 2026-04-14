import { useCallback, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { VStack } from '@/components/primitives/vstack';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { useWorkouts } from '@/hooks/use-workouts';
import { useUser } from '@/hooks/use-user';

const WEEKDAY_ORDER_SUNDAY_FIRST = [0, 1, 2, 3, 4, 5, 6] as const;
const WEEKDAY_ORDER_MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0] as const;

type CalendarCell = {
    day: number;
    dateKey: string;
    isWorkoutDay: boolean;
    isToday: boolean;
} | null;

const getMonthOffset = (monthStart: dayjs.Dayjs, firstWeekday: number): number => {
    const day = monthStart.day();
    if (firstWeekday === 1) return day;
    return day === 0 ? 6 : day - 1;
};

const formatMonthTitle = (monthStart: dayjs.Dayjs): string => {
    const formatted = monthStart.format('MMMM YYYY');
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.space(4),
    },
    content: {
        ...theme.screenContentPadding('root'),
        gap: theme.space(5),
    },
    calendarContainer: {
        flex: 1,
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['4xl'],
        padding: theme.space(4),
        gap: theme.space(3.5),
    },
    calendarHeader: {
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    calendarMonthTitle: {
        ...theme.fontSize.lg,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    calendarNavButton: {
        height: theme.space(9),
        width: theme.space(9),
        borderRadius: theme.radius.full,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.background,
    },
    calendarPrevMonth: {
        marginRight: theme.space(0.5),
    },
    calendarNextMonth: {
        marginLeft: theme.space(0.5),
    },
    calendarNavButtonDisabled: {
        opacity: 0.45,
    },
    calendarWeekdays: {
        marginBottom: theme.space(0.5),
        justifyContent: 'space-between',
    },
    calendarWeekdayCell: {
        width: theme.space(9),
        alignItems: 'center',
        justifyContent: 'center',
    },
    calendarWeekdayLabel: {
        ...theme.fontSize.sm,
        color: theme.colors.typography,
        opacity: 0.45,
        textTransform: 'capitalize',
    },
    calendarGrid: {
        marginTop: 0,
    },
    calendarRow: {
        justifyContent: 'space-between',
    },
    calendarRowSpacing: {
        marginTop: theme.space(3),
    },
    calendarDayCell: {
        width: theme.space(9),
        height: theme.space(9),
        alignItems: 'center',
        justifyContent: 'center',
    },
    calendarDayCircle: {
        height: theme.space(9),
        width: theme.space(9),
        borderRadius: theme.radius.full,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
        borderWidth: theme.space(0.25),
        borderColor: theme.colors.border,
    },
    calendarDayCircleCompleted: {
        backgroundColor: theme.colors.lime[400],
        borderColor: theme.colors.lime[400],
    },
    calendarDayCircleToday: {
        borderColor: theme.colors.typography,
    },
    calendarDayCircleTodayCompleted: {},
    calendarDayText: {
        ...theme.fontSize.default,
        color: theme.colors.typography,
        fontWeight: theme.fontWeight.medium.fontWeight,
        fontSize: theme.fontSize.sm.fontSize,
        opacity: 0.6,
    },
    calendarDayTextCompleted: {
        color: theme.colors.neutral[950],
        opacity: 1,
    },
    calendarDayTextToday: {
        opacity: 1,
    },
    statsContainer: {
        flex: 1,
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['4xl'],
        padding: theme.space(4),
    },
    statsWrapper: {
        flex: 1,
    },
    statContainer: {
        height: theme.space(8),
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: theme.space(3),
    },
    statTitleContainer: {
        gap: theme.space(2),
    },
    statTitle: {
        color: theme.colors.typography,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
        marginVertical: theme.space(2),
    },
    fieldContainer: {
        gap: theme.space(3),
    },
    label: {
        ...theme.fontSize['2xl'],
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
        opacity: 1,
    },
}));

const MonthStats = () => {
    const { i18n } = useTranslation(['common', 'screens']);
    const { theme, rt } = useUnistyles();
    const router = useRouter();
    const { user } = useUser();
    const { data: workouts = [] } = useWorkouts();
    const [visibleMonthStart, setVisibleMonthStart] = useState(() => dayjs().startOf('month'));

    const firstWeekday = user?.firstWeekday === 1 ? 1 : 2;

    const workoutDayKeys = useMemo(() => {
        const keys = new Set<string>();
        workouts.forEach((workout) => {
            if (workout.status !== 'completed') return;
            const workoutDate = workout.completedAt ?? workout.startedAt ?? workout.createdAt;
            if (!workoutDate) return;
            const date = dayjs(workoutDate);
            if (!date.isValid()) return;
            keys.add(date.format('YYYY-MM-DD'));
        });
        return keys;
    }, [workouts]);

    const weekdayLabels = useMemo(() => {
        const formatter = new Intl.DateTimeFormat(i18n.language, { weekday: 'short' });
        const order = firstWeekday === 1 ? WEEKDAY_ORDER_SUNDAY_FIRST : WEEKDAY_ORDER_MONDAY_FIRST;
        return order.map((weekday) => formatter.format(new Date(2024, 0, 7 + weekday)));
    }, [firstWeekday, i18n.language]);

    const monthTitle = useMemo(() => formatMonthTitle(visibleMonthStart), [visibleMonthStart]);

    const calendarCells = useMemo<CalendarCell[]>(() => {
        const monthStart = visibleMonthStart.startOf('month');
        const daysInMonth = monthStart.daysInMonth();
        const monthOffset = getMonthOffset(monthStart, firstWeekday);
        const todayKey = dayjs().format('YYYY-MM-DD');
        const totalCells = Math.ceil((monthOffset + daysInMonth) / 7) * 7;
        const cells: CalendarCell[] = [];

        for (let index = 0; index < totalCells; index += 1) {
            const day = index - monthOffset + 1;
            if (day < 1 || day > daysInMonth) {
                cells.push(null);
                continue;
            }

            const date = monthStart.date(day);
            const dateKey = date.format('YYYY-MM-DD');
            cells.push({
                day,
                dateKey,
                isWorkoutDay: workoutDayKeys.has(dateKey),
                isToday: dateKey === todayKey,
            });
        }

        return cells;
    }, [firstWeekday, visibleMonthStart, workoutDayKeys]);

    const calendarRows = useMemo(() => {
        const rows: CalendarCell[][] = [];

        for (let index = 0; index < calendarCells.length; index += 7) {
            rows.push(calendarCells.slice(index, index + 7));
        }

        return rows;
    }, [calendarCells]);

    const canGoForward = useMemo(() => {
        const currentMonthStart = dayjs().startOf('month');
        return visibleMonthStart.isBefore(currentMonthStart, 'month');
    }, [visibleMonthStart]);

    const handlePrevMonth = useCallback(() => {
        setVisibleMonthStart((prev) => prev.subtract(1, 'month').startOf('month'));
    }, []);

    const handleNextMonth = useCallback(() => {
        setVisibleMonthStart((prev) => {
            const next = prev.add(1, 'month').startOf('month');
            const currentMonthStart = dayjs().startOf('month');
            return next.isAfter(currentMonthStart, 'month') ? prev : next;
        });
    }, []);

    const handleDayPress = useCallback(
        (dateKey: string) => {
            router.navigate({
                pathname: '/day',
                params: { date: dateKey },
            } as any);
        },
        [router],
    );

    return (
        <VStack style={styles.calendarContainer}>
            <HStack style={styles.calendarHeader}>
                <Pressable onPress={handlePrevMonth} hitSlop={theme.space(2)}>
                    <Box style={styles.calendarNavButton}>
                        <ChevronLeft
                            size={theme.space(6)}
                            style={styles.calendarPrevMonth}
                            color={
                                rt.themeName === 'dark'
                                    ? theme.colors.white
                                    : theme.colors.neutral[950]
                            }
                        />
                    </Box>
                </Pressable>
                <Text style={styles.calendarMonthTitle}>{monthTitle}</Text>
                <Pressable
                    onPress={handleNextMonth}
                    disabled={!canGoForward}
                    hitSlop={theme.space(2)}
                >
                    <Box
                        style={[
                            styles.calendarNavButton,
                            !canGoForward && styles.calendarNavButtonDisabled,
                        ]}
                    >
                        <ChevronRight
                            size={theme.space(6)}
                            style={styles.calendarNextMonth}
                            color={
                                rt.themeName === 'dark'
                                    ? theme.colors.white
                                    : theme.colors.neutral[950]
                            }
                        />
                    </Box>
                </Pressable>
            </HStack>
            <HStack style={styles.calendarWeekdays}>
                {weekdayLabels.map((weekday, index) => (
                    <Box key={`${weekday}-${index}`} style={styles.calendarWeekdayCell}>
                        <Text style={styles.calendarWeekdayLabel}>{weekday}</Text>
                    </Box>
                ))}
            </HStack>
            <Box style={styles.calendarGrid}>
                {calendarRows.map((row, rowIndex) => (
                    <HStack
                        key={`calendar-row-${rowIndex}`}
                        style={[styles.calendarRow, rowIndex > 0 && styles.calendarRowSpacing]}
                    >
                        {row.map((cell, colIndex) => (
                            <Box
                                key={cell?.dateKey ?? `empty-${rowIndex}-${colIndex}`}
                                style={styles.calendarDayCell}
                            >
                                {cell ? (
                                    <Pressable
                                        onPress={() => handleDayPress(cell.dateKey)}
                                        disabled={!cell.isWorkoutDay}
                                    >
                                        <Box
                                            style={[
                                                styles.calendarDayCircle,
                                                cell.isWorkoutDay &&
                                                    styles.calendarDayCircleCompleted,
                                                cell.isToday && styles.calendarDayCircleToday,
                                                cell.isToday &&
                                                    cell.isWorkoutDay &&
                                                    styles.calendarDayCircleTodayCompleted,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.calendarDayText,
                                                    cell.isToday && styles.calendarDayTextToday,
                                                    cell.isWorkoutDay &&
                                                        styles.calendarDayTextCompleted,
                                                ]}
                                            >
                                                {cell.day}
                                            </Text>
                                        </Box>
                                    </Pressable>
                                ) : null}
                            </Box>
                        ))}
                    </HStack>
                ))}
            </Box>
        </VStack>
    );
};

export { MonthStats };
