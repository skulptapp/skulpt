/**
 * Unit conversion utilities for the app
 */

// Weight conversions
export const convertWeight = (value: number, from: 'kg' | 'lb', to: 'kg' | 'lb'): number => {
    if (from === to) return value;

    if (from === 'kg' && to === 'lb') {
        return value * 2.20462; // 1 kg = 2.20462 lb
    }

    if (from === 'lb' && to === 'kg') {
        return value / 2.20462; // 1 lb = 0.453592 kg
    }

    return value;
};

// Measurement conversions (height/length)
export const convertMeasurement = (value: number, from: 'cm' | 'in', to: 'cm' | 'in'): number => {
    if (from === to) return value;

    if (from === 'cm' && to === 'in') {
        return value / 2.54; // 1 cm = 0.393701 in
    }

    if (from === 'in' && to === 'cm') {
        return value * 2.54; // 1 in = 2.54 cm
    }

    return value;
};

// Distance conversions
export const convertDistance = (value: number, from: 'km' | 'mi', to: 'km' | 'mi'): number => {
    if (from === to) return value;

    if (from === 'km' && to === 'mi') {
        return value * 0.621371; // 1 km = 0.621371 mi
    }

    if (from === 'mi' && to === 'km') {
        return value / 0.621371; // 1 mi = 1.60934 km
    }

    return value;
};

// Temperature conversions
export const convertTemperature = (
    value: number,
    from: 'celsius' | 'fahrenheit',
    to: 'celsius' | 'fahrenheit',
): number => {
    if (from === to) return value;

    if (from === 'celsius' && to === 'fahrenheit') {
        return (value * 9) / 5 + 32; // °C to °F
    }

    if (from === 'fahrenheit' && to === 'celsius') {
        return ((value - 32) * 5) / 9; // °F to °C
    }

    return value;
};

// Format weight with user preferred units
export const formatWeight = (
    value: number,
    userUnits: 'kg' | 'lb' | null | undefined,
    exerciseUnits?: 'kg' | 'lb' | null,
): string => {
    // Use exercise units if specified, otherwise use user units, fallback to kg
    const units = exerciseUnits || userUnits || 'kg';
    const convertedValue = exerciseUnits ? value : convertWeight(value, 'kg', units);
    return `${convertedValue.toFixed(1)} ${units}`;
};

// Format measurement with user preferred units
export const formatMeasurement = (
    value: number,
    userUnits: 'cm' | 'in' | null | undefined,
): string => {
    const units = userUnits || 'cm';
    const convertedValue = convertMeasurement(value, 'cm', units);
    return `${Math.round(convertedValue)} ${units}`;
};

// Format distance with user preferred units
export const formatDistance = (
    value: number,
    userUnits: 'km' | 'mi' | null | undefined,
    exerciseUnits?: 'km' | 'mi' | null,
): string => {
    // Use exercise units if specified, otherwise use user units, fallback to km
    const units = exerciseUnits || userUnits || 'km';
    const convertedValue = exerciseUnits ? value : convertDistance(value, 'km', units);
    return `${convertedValue.toFixed(2)} ${units}`;
};

// Format temperature with user preferred units
export const formatTemperature = (
    value: number,
    userUnits: 'celsius' | 'fahrenheit' | null | undefined,
): string => {
    const units = userUnits || 'celsius';
    const convertedValue = convertTemperature(value, 'celsius', units);
    const unitSymbol = units === 'celsius' ? '°C' : '°F';
    return `${Math.round(convertedValue)}${unitSymbol}`;
};

// Convert weight input to kg (internal storage format)
export const weightInputToKg = (value: number, inputUnits: 'kg' | 'lb'): number => {
    return convertWeight(value, inputUnits, 'kg');
};

// Convert measurement input to cm (internal storage format)
export const measurementInputToCm = (value: number, inputUnits: 'cm' | 'in'): number => {
    return convertMeasurement(value, inputUnits, 'cm');
};

// Convert distance input to km (internal storage format)
export const distanceInputToKm = (value: number, inputUnits: 'km' | 'mi'): number => {
    return convertDistance(value, inputUnits, 'km');
};

// Convert temperature input to celsius (internal storage format)
export const temperatureInputToCelsius = (
    value: number,
    inputUnits: 'celsius' | 'fahrenheit',
): number => {
    return convertTemperature(value, inputUnits, 'celsius');
};
