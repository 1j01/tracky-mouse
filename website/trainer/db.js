
const DB_NAME = "trainer-db";
const STORE_NAME = "handles";
const KEY = "root";

function openDB() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);

		req.onupgradeneeded = () => {
			req.result.createObjectStore(STORE_NAME);
		};

		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function idbSet(key, value) {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, "readwrite");
		tx.objectStore(STORE_NAME).put(value, key);
		tx.oncomplete = resolve;
		tx.onerror = () => reject(tx.error);
	});
}

async function idbGet(key) {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, "readonly");
		const req = tx.objectStore(STORE_NAME).get(key);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

export class TrainerDB {
	constructor() {
		this.rootHandle = null;
	}

	checkAbort(signal) {
		if (signal?.aborted) {
			throw new DOMException("Loading canceled", "AbortError");
		}
	}

	async init() {
		const handle = await idbGet(KEY);
		if (!handle) return false;

		const hasPermission = await handle.queryPermission({ mode: "readwrite" }) === "granted";
		if (!hasPermission) return false;

		this.rootHandle = handle;
		return true;
	}

	async selectFolder() {
		const handle = await window.showDirectoryPicker();
		await idbSet(KEY, handle);
		this.rootHandle = handle;
	}

	async ensureWritePermission() {
		if (!this.rootHandle) {
			throw new Error("Folder not selected");
		}

		const hasPermission = await this.rootHandle.queryPermission({ mode: "readwrite" }) === "granted";
		if (hasPermission) return true;

		return await this.rootHandle.requestPermission({ mode: "readwrite" }) === "granted";
	}

	/**
	 * @param {{signal?: AbortSignal, onProgress?: (progress: { loaded: number, total: number }) => void}} [options]
	 */
	async load(options = {}) {
		const { signal, onProgress } = options;
		if (!this.rootHandle) {
			throw new Error("Folder not selected");
		}
		this.checkAbort(signal);

		let scannedFolders = 0;
		let scannedFiles = 0;
		const posesDir = await this.rootHandle.getDirectoryHandle("poses");
		const data = {};
		/** @type {Array<{poseId: string, pitch: string, yaw: string, fileName: string, fileHandle: FileSystemFileHandle}>} */
		const fileEntries = [];

		async function collect(asyncIterable) {
			const results = [];
			for await (const item of asyncIterable) {
				results.push(item);
			}
			return results;
		}

		async function walkDirectory(handle, pathParts = []) {
			this.checkAbort(signal);

			const entries = await collect(handle.entries());

			await Promise.all(entries.map(async ([name, entryHandle]) => {
				this.checkAbort(signal);

				if (entryHandle.kind === "directory") {
					scannedFolders += 1;
					onProgress?.({ scannedFiles, scannedFolders, loaded: 0, total: 0 });

					await walkDirectory.call(this, entryHandle, [...pathParts, name]);
				} else if (entryHandle.kind === "file") {
					if (!name.toLowerCase().endsWith(".png")) {
						return;
					}
					scannedFiles += 1;
					onProgress?.({ scannedFiles, scannedFolders, loaded: 0, total: 0 });

					const [poseId, pitch, yaw] = pathParts;
					if (!poseId || !pitch || !yaw) {
						console.warn(`Skipping file with unexpected path structure: ${[...pathParts, name].join("/")}`);
						return;
					}
					if (isNaN(pitch) || isNaN(yaw)) {
						console.warn(`Skipping file with non-numeric pitch or yaw path component: ${[...pathParts, name].join("/")}`);
						return;
					}
					if (isNaN(parseInt(name))) {
						console.warn(`Skipping file with non-numeric name: ${[...pathParts, name].join("/")}`);
						return;
					}

					fileEntries.push({
						poseId,
						pitch,
						yaw,
						fileName: name,
						fileHandle: entryHandle
					});
				}
			}));
		}

		await walkDirectory.call(this, posesDir);

		const total = fileEntries.length;
		let loaded = 0;
		onProgress?.({ scannedFiles, scannedFolders, loaded, total });

		await Promise.all(
			fileEntries.map(async ({ poseId, pitch, yaw, fileName, fileHandle }) => {
				this.checkAbort(signal);
				data[poseId] ??= {};
				data[poseId][pitch] ??= {};
				data[poseId][pitch][yaw] ??= [];

				const file = await fileHandle.getFile();
				data[poseId][pitch][yaw].push({
					fileName,
					file
				});
				loaded += 1;
				onProgress?.({ scannedFiles, scannedFolders, loaded, total });
			})
		);

		return data;
	}

	async save(poseId, pitch, yaw, n, imageBlob, metadata) {
		if (!this.rootHandle) {
			throw new Error("Folder not selected");
		}

		const posesDir = await this.rootHandle.getDirectoryHandle("poses", { create: true });
		const poseDir = await posesDir.getDirectoryHandle(poseId, { create: true });
		const pitchDir = await poseDir.getDirectoryHandle(String(pitch), { create: true });
		const yawDir = await pitchDir.getDirectoryHandle(String(yaw), { create: true });

		const imageFileHandle = await yawDir.getFileHandle(`${n}.png`, { create: true });
		const imageWritable = await imageFileHandle.createWritable();
		await imageWritable.write(imageBlob);
		await imageWritable.close();

		if (metadata !== undefined) {
			const metadataFileHandle = await yawDir.getFileHandle(`${n}.json`, { create: true });
			const metadataWritable = await metadataFileHandle.createWritable();
			await metadataWritable.write(JSON.stringify(metadata, null, 2));
			await metadataWritable.close();
		}
	}
}
