const IS_DEV = process.env.APP_VARIANT === 'development';

/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
    type: 'watch',
    name: `${config.name}Watch`,
    icon: IS_DEV ? '../../assets/images/icon-dev.png' : '../../assets/images/icon.png',
    colors: { $accent: 'darkcyan' },
    deploymentTarget: '10.0',
    frameworks: ['SwiftUI', 'WatchConnectivity', 'HealthKit'],
    entitlements: {
        'com.apple.developer.healthkit': true,
        'com.apple.developer.healthkit.access': ['health-records'],
    },
});
