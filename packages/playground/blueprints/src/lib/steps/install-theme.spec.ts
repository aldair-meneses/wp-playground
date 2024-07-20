import { PHP } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { installTheme } from './install-theme';
import { PHPRequestHandler } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

describe('Blueprint step installTheme', () => {
	let zipFileName = '';
	let zipFilePath = '';
	let rootPath = '';
	let themesPath = '';
	let php: PHP;
	let handler: PHPRequestHandler;
	beforeEach(async () => {
		handler = new PHPRequestHandler({
			phpFactory: async () =>
				new PHP(await loadNodeRuntime(RecommendedPHPVersion)),
			documentRoot: '/wordpress',
		});
		php = await handler.getPrimaryPhp();

		rootPath = php.documentRoot;
		themesPath = `${rootPath}/wp-content/themes`;
		php.mkdir(themesPath);

		// Create test theme
		const themeName = 'test-theme';

		php.mkdir(`/${themeName}`);
		php.writeFile(
			`/${themeName}/index.php`,
			`/**\n * Theme Name: Test Theme`
		);

		// Note the package name is different from theme folder name
		zipFileName = `${themeName}-0.0.1.zip`;
		zipFilePath = `${themesPath}/${zipFileName}`;

		await php.run({
			code: `<?php $zip = new ZipArchive(); $zip->open("${zipFilePath}", ZIPARCHIVE::CREATE); $zip->addFile("/${themeName}/index.php"); $zip->close();`,
		});

		php.rmdir(`/${themeName}`);

		expect(php.fileExists(zipFilePath)).toBe(true);
	});

	afterEach(() => {
		php.exit();
	});

	it('should install a theme', async () => {
		await installTheme(php, {
			themeZipFile: new File(
				[php.readFileAsBuffer(zipFilePath)],
				zipFileName
			),
			ifAlreadyInstalled: 'overwrite',
			options: {
				activate: false,
			},
		});
		expect(php.fileExists(zipFilePath)).toBe(true);
	});

	describe('ifAlreadyInstalled option', () => {
		beforeEach(async () => {
			await installTheme(php, {
				themeZipFile: new File(
					[php.readFileAsBuffer(zipFilePath)],
					zipFileName
				),
				ifAlreadyInstalled: 'error',
				options: {
					activate: false,
				},
			});
		});

		it('ifAlreadyInstalled=ovewrite should overwrite the theme if the theme already exists', async () => {
			await installTheme(php, {
				themeZipFile: new File(
					[php.readFileAsBuffer(zipFilePath)],
					zipFileName
				),
				ifAlreadyInstalled: 'overwrite',
				options: {
					activate: false,
				},
			});
			expect(php.fileExists(zipFilePath)).toBe(true);
		});

		it('ifAlreadyInstalled=skip should skip the theme if the theme already exists', async () => {
			await installTheme(php, {
				themeZipFile: new File(
					[php.readFileAsBuffer(zipFilePath)],
					zipFileName
				),
				ifAlreadyInstalled: 'skip',
				options: {
					activate: false,
				},
			});
			expect(php.fileExists(zipFilePath)).toBe(true);
		});

		it('ifAlreadyInstalled=error should throw an error if the theme already exists', async () => {
			await expect(
				installTheme(php, {
					themeZipFile: new File(
						[php.readFileAsBuffer(zipFilePath)],
						zipFileName
					),
					ifAlreadyInstalled: 'error',
					options: {
						activate: false,
					},
				})
			).rejects.toThrow();
		});
	});
});
