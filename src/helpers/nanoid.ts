import { customAlphabet } from 'nanoid';
import { alphanumeric } from 'nanoid-dictionary';

export const nanoid = (size: number | undefined = 21) => {
    return customAlphabet(alphanumeric, size)();
};
