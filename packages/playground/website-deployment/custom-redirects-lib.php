<?php
/**
 * ATTENTION: Please update Playground's .htaccess file as necessary
 * whenever making changes here.
 */

// Used during deployment to identify files that need to be served in a custom way via PHP
function playground_file_needs_special_treatment( $path ) {
	return (
		!! playground_maybe_rewrite( $path ) ||
		!! playground_maybe_redirect( $path ) ||
		!! playground_get_custom_response_headers( $path ) ||
		!! playground_maybe_set_environment( $path )
	);
}

function playground_handle_request() {
	$may_edge_cache = true;

	// TODO: If needed, switch to a printf style signature
	// so string interpolation only occurs when actually logging.
	$log = defined( 'PLAYGROUND_DEBUG' ) && PLAYGROUND_DEBUG
		? function ( $str ) { error_log( "PLAYGROUND: $str" ); }
		: function () {};

	$log( "Handling request for '${_SERVER['REQUEST_URI']}'" );

	$url = parse_url( $_SERVER['REQUEST_URI'] );
	if ( false === $url ) {
		$log( "Unable to parse URL: '$url'" );
		return;
	}

	$original_requested_path = $url['path'];
	$log( "Requested path: '$original_requested_path'" );

	//
	// REWRITES
	//
	$requested_path = $original_requested_path;
	$rewritten_path = playground_maybe_rewrite( $original_requested_path );
	if ( $rewritten_path ) {
		$requested_path = $rewritten_path;
		$log( "Rewrote '$original_requested_path' to '$requested_path'" );
	}

	//
	// REDIRECTS
	//
	$redirect = playground_maybe_redirect( $requested_path );
	if ( false !== $redirect ) {
		// Disable edge caching because this resource may be redirected by PHP.
		// Note: Using the header `Vary: Referer` does not seem to affect cacheability.
		$may_edge_cache = false;

		if ( isset( $redirect['internal' ] ) && $redirect['internal'] ) {
			$requested_path = $redirect['location'];
		} else {
			$should_redirect = true;
			if ( isset( $redirect['condition']['referers'] ) ) {
				$should_redirect = false;
				if ( isset( $_SERVER['HTTP_REFERER'] ) ) {
					foreach ( $redirect['condition']['referers'] as $referer ) {
						if ( str_starts_with( $_SERVER['HTTP_REFERER'], $referer ) ) {
							$should_redirect = true;
							break;
						}
					}
				}
			}

			if ( $should_redirect ) {
				$log( "Redirecting to '${redirect['location']}' with status '${redirect['status']}'" );
				header( "Location: ${redirect['location']}" );
				http_response_code( $redirect['status'] );
				die();
			}
		}
	}

	//
	// PATH RESOLUTION
	//
	$resolved_path = realpath( __DIR__ . $requested_path );
	if ( is_dir( $resolved_path ) ) {
		$resolved_path = playground_resolve_to_index_file( $resolved_path );
	}

	if ( false === $resolved_path ) {
		$resolved_path = realpath( __DIR__ . '/files-to-serve-via-php' . $requested_path );
		if ( is_dir( $resolved_path ) ) {
			$resolved_path = playground_resolve_to_index_file( $resolved_path );
		}
	}

	$log( "Resolved '$original_requested_path' to '$resolved_path'." );

	if ( false === $resolved_path ) {
		$log( "File not found: '$resolved_path'" );
		http_response_code( 404 );
		die();
	}

	if ( ! str_starts_with( $resolved_path, '/srv/htdocs/' ) ) {
		$log( "This looks like attempted path traversal: '$original_requested_path'" );
		http_response_code( 403 );
		die();
	}

	//
	// RESPONSE HEADERS
	//

	$mtime = filemtime( $resolved_path );
	$last_modified = date( 'F d Y H:i:s.', $mtime );
	header( "Last-Modified: $last_modified" );

	$filename = basename( $resolved_path );

	$extension_match = array();
	$extension_match_result = preg_match(
		'/\.(?<value>[^\.]+)$/',
		$filename,
		$extension_match
	);
	$extension = $extension_match_result === 1
		? strtolower( $extension_match['value'] )
		: false;

	require_once __DIR__ . '/mime-types.php';
	$content_type = $mime_types[ $extension ] ?? $mime_types['_default'];
	$log( "Setting Content-Type to '$content_type'" );
	header( "Content-Type: $content_type" );

	$custom_response_headers = playground_get_custom_response_headers( $requested_path );
	if ( ! empty( $custom_response_headers ) ) {
		foreach ( $custom_response_headers as $custom_header ) {
			header( $custom_header );
		}
	} else {
		if ( $may_edge_cache ) {
			$log( "Marking for cache: '$resolved_path'" );
			header( 'A8C-Edge-Cache: cache' );
		} else {
			$log( "Skipping edge cache: '$resolved_path'" );
			header( 'Cache-Control: no-cache' );
		}
	}

	if ( 'HEAD' === $_SERVER['REQUEST_METHOD'] ) {
		die();
	}

	//
	// CONTENT
	//

	if ( 'php' === $extension ) {
		$log( "Running PHP: '$resolved_path'" );
		playground_maybe_set_environment( $requested_path );
		require $resolved_path;
	} else {
		$log( "Reading static file: '$resolved_path'" );
		readfile( $resolved_path );
	}
	die();
}

function playground_maybe_rewrite( $original_requested_path ) {
	$requested_path = $original_requested_path;

	if ( str_ends_with( $requested_path, 'plugin-proxy' ) ) {
		$requested_path = '/plugin-proxy.php';
	}

	if ( $requested_path !== $original_requested_path ) {
		return $requested_path;
	}

	return false;
}

function playground_maybe_redirect( $requested_path ) {
	if ( str_ends_with( $requested_path, '/wordpress-browser.html' ) ) {
		return array(
			'location' => '/',
			'status' => 301
		);
	}

	if ( str_ends_with( $requested_path, '/wordpress.html' ) ) {
		return array(
			'condition' => array(
				'referers' => array(
					'https://developer.wordpress.org/',
					'https://wordpress.org/',
				),
			),
			'location' => '/index.html',
			'status' => 302,
		);
	}

	return false;
}

function playground_maybe_set_environment( $requested_path ) {
	if ( ! str_ends_with( $requested_path, '.php' ) ) {
		return false;
	}

	if ( str_ends_with( $requested_path, 'logger.php' ) ) {
		// TODO: Remove this condition when we can confirm __atomic_env_define() is again always defined
		if ( function_exists( '__atomic_env_define' ) ) {
			// WORKAROUND: Atomic_Persistent_Data wants the DB_PASSWORD constant
			// which is not set yet. But we can force its definition.
			__atomic_env_define( 'DB_PASSWORD' );

			$secrets = new Atomic_Persistent_Data;
			if ( isset(
				$secrets->LOGGER_SLACK_CHANNEL,
				$secrets->LOGGER_SLACK_TOKEN,
			) ) {
				putenv( "SLACK_CHANNEL={$secrets->LOGGER_SLACK_CHANNEL}" );
				putenv( "SLACK_TOKEN={$secrets->LOGGER_SLACK_TOKEN}" );
			} else {
				error_log( 'PLAYGROUND: Missing secrets for logger.php' );
			}
		} else {
			error_log( 'PLAYGROUND: Unable to access secrets for logger.php' );
		}

		return true;
	}

	if (str_ends_with($requested_path, 'puzzle.php')) {
		// TODO: Remove this condition when we can confirm __atomic_env_define() is again always defined
		if (function_exists('__atomic_env_define')) {
			// WORKAROUND: Atomic_Persistent_Data wants the DB_PASSWORD constant
			// which is not set yet. But we can force its definition.
			__atomic_env_define('DB_PASSWORD');

			$secrets = new Atomic_Persistent_Data;
			if (isset(
				$secrets->OPEN_AI_API_KEY,
				$secrets->PUZZLE_API_KEY,
			)) {
				putenv("OPEN_AI_API_KEY={$secrets->OPEN_AI_API_KEY}");
				putenv("PUZZLE_API_KEY={$secrets->PUZZLE_API_KEY}");
			} else {
				error_log('PLAYGROUND: Missing secrets for puzzle.php');
			}
		} else {
			error_log('PLAYGROUND: Unable to access secrets for puzzle.php');
		}

		return true;
	}

	if ( str_ends_with( $requested_path, 'plugin-proxy.php' ) ) {
		// TODO: Remove this condition when we can confirm __atomic_env_define() is again always defined
		if ( function_exists( '__atomic_env_define' ) ) {
			// WORKAROUND: Atomic_Persistent_Data wants the DB_PASSWORD constant
			// which is not set yet. But we can force its definition.
			__atomic_env_define( 'DB_PASSWORD' );

			$secrets = new Atomic_Persistent_Data;
			if ( isset( $secrets->GITHUB_TOKEN ) ) {
				putenv( "GITHUB_TOKEN={$secrets->GITHUB_TOKEN}" );
			} else {
				error_log( 'PLAYGROUND: Missing secrets for plugin-proxy.php' );
			}
		} else {
			error_log( 'PLAYGROUND: Unable to access secrets for plugin-proxy.php' );
		}
		return true;
	}

	if ( str_ends_with( $requested_path, 'oauth.php' ) ) {
		// TODO: Remove this condition when we can confirm __atomic_env_define() is again always defined
		if ( function_exists( '__atomic_env_define' ) ) {
			// WORKAROUND: Atomic_Persistent_Data wants the DB_PASSWORD constant
			// which is not set yet. But we can force its definition.
			__atomic_env_define( 'DB_PASSWORD' );

			$secrets = new Atomic_Persistent_Data;
			if ( isset(
				$secrets->GITHUB_APP_CLIENT_ID,
				$secrets->GITHUB_APP_CLIENT_SECRET,
			) ) {
				putenv( "CLIENT_ID={$secrets->GITHUB_APP_CLIENT_ID}" );
				putenv( "CLIENT_SECRET={$secrets->GITHUB_APP_CLIENT_SECRET}" );
			} else {
				error_log( 'PLAYGROUND: Missing secrets for oauth.php' );
			}
		} else {
			error_log( 'PLAYGROUND: Unable to access secrets for oauth.php' );
		}
		return true;
	}


	return false;
}

function playground_get_custom_response_headers( $requested_path ) {
	$filename = basename( $requested_path );

	if ( 'iframe-worker.html' === $filename ) {
		return array( 'Origin-Agent-Cluster: ?1' );
	} elseif ( str_ends_with( $filename, 'store.zip' ) ) {
		// Disable compression so zip file can be read piece by piece
		// using file offsets embedded in the zip's metadata.
		return array(
			'Content-Encoding: identity',
			'Access-Control-Allow-Origin: *',
		);
	} elseif (
		'/' === $requested_path ||
		'/index.html' === $requested_path
	) {
		return array( 'Cache-Control: max-age=0, no-cache, no-store, must-revalidate' );
	} elseif (
		in_array(
			$filename,
			array(
				'index.js',
				'blueprint-schema.json',
				'logger.php',
				'oauth.php',
				'wp-cli.phar',
				'wordpress-importer.zip',
			),
			true
		)
	) {
		return array(
			'Access-Control-Allow-Origin: *',
			'Cache-Control: max-age=0, no-cache, no-store, must-revalidate',
		);
	}

	return false;
}

function playground_resolve_to_index_file( $real_path ) {
	if ( file_exists( "$real_path/index.php" ) ) {
		return "$real_path/index.php";
	} elseif ( file_exists( "$real_path/index.html" ) ) {
		return "$real_path/index.html";
	} else {
		return false;
	}
}
