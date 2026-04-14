module.exports = {
    cli: {
        version: '>= 16.17.3',
        appVersionSource: 'local',
    },
    build: {
        development: {
            environment: 'development',
            developmentClient: true,
            distribution: 'internal',
            channel: 'development',
        },
        preview: {
            environment: 'preview',
            distribution: 'internal',
            channel: 'preview',
        },
        production: {
            environment: 'production',
            channel: 'production',
        },
    },
    submit: {
        production: {
            android: {
                track: 'internal',
                releaseStatus: 'completed',
            },
            ios: {
                appleId: process.env.APP_APPLE_ID,
                ascAppId: process.env.APP_ASC_APP_ID,
                appleTeamId: process.env.APP_APPLE_TEAM_ID || '',
            },
        },
    },
};
