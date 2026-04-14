import { FC } from 'react';
import { KeyboardAvoidingView as DefaultKeyboardAvoidingView } from 'react-native';

export type KeyboardAvoidingViewProps = DefaultKeyboardAvoidingView['props'];

export const KeyboardAvoidingView: FC<KeyboardAvoidingViewProps> = ({ ...rest }) => {
    return <DefaultKeyboardAvoidingView {...rest} />;
};
