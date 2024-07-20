---
sidebar_position: 1
title: Blueprint data Format
---

# Blueprint data format

A Blueprint JSON file can have many different properties that will be used to define your Playground instance. The most important properties are detailed below.

Here's an example that uses many of them:

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample blueprint={{
	"landingPage": "/wp-admin/",
	"preferredVersions": {
		"php": "7.4",
		"wp": "6.5"
	},
	"phpExtensionBundles": ["kitchen-sink"],
	"features": {
		"networking": true
	},
	"steps": [
		{
			"step": "login",
			"username": "admin",
			"password": "password"
		}
	]
}} />

## JSON schema

JSON files can be tedious to write and easy to get wrong. To help with that, Playground provides a [JSON schema](https://playground.wordpress.net/blueprint-schema.json) file that you can use to get auto-completion and validation in your editor. Just set the `$schema` property to the following:

```js
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
}
```

## Landing page

The `landingPage` property tells Playground which URL to navigate to after the Blueprint has been run. This is a great tool, especially when creating theme or plugin demos. Often, you will want to start Playground in the Site Editor or have a specific post open in the Post Editor. Make sure you use a relative path.

```js
{
	"landingPage": "/wp-admin/site-editor.php",
}
```

## Preferred versions

The `preferredVersions` property declares your preferred PHP and WordPress versions. It can contain the following properties:

-   `php` (string): Loads the specified PHP version. Accepts `7.0`, `7.1`, `7.2`, `7.3`, `7.4`, `8.0`, `8.1`, `8.2`, `8.3`, or `latest`. Minor versions like `7.4.1` are not supported.
-   `wp` (string): Loads the specified WordPress version. Accepts the last four major WordPress versions. As of June 1, 2024, that's `6.2`, `6.3`, `6.4`, or `6.5`. You can also use the generic values `latest`, `nightly`, or `beta`.

```js
{
	"preferredVersions": {
		"php": "8.0",
		"wp": "6.5"
	},
}
```

## PHP extensions

The `phpExtensionBundles` property is an array of PHP extension bundles that should be loaded. The following bundles are supported:

-   `kitchen-sink`: Default choice. Installs [`gd`](https://www.php.net/manual/en/book.image.php), [`mbstring`](https://www.php.net/manual/en/mbstring.installation.php), [`iconv`](https://www.php.net/manual/en/function.iconv.php), [`openssl`](https://www.php.net/manual/en/book.openssl.php), [`libxml`](https://www.php.net/manual/en/book.libxml.php), [`xml`](https://www.php.net/manual/en/xml.installation.php), [`dom`](https://www.php.net/manual/en/intro.dom.php), [`simplexml`](https://www.php.net/manual/en/book.simplexml.php), [`xmlreader`](https://www.php.net/manual/en/book.xmlreader.php), and [`xmlwriter`](https://www.php.net/manual/en/book.xmlwriter.php)
-   `light`: It saves 6MB of downloads and loads none of the extensions above.

```js
{
	"phpExtensionBundles": [
		"kitchen-sink"
	],
}
```

## Features

You can use the `features` property to turn on or off certain features of the Playground instance. It can contain the following properties:

-   `networking`: Defaults to `false`. Enables or disables the networking support for Playground. If enabled, [`wp_safe_remote_get`](https://developer.wordpress.org/reference/functions/wp_safe_remote_get/) and similar WordPress functions will actually use `fetch()` to make HTTP requests. If disabled, they will immediately fail instead. You will need this property enabled if you want the user to be able to install plugins or themes.

```js
{
	"features": {
		"networking": true
	},
}
```

## Steps

Arguably the most powerful property, `steps` allows you to configure the Playground instance with preinstalled themes, plugins, demo content, and more. The following example logs the user in with a dedicated username and password. It then installs and activates the Gutenberg plugin. [Learn more about steps](./05-steps.md).

```js
{
	"steps": [
		{
			"step": "login",
			"username": "admin",
			"password": "password"
		},
		{
			"step": "installPlugin",
			"pluginZipFile": {
				"resource": "wordpress.org/plugins",
				"slug": "gutenberg"
			}
		},
	]
}
```
