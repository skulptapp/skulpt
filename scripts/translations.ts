import fs from 'fs-extra';
import { merge } from 'lodash';

const generate = async () => {
    const translations = {};

    const local = ['common', 'menu', 'screens'];

    for (const lng of ['en', 'ru', 'zh', 'es', 'hi']) {
        for (const ns of local) {
            const data = await fs.readJSON(`./src/locale/resources/${lng}/${ns}.json`, 'utf8');
            merge(translations, {
                [lng]: {
                    [ns]: data,
                },
            });
        }
    }

    await fs.promises.writeFile(
        './src/locale/translations/resources.json',
        JSON.stringify(translations),
    );
};

generate().catch((error) => {
    console.error('Failed to generate translation resources:', error);
    process.exitCode = 1;
});
