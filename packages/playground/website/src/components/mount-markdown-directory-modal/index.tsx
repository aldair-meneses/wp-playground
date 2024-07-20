import Modal from '../modal';
import { Button } from '@wordpress/components';
import { useDispatch } from 'react-redux';
import { PlaygroundDispatch, setActiveModal } from '../../lib/redux-store';
import { directoryHandleResolve } from '../../lib/markdown-directory-handle';
import { logger } from '@php-wasm/logger';

export const localStorageKey = 'playground-start-error-dont-show-again';

export function MountMarkdownDirectoryModal() {
	const dispatch: PlaygroundDispatch = useDispatch();

	const handleDirectorySelection = (
		newDirectoryHandle: FileSystemDirectoryHandle
	) => {
		directoryHandleResolve(newDirectoryHandle);
	};

	async function loadMarkdownDirectory(e: React.MouseEvent) {
		e.preventDefault();
		let dirHandle;
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
		handleDirectorySelection(dirHandle);
		handleClose();
	}

	function handleClose() {
		dispatch(setActiveModal(null));
	}

	return (
		<Modal isOpen={true} onRequestClose={handleClose}>
			<header>
				<h2>Markdown editor</h2>
			</header>

			<main>
				{/* @TODO Don't do a wall of text. Do good UX instead. */}
				<p>
					This is an online markdown editor. Load your Markdown files
					from the disk in one of the following ways:
				</p>
				<ul>
					<li>Use the directory picker below</li>
					<li>
						Use the file picker below
						{/* @TODO could make both the same */}
					</li>
					<li>
						Drag & drop files from the disk
						{/* @TODO If we do that, it won't work after closing this modal */}
					</li>
				</ul>
				<p>
					... or close this modal and paste the content of the file
					into the post editor.
				</p>
				<footer>
					<Button variant="primary" onClick={loadMarkdownDirectory}>
						Load a Markdown directory
					</Button>
					<Button onClick={handleClose}>Cancel</Button>
				</footer>
			</main>
		</Modal>
	);
}
