import { FC, forwardRef, useEffect } from 'react';
import Svg, { G, Path } from 'react-native-svg';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';

import { Box, BoxProps } from '@/components/primitives/box';
import { View } from 'react-native';

interface SpinnerProps {
    color?: string;
    size?: number;
}

interface LoaderIconProps extends SpinnerProps {
    style: BoxProps['style'];
}

const styles = StyleSheet.create((theme) => ({
    iconContainer: (size: number) => ({
        height: size,
        width: size,
    }),
}));

const LoaderIcon = forwardRef<View, LoaderIconProps>(
    ({ color, size = 24, style }: LoaderIconProps, ref) => (
        <Box ref={ref} style={[styles.iconContainer(size), style]}>
            <Svg viewBox="0 0 100 100">
                <G stroke="none" fill="none">
                    <Path
                        d="M62.5269114,87.3080543 C69.1689899,85.0849803 72.5508338,95.1855112 65.9073267,97.4085851 C59.8566869,99.4412987 53.424612,100.288813 47.053431,99.9134496 C19.4993857,98.2860467 -1.53847608,74.6076573 0.0883376156,47.053612 C1.7157406,19.4995667 25.39413,-1.54008086 52.9481753,0.0885185756 C80.5022206,1.71592156 101.540082,25.3943109 99.9132687,52.9483562 C99.7828254,55.175716 99.4898507,57.5145062 99.058754,59.7020438 C97.7138737,66.5918052 87.2365864,64.5487343 88.5814309,57.6575444 C88.9385799,55.853049 89.1624945,54.1585556 89.2706214,52.3226312 C90.5499469,30.6615444 73.9850013,12.0112236 52.3235574,10.7326302 C30.6624706,9.45330463 12.0121498,26.0182502 10.7335564,47.6796942 C9.45423083,69.340781 26.0177478,87.9911017 47.6788346,89.2696952 C52.7326716,89.5682539 57.7257931,88.9202249 62.5264114,87.3082329 L62.5269114,87.3080543 Z"
                        fill={color}
                    />
                </G>
            </Svg>
        </Box>
    ),
);

LoaderIcon.displayName = 'LoaderIcon';

const AnimatedIcon = Animated.createAnimatedComponent(LoaderIcon);

const Spinner: FC<SpinnerProps> = ({ color, size }) => {
    const { theme } = useUnistyles();

    const spin = useSharedValue(0);

    useEffect(() => {
        spin.value = withRepeat(withTiming(360, { duration: 1000 }), -2, false);
    }, [spin]);

    const styles = useAnimatedStyle(() => ({
        transform: [
            {
                rotateZ: `${spin.value}deg`,
            },
        ],
    }));

    return <AnimatedIcon color={color || theme.colors.neutral[950]} style={styles} size={size} />;
};

export default Spinner;
