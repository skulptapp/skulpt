import { toInteger, toNumber } from 'lodash';

export const strToBool = (value: string) => {
    switch (value) {
        case 'true':
        case 'yes':
        case '1':
            return true;
        case 'false':
        case 'no':
        case '0':
            return false;
        default:
            return null;
    }
};

export const getNumericValue = (value?: string | number) => {
    if (value === undefined) {
        return null;
    }
    return value;
};

export const valueToType = (value: string, valueType: 'text' | 'number' | 'decimal' | 'bool') => {
    if (valueType === 'bool') {
        return strToBool(value);
    }
    if (valueType === 'number') {
        return toInteger(value);
    }
    if (valueType === 'decimal') {
        return toNumber(value);
    }
    return value;
};

export const toInt = (v: unknown): number => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (v instanceof Date) return Math.floor(v.getTime() / 1000);
    if (typeof v === 'string') {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }
    return 0;
};
