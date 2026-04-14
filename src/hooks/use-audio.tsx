import {
    createContext,
    PropsWithChildren,
    useCallback,
    useContext,
    useEffect,
    useRef,
} from 'react';
import { setAudioModeAsync, createAudioPlayer } from 'expo-audio';
import { useUser } from './use-user';
import { reportError, runInBackground } from '@/services/error-reporting';

const workoutStartSound = require('../../assets/sounds/workout-start.wav');
const workoutStopSound = require('../../assets/sounds/workout-stop.wav');
const timerEndSound = require('../../assets/sounds/timer-end.wav');

type AudioContextType = ReturnType<typeof useAudioProvider>;

const audioContext = createContext<AudioContextType>({} as AudioContextType);

export const AudioProvider = ({ children }: PropsWithChildren) => {
    const audio = useAudioProvider();

    return <audioContext.Provider value={audio}>{children}</audioContext.Provider>;
};

export const useAudio = () => {
    return useContext(audioContext);
};

const useAudioProvider = () => {
    const { user } = useUser();
    const playerRef = useRef(createAudioPlayer());

    const isSessionActivationError = useCallback((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error ?? '');
        return message.includes('Session activation failed');
    }, []);

    const playSound = useCallback(
        async (sound: number, context: string) => {
            if (!user?.playSounds) return;

            try {
                playerRef.current.volume = (user?.soundsVolume ?? 100) / 100;
                playerRef.current.replace(sound);
                playerRef.current.play();
            } catch (error) {
                // iOS can reject AVAudioSession activation while app is backgrounded/inactive.
                if (isSessionActivationError(error)) return;
                reportError(error, context);
            }
        },
        [isSessionActivationError, user?.playSounds, user?.soundsVolume],
    );

    useEffect(() => {
        const configureAudio = async () => {
            try {
                await setAudioModeAsync({
                    playsInSilentMode: true,
                    allowsRecording: false,
                    shouldPlayInBackground: true,
                    interruptionMode: 'duckOthers',
                    interruptionModeAndroid: 'duckOthers',
                });
            } catch (error) {
                reportError(error, 'Failed to configure audio mode:');
            }
        };

        runInBackground(configureAudio, 'Failed to initialize audio mode:');
    }, []);

    const playWorkoutStart = useCallback(async () => {
        await playSound(workoutStartSound, 'Failed to play workout start sound:');
    }, [playSound]);

    const playWorkoutStop = useCallback(async () => {
        await playSound(workoutStopSound, 'Failed to play workout stop sound:');
    }, [playSound]);

    const playTimerEnd = useCallback(async () => {
        await playSound(timerEndSound, 'Failed to play timer end sound:');
    }, [playSound]);

    return {
        playWorkoutStart,
        playWorkoutStop,
        playTimerEnd,
    };
};
