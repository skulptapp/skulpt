module.exports = function (api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: [
            [
                'inline-import',
                {
                    extensions: ['.sql'],
                },
            ],
            [
                'react-native-unistyles/plugin',
                {
                    root: 'src/routes',
                },
            ],
            ['react-native-worklets/plugin'],
        ],
    };
};
