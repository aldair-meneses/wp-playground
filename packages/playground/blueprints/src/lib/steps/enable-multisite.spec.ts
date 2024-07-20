import { RecommendedPHPVersion } from '@wp-playground/common';
import {
	getSqliteDatabaseModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';
import { enableMultisite } from './enable-multisite';
import { bootWordPress } from '@wp-playground/wordpress';
import { loadNodeRuntime } from '@php-wasm/node';

const DOCROOT = '/test-dir';
describe('Blueprint step enableMultisite', () => {
	async function doBootWordPress(options: { absoluteUrl: string }) {
		const requestHandler = await bootWordPress({
			createPhpRuntime: async () =>
				await loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: options.absoluteUrl,
			documentRoot: DOCROOT,

			wordPressZip: await getWordPressModule(),
			sqliteIntegrationPluginZip: await getSqliteDatabaseModule(),
		});
		const php = await requestHandler.getPrimaryPhp();

		return { php, requestHandler };
	}

	it('should enable a multisite on a scoped URL', async () => {
		const { php, requestHandler } = await doBootWordPress({
			absoluteUrl: 'http://playground-domain/scope:987987/',
		});
		await enableMultisite(php, {});

		const response = await requestHandler.request({
			url: '/wp-admin/network/',
		});
		expect(response.text).toContain('My Sites');
	}, 30_000);

	it('should enable a multisite on a scopeless URL', async () => {
		const { php, requestHandler } = await doBootWordPress({
			absoluteUrl: 'http://playground-domain/',
		});
		await enableMultisite(php, {});

		const response = await requestHandler.request({
			url: '/wp-admin/network/',
		});
		expect(response.text).toContain('My Sites');
	}, 30_000);
});
