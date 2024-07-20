---
title: Concepts
---

# Playground APIs Concepts

WordPress Playground in the browser is all about links and iframes. Regardless of which API you choose, you will use it in one of the following ways:

## Link to the Playground site

You can customize WordPress Playground by modifying the https://playground.wordpress.net/ link. You can, for example, create a post, request a specific plugin, or run any PHP code.

To prepare such a link, use either the [Query API](../08-query-api/01-index.md) (easy) or the [JSON Blueprints API](../09-blueprints-api/01-index.md) (medium).

Once it's ready, simply post it on your site. It makes a great "Try it yourself" button in a tutorial, for example.

### Embed in an `<iframe>`

WordPress Playground can be embedded in your app using an `<iframe>`:

```html
<iframe src="https://playground.wordpress.net/"></iframe>
```

To customize that Playground instance, you can:

-   Load it from special link prepared using the [Query API](../08-query-api/01-index.md) (easy) or the [JSON Blueprints API](../09-blueprints-api/01-index.md) (medium).
-   Control it using the [JavaScript API](../10-javascript-api/01-index.md).

The JavaScript API gives you the most control, but it is also the least convenient option as it requires loading the Playground Client library.

import PlaygroundWpNetWarning from '@site/docs/\_fragments/\_playground_wp_net_may_stop_working.md';

<PlaygroundWpNetWarning />

## Browser APIs

The following Playground APIs are available in the browser:

import APIList from '@site/docs/\_fragments/\_api_list.mdx';

<APIList />

## In Node.js

The following Playground APIs are available in Node.js:

-   [JSON Blueprints API](../09-blueprints-api/01-index.md)
-   [JavaScript API](../10-javascript-api/01-index.md)

These APIs are very similar to their web counterparts, but, unsurprisingly, they are not based or links or iframes.
