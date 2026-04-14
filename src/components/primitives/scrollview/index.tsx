import { FC } from 'react';
import { ScrollView as DefaultScrollView } from 'react-native';

export type ScrollViewProps = DefaultScrollView['props'];

export const ScrollView: FC<ScrollViewProps> = ({ ...rest }) => {
    return <DefaultScrollView {...rest} />;
};
