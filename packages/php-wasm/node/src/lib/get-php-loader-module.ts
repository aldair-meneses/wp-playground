import { LatestSupportedPHPVersion } from '@php-wasm/universal';
import type { PHPLoaderModule, SupportedPHPVersion } from '@php-wasm/universal';

export async function getPHPLoaderModule(
	version: SupportedPHPVersion = LatestSupportedPHPVersion
): Promise<PHPLoaderModule> {
	switch (version) {
		case '8.3':
			// @ts-ignore
			return await import(`../../public/php_8_3.js`);
		case '8.2':
			// @ts-ignore
			return await import(`../../public/php_8_2.js`);
		case '8.1':
			// @ts-ignore
			return await import(`../../public/php_8_1.js`);
		case '8.0':
			// @ts-ignore
			return await import(`../../public/php_8_0.js`);
		case '7.4':
			// @ts-ignore
			return await import(`../../public/php_7_4.js`);
		case '7.3':
			// @ts-ignore
			return await import(`../../public/php_7_3.js`);
		case '7.2':
			// @ts-ignore
			return await import(`../../public/php_7_2.js`);
		case '7.1':
			// @ts-ignore
			return await import(`../../public/php_7_1.js`);
		case '7.0':
			// @ts-ignore
			return await import(`../../public/php_7_0.js`);
	}
	throw new Error(`Unsupported PHP version ${version}`);
}
