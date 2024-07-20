/**
 * This file lives outside of the `src/wordpress` directory on
 * purpose.
 *
 * `src/wordpress` hosts autogenerated code and is added to eslint
 * and NX ignore lists. However, this test file is written by hand
 * and should still be linted and picked up by the test runner.
 */

import { getWordPressModuleDetails } from './wordpress/get-wordpress-module-details';

describe('getWordPressModuleDetails()', () => {
	it('should return a data loader module', async () => {
		const module = getWordPressModuleDetails();
		expect(module.url).toMatch(/\/wp-\d.\d.zip$/);
	});
});
