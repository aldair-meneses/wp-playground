import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
const importStartPlaygroundWeb = import(
	// @ts-ignore-next-line
	'https://playground.wordpress.net/client/index.js'
);
const startPlaygroundWeb = (await importStartPlaygroundWeb).startPlaygroundWeb;
import './Site.scss';

const currentBlueprint = () => {
	if (!window.location.hash) {
		return null;
	}
	try {
		return JSON.parse(decodeURI(window.location.hash.slice(1)));
	} catch (error) {
		return null;
	}
};

export const Site = () => {
	const navigate = useNavigate();
	const iframe = useRef<HTMLIFrameElement>(null);
	const blueprint = currentBlueprint();
	const isPlaygroundRunning = useRef<boolean>(false);

	useEffect(() => {
		if (!blueprint) {
			navigate('/puzzle/scan');
			return;
		}
		if (!iframe.current) {
			return;
		}
		if (isPlaygroundRunning.current) {
			return;
		}

		const loadPlayground = async () => {
			const client = await startPlaygroundWeb({
				iframe: iframe.current!,
				remoteUrl: `https://playground.wordpress.net/remote.html`,
				blueprint,
			});
			await client.isReady();
		};

		isPlaygroundRunning.current = true;
		loadPlayground();
	}, [blueprint, navigate, iframe]);

	return (
		<div className="view view--site">
			<iframe
				id="wp"
				ref={iframe}
				className="site__iframe"
				title="WordPress Playground"
			/>
		</div>
	);
};
