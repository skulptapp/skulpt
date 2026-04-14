import { FC } from 'react';
import {
    Pressable as DefaultPressable,
    PressableProps as DefaultPressableProps,
} from 'react-native';

export type PressableProps = DefaultPressableProps;

export const Pressable: FC<PressableProps> = ({ ...rest }) => {
    return <DefaultPressable {...rest} />;
};
