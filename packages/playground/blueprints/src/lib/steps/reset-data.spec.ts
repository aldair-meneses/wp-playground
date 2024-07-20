import { PHP } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { resetData } from './reset-data';
import {
	getSqliteDatabaseModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';
import { bootWordPress } from '@wp-playground/wordpress';
import { loadNodeRuntime } from '@php-wasm/node';

const docroot = '/php';
describe('Blueprint step resetData()', () => {
	let php: PHP;
	beforeEach(async () => {
		const handler = await bootWordPress({
			createPhpRuntime: async () =>
				await loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: 'http://playground-domain/',
			documentRoot: docroot,

			wordPressZip: await getWordPressModule(),
			sqliteIntegrationPluginZip: await getSqliteDatabaseModule(),
		});
		php = await handler.getPrimaryPhp();
	});

	it('should assign ID=1 to the first post created after applying the resetData step', async () => {
		php.writeFile(`${docroot}/index.php`, `<?php echo 'Hello World';`);
		await resetData(php, {});
		const result = await php.run({
			code: `<?php 
			require "/php/wp-load.php";
			// Create a new WordPress post
			$postId = wp_insert_post([
				'post_title' => 'My New Post',
				'post_content' => 'This is the content of my new post.',
				'post_status' => 'publish',
			]);

			if (!$postId || is_wp_error($postId)) {
				throw new Error('Error creating post.');
			}

			echo json_encode($postId);
			`,
		});

		expect(result.text).toBe('1');
	});
});
