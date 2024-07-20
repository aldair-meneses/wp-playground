import { phpVar } from '@php-wasm/util';
import { StepHandler } from '.';
import { defineWpConfigConsts } from './define-wp-config-consts';
import { login } from './login';
import { request } from './request';
import { setSiteOptions } from './site-data';
import { activatePlugin } from './activate-plugin';
import { getURLScope, isURLScoped } from '@php-wasm/scopes';
import { logger } from '@php-wasm/logger';

/**
 * @inheritDoc enableMultisite
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 * 		"step": "enableMultisite"
 * }
 * </code>
 */
export interface EnableMultisiteStep {
	step: 'enableMultisite';
}

/**
 * Defines the [Multisite](https://developer.wordpress.org/advanced-administration/multisite/create-network/) constants in a `wp-config.php` file.
 *
 * This step can be called multiple times, and the constants will be merged.
 *
 * @param playground The playground client.
 * @param enableMultisite
 */
export const enableMultisite: StepHandler<EnableMultisiteStep> = async (
	playground
) => {
	await defineWpConfigConsts(playground, {
		consts: {
			WP_ALLOW_MULTISITE: 1,
		},
	});

	const url = new URL(await playground.absoluteUrl);
	if (url.port !== '') {
		let errorMessage = `The current host is ${url.host}, but WordPress multisites do not support custom ports.`;
		if (url.hostname === 'localhost') {
			errorMessage += ` For development, you can set up a playground.test domain using the instructions at https://wordpress.github.io/wordpress-playground/contributing/code.`;
		}
		throw new Error(errorMessage);
	}
	const sitePath = url.pathname.replace(/\/$/, '') + '/';
	const siteUrl = `${url.protocol}//${url.hostname}${sitePath}`;
	await setSiteOptions(playground, {
		options: {
			siteurl: siteUrl,
			home: siteUrl,
		},
	});

	// Ensure we're logged in
	await login(playground, {});

	const docroot = await playground.documentRoot;

	// Deactivate all the plugins as required by the multisite installation.
	const result = await playground.run({
		code: `<?php
define( 'WP_ADMIN', true );
require_once(${phpVar(docroot)} . "/wp-load.php");

// Set current user to admin
( get_users(array('role' => 'Administrator') )[0] );

require_once(${phpVar(docroot)} . "/wp-admin/includes/plugin.php");
$plugins_root = ${phpVar(docroot)} . "/wp-content/plugins";
$plugins = glob($plugins_root . "/*");

$deactivated_plugins = [];
foreach($plugins as $plugin_path) {
	if (str_ends_with($plugin_path, '/index.php')) {
		continue;
	}
	if (!is_dir($plugin_path)) {
		$deactivated_plugins[] = substr($plugin_path, strlen($plugins_root) + 1);
		deactivate_plugins($plugin_path);
		continue;
	}
	// Find plugin entry file
	foreach ( ( glob( $plugin_path . '/*.php' ) ?: array() ) as $file ) {
		$info = get_plugin_data( $file, false, false );
		if ( ! empty( $info['Name'] ) ) {
			deactivate_plugins( $file );
			$deactivated_plugins[] = substr($file, strlen($plugins_root) + 1);
			break;
		}
	}
}
echo json_encode($deactivated_plugins);
`,
	});
	const deactivatedPlugins = result.json;

	// Extract nonce for multisite form submission
	const networkForm = await request(playground, {
		request: {
			url: '/wp-admin/network.php',
		},
	});
	const nonce = networkForm.text.match(
		/name="_wpnonce"\s+value="([^"]+)"/
	)?.[1];

	// @TODO: Extract nonce using wp_create_nonce() instead
	//        of an HTTP request.
	//        Unfortunately, the code snippet below does not
	//        yield a nonce that WordPress would accept:
	/*
    const nonce = (await playground.run({
	  	code: `<?php
	  	require '/wordpress/wp-load.php';
	  	wp_set_current_user(1);
	  	echo wp_create_nonce('install-network-1');
	  	`,
    })).text;
    */

	const response = await request(playground, {
		request: {
			url: '/wp-admin/network.php',
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: jsonToUrlEncoded({
				_wpnonce: nonce!,
				_wp_http_referer: sitePath + 'wp-admin/network.php',
				sitename: 'My WordPress Website Sites',
				email: 'admin@localhost.com',
				submit: 'Install',
			}),
		},
	});
	if (response.httpStatusCode !== 200) {
		logger.warn('WordPress response was', {
			response,
			text: response.text,
			headers: response.headers,
		});
		throw new Error(
			`Failed to enable multisite. Response code was ${response.httpStatusCode}`
		);
	}

	await defineWpConfigConsts(playground, {
		consts: {
			MULTISITE: true,
			SUBDOMAIN_INSTALL: false,
			SITE_ID_CURRENT_SITE: 1,
			BLOG_ID_CURRENT_SITE: 1,
			DOMAIN_CURRENT_SITE: url.hostname,
			PATH_CURRENT_SITE: sitePath,
		},
	});

	// Preload a sunrise.php file. Without it, requiring `wp-load.php`
	// would result in a redirect to the main site.
	//
	// Normally that's a drop-in plugin living in wp-content, but:
	// * We only need this logic in Playground runtime.
	// * We don't want to modify the user site in any way not explicitly
	//   requested.
	const playgroundUrl = new URL(await playground.absoluteUrl);
	const wpInstallationFolder = isURLScoped(playgroundUrl)
		? 'scope:' + getURLScope(playgroundUrl)
		: null;
	// $_SERVER variables must be set before WordPress is loaded,
	// therefore they're placed in the `preload` directory.
	await playground.writeFile(
		'/internal/shared/preload/sunrise.php',
		`<?php
	$_SERVER['HTTP_HOST'] = ${phpVar(playgroundUrl.hostname)};
	$folder = ${phpVar(wpInstallationFolder)};
	if ($folder && strpos($_SERVER['REQUEST_URI'],"/$folder") === false) {
		$_SERVER['REQUEST_URI'] = "/$folder/" . ltrim($_SERVER['REQUEST_URI'], '/');
	}
`
	);
	// The default BLOG_ID_CURRENT_SITE must be set after WordPress
	// is loaded, therefore it is placed in the `mu-plugins` directory.
	await playground.writeFile(
		'/internal/shared/mu-plugins/sunrise.php',
		`<?php
		if ( !defined( 'BLOG_ID_CURRENT_SITE' ) ) {
			define( 'BLOG_ID_CURRENT_SITE', 1 );
		}
`
	);
	await login(playground, {});

	// Reactivate any previously deactivated plugins
	for (const plugin of deactivatedPlugins) {
		await activatePlugin(playground, {
			pluginPath: plugin,
		});
	}
};

function jsonToUrlEncoded(json: Record<string, string>) {
	return Object.keys(json)
		.map(
			(key) =>
				encodeURIComponent(key) + '=' + encodeURIComponent(json[key])
		)
		.join('&');
}
