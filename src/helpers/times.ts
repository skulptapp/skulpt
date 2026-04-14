import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import i18n from '@/locale/i18n';
import { toInt } from './values';

dayjs.extend(duration);
dayjs.extend(localizedFormat);

export const formatWorkoutDuration = (value: number): string => {
    // Detect unit heuristically: treat large values as milliseconds
    // Workouts rarely exceed 27 hours; anything above 100k likely ms
    const unit: 'milliseconds' | 'seconds' = value > 100000 ? 'milliseconds' : 'seconds';
    const d = dayjs.duration(value, unit);

    const totalHours = Math.floor(d.asHours());
    const minutes = d.minutes();
    const seconds = d.seconds();

    if (totalHours > 0) {
        return `${totalHours} ${i18n.t('durations.hr', { ns: 'common' })} ${minutes} ${i18n.t('durations.min', { ns: 'common' })}`;
    }
    if (minutes > 0) {
        return `${minutes} ${i18n.t('durations.min', { ns: 'common' })} ${seconds} ${i18n.t('durations.sec', { ns: 'common' })}`;
    }
    return `${seconds} ${i18n.t('durations.sec', { ns: 'common' })}`;
};

/**
 * Like formatClockSeconds, but doesn't left-pad the first segment.
 * Examples:
 * - 300s -> "5:00" (not "05:00")
 * - 50s -> "0:50" (not "00:50")
 * - 3661s -> "1:01:01" (hours not padded)
 */
export const formatClockSecondsCompact = (seconds: number): string => {
    const total = Math.max(0, Math.floor(toInt(seconds)));
    const hh = Math.floor(total / 3600);
    const mm = Math.floor((total % 3600) / 60);
    const ss = total % 60;
    const pad2 = (n: number) => String(n).padStart(2, '0');

    if (hh > 0) {
        return `${hh}:${pad2(mm)}:${pad2(ss)}`;
    }

    return `${mm}:${pad2(ss)}`;
};

export const digitsFromSeconds = (seconds: number) => {
    const total = Math.max(0, Math.floor(seconds));
    const hh = Math.floor(total / 3600);
    const mm = Math.floor((total % 3600) / 60);
    const ss = total % 60;
    const pad2 = (n: number) => String(n).padStart(2, '0');

    if (hh > 0) return `${hh}${pad2(mm)}${pad2(ss)}`;
    if (mm > 0) return `${mm}${pad2(ss)}`;
    return `${ss}`; // 0:50 -> "50", 0:05 -> "5"
};

export const secondsFromDigits = (digits: string) => {
    const d = digits.replace(/\D/g, '');
    if (d.length === 0) return 0;
    const ss = parseInt(d.slice(-2).padStart(2, '0'), 10);
    const mmRaw = d.length > 2 ? d.slice(-4, -2) : '';
    const mm = mmRaw.length > 0 ? parseInt(mmRaw, 10) : 0;
    const hhRaw = d.length > 4 ? d.slice(0, -4) : '';
    const hh = hhRaw.length > 0 ? parseInt(hhRaw, 10) : 0;

    const safeSs = Number.isNaN(ss) ? 0 : Math.min(59, Math.max(0, ss));
    const safeMm = Number.isNaN(mm) ? 0 : Math.max(0, mm);
    const safeHh = Number.isNaN(hh) ? 0 : Math.max(0, hh);
    return safeHh * 3600 + safeMm * 60 + safeSs;
};

/**
 * Format a date/time according to user preferences
 */
export const formatDateTime = (date: Date | string, timeFormat: '12h' | '24h' = '24h'): string => {
    const d = dayjs(date);
    if (timeFormat === '12h') {
        return d.format('MMM D, YYYY h:mm A');
    } else {
        return d.format('MMM D, YYYY HH:mm');
    }
};

/**
 * Format a date according to user preferences
 */
export const formatDate = (date: Date | string): string => {
    return dayjs(date).format('LL');
};

/**
 * Format a time according to user preferences
 */
export const formatTime = (date: Date | string, timeFormat: '12h' | '24h' = '24h'): string => {
    const d = dayjs(date);
    if (timeFormat === '12h') {
        return d.format('h:mm A');
    } else {
        return d.format('HH:mm');
    }
};

/**
 * Format weekday name according to user's firstWeekday setting
 */
export const formatWeekday = (date: Date | string, firstWeekday: number = 2): string => {
    const d = dayjs(date);
    const weekday = d.format('dddd');
    return weekday.charAt(0).toUpperCase() + weekday.slice(1);
};

export const toMs = (value: Date | number | string | null | undefined): number | null => {
    if (value == null) return null;
    if (value instanceof Date) {
        const ms = value.getTime();
        return Number.isNaN(ms) ? null : ms;
    }
    if (typeof value === 'number') return Number.isNaN(value) ? null : value;
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? null : ms;
};
