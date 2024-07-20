import type { PlaygroundClient } from '@wp-playground/client';

import css from './style.module.css';
import Button from '../button';
import { FormEvent, useEffect, useRef, useState } from 'react';
import Modal, { defaultStyles } from '../modal';
import { playgroundAvailableInOpfs } from './playground-available-in-opfs';
import { PlaygroundConfiguration, PlaygroundConfigurationForm } from './form';
import { reloadWithNewConfiguration } from './reload-with-new-configuration';
import {
	getIndexedDB,
	loadDirectoryHandle,
	saveDirectoryHandle,
} from './idb-opfs';
import { OPFSButton } from './opfs-button';
import { SyncLocalFilesButton } from './sync-local-files-button';
import { logger } from '@php-wasm/logger';
import { usePlaygroundContext } from '../../playground-context';

interface SiteSetupGroupProps {
	initialConfiguration: PlaygroundConfiguration;
}

let idb: IDBDatabase | null,
	lastDirectoryHandle: FileSystemDirectoryHandle | null;
try {
	idb = await getIndexedDB();
	lastDirectoryHandle = await loadDirectoryHandle(idb);
} catch (e) {
	// Ignore errors.
}

export default function PlaygroundConfigurationGroup({
	initialConfiguration,
}: SiteSetupGroupProps) {
	const [isOpen, setOpen] = useState(false);
	const openModal = () => setOpen(true);
	const closeModal = () => setOpen(false);
	const playgroundRef = useRef<{
		promise: Promise<PlaygroundClient>;
		resolve: any;
		isResolved: boolean;
	}>();
	const { playground } = usePlaygroundContext();
	useEffect(() => {
		if (!playgroundRef.current) {
			let resolve;
			const promise = new Promise<PlaygroundClient>((_resolve) => {
				resolve = _resolve;
			});
			playgroundRef.current = {
				promise,
				resolve,
				isResolved: false,
			};
		}
		if (playground) {
			playgroundRef.current!.resolve(playground);
			playgroundRef.current!.isResolved = true;
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [!!playground]);

	const [wpVersionChoices, setWPVersionChoices] = useState<
		Record<string, string>
	>({});

	useEffect(() => {
		playground?.getSupportedWordPressVersions().then(({ all, latest }) => {
			const formOptions: Record<string, string> = {};
			for (const version of Object.keys(all)) {
				if (version === 'beta') {
					// Don't show beta versions related to supported major releases
					if (!(all.beta.substring(0, 3) in all)) {
						formOptions[version] = all.beta;
					}
				} else {
					formOptions[version] = version;
				}
			}
			setWPVersionChoices(formOptions);
			if (currentConfiguration.wp === 'latest') {
				setCurrentConfiguration({
					...currentConfiguration,
					wp: latest,
				});
			}
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [!!playground]);

	const [isResumeLastDirOpen, setResumeLastDirOpen] = useState(
		initialConfiguration.storage === 'device' && !!lastDirectoryHandle
	);
	const closeResumeLastDirModal = () => setResumeLastDirOpen(false);

	const [dirName, setDirName] = useState<string | undefined>(
		lastDirectoryHandle?.name
	);
	const [mounting, setMounting] = useState(false);
	const [mountProgress, setMountProgress] = useState<any | null>(null);

	const [currentConfiguration, setCurrentConfiguration] =
		useState(initialConfiguration);

	const isSameOriginAsPlayground = useIsSameOriginAsPlayground(playground);

	async function handleSelectLocalDirectory() {
		let dirHandle: FileSystemDirectoryHandle;
		try {
			// Request permission to access the directory.
			// https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker
			dirHandle = await (window as any).showDirectoryPicker({
				// By specifying an ID, the browser can remember different directories for
				// different IDs.If the same ID is used for another picker, the picker opens
				// in the same directory.
				id: 'playground-directory',
				mode: 'readwrite',
			});
		} catch (e) {
			// No directory selected but log the error just in case.
			logger.error(e);
			return;
		}
		setDirName(dirHandle.name);
		await handleMountLocalDirectory(dirHandle);
		closeModal();
	}

	async function handleResumeLastDir(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const perm = await (lastDirectoryHandle as any).requestPermission({
			mode: 'readwrite',
		});
		if (perm === 'granted') {
			await handleMountLocalDirectory(lastDirectoryHandle!);
		} else {
			alert('Switching to temporary site mode.');
		}
		closeResumeLastDirModal();
	}

	async function handleMountLocalDirectory(
		dirHandle: FileSystemDirectoryHandle
	) {
		const playground = await playgroundRef.current!.promise;
		if (idb) {
			await saveDirectoryHandle(idb, dirHandle);
		}

		setMounting(true);
		try {
			const isPlaygroundDir = await playgroundAvailableInOpfs(dirHandle);
			if (!isPlaygroundDir) {
				// Check if it's an empty directory.
				for await (const _ of (dirHandle as any).values()) {
					if (_.name.startsWith('.')) continue;
					alert(
						'You need to select either an empty directory or a pre-existing Playground directory.'
					);
					return;
				}
			}

			await playground.bindOpfs(
				{
					opfs: dirHandle,
					mountpoint: '/wordpress',
					initialSyncDirection: isPlaygroundDir
						? 'opfs-to-memfs'
						: 'memfs-to-opfs',
				},
				(progress) => {
					setMountProgress(progress);
				}
			);

			setCurrentConfiguration({
				...currentConfiguration,
				storage: 'device',
			});
			await playground.goTo('/');

			// Read current querystring and replace storage=browser with storage=device.
			const url = new URL(window.location.href);
			url.searchParams.set('storage', 'device');
			window.history.pushState({}, '', url.toString());

			alert('You are now using WordPress from your local directory.');
		} finally {
			setMounting(false);
		}
	}

	async function handleSubmit(config: PlaygroundConfiguration) {
		const hasPlayground = playgroundRef.current?.isResolved;
		const playground = hasPlayground
			? await playgroundRef.current!.promise
			: undefined;
		if (hasPlayground && config.resetSite && config.storage === 'browser') {
			if (
				!window.confirm(
					'This will wipe out all stored data and start a new site. Do you want to proceed?'
				)
			) {
				return;
			}
		}

		reloadWithNewConfiguration(config, playground);
	}
	let WPLabel =
		wpVersionChoices[currentConfiguration.wp] || currentConfiguration.wp;
	if (WPLabel.length > 15) {
		WPLabel = WPLabel.split('/').pop()!;
		if (WPLabel.length > 15) {
			WPLabel = '...' + WPLabel.slice(0, 15);
		}
	}

	return (
		<>
			<Button
				onClick={openModal}
				variant="browser-chrome"
				id="configurator"
			>
				PHP {currentConfiguration.php} {' - '}
				WP {WPLabel} {' - '}
				{currentConfiguration.storage === 'device'
					? `Storage: Device (${dirName})`
					: currentConfiguration.storage === 'browser'
					? 'Storage: Browser'
					: '⚠️ Storage: None'}
			</Button>
			{currentConfiguration.storage === 'device' ? (
				<SyncLocalFilesButton />
			) : null}
			{isResumeLastDirOpen ? (
				<Modal
					isOpen={isResumeLastDirOpen}
					onRequestClose={closeResumeLastDirModal}
					style={{
						...defaultStyles,
						content: {
							...defaultStyles.content,
							width: 550,
						},
					}}
				>
					<h2 style={{ textAlign: 'center', marginTop: 0 }}>
						Resume working in local directory?
					</h2>
					<p>
						It seems like you were working a local directory called{' '}
						<b>"{lastDirectoryHandle!.name}"</b> during your last
						visit. Would you like to resume working in this
						directory or start fresh?
					</p>
					<form
						onSubmit={handleResumeLastDir}
						className={css.buttonsWrapper}
					>
						<Button
							size="large"
							onClick={() => {
								reloadWithNewConfiguration(
									{
										...initialConfiguration,
										storage: 'none',
									},
									playground
								);
							}}
						>
							Start a fresh site
						</Button>
						<OPFSButton
							isMounting={mounting}
							mountProgress={mountProgress}
							type="submit"
							variant="primary"
							size="large"
							autoFocus
						>
							Resume working in "{lastDirectoryHandle!.name}"
						</OPFSButton>
					</form>
				</Modal>
			) : null}
			<Modal
				isOpen={isOpen}
				onRequestClose={closeModal}
				style={{
					...defaultStyles,
					content: {
						...defaultStyles.content,
						width: 550,
					},
				}}
			>
				<PlaygroundConfigurationForm
					supportedWPVersions={wpVersionChoices}
					currentlyRunningWordPressVersion={currentConfiguration.wp}
					initialData={currentConfiguration}
					onSubmit={handleSubmit}
					isMountingLocalDirectory={mounting}
					mountProgress={mountProgress}
					onSelectLocalDirectory={
						(window as any).showDirectoryPicker
							? isSameOriginAsPlayground
								? handleSelectLocalDirectory
								: 'origin-mismatch'
							: 'not-available'
					}
				/>
			</Modal>
		</>
	);
}

function useIsSameOriginAsPlayground(playground?: PlaygroundClient) {
	const [isSameOriginAsPlayground, setIsSameOriginAsPlayground] = useState<
		null | boolean
	>(null);

	useEffect(() => {
		if (!playground) return;
		(async () => {
			setIsSameOriginAsPlayground(
				new URL(await playground.absoluteUrl).origin ===
					window.location.origin
			);
		})();
	}, [playground]);

	return isSameOriginAsPlayground;
}
