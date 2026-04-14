const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');
const reactCompiler = require('eslint-plugin-react-compiler');
const pluginQuery = require('@tanstack/eslint-plugin-query');

module.exports = defineConfig([
    expoConfig,
    eslintPluginPrettierRecommended,
    ...pluginQuery.configs['flat/recommended'],
    {
        ignores: ['dist/*'],
        plugins: {
            'react-compiler': reactCompiler,
        },
        rules: {
            'react-compiler/react-compiler': 'error',
        },
    },
]);
