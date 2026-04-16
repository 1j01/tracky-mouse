
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

		if (handle.name === "poses") {
			console.warn(
				"You selected the 'poses' folder. Please select its parent folder instead."
			);
		}

		// Request read/write permission proactively but don't require it
		await handle.requestPermission({ mode: "readwrite" });

		this.rootHandle = handle;
		await idbSet(KEY, handle);
	}

	/**
	 * @param {{
	 * 	signal?: AbortSignal,
	 * 	onProgress?: (progress: {
	 * 		phase: "scanning" | "reading",
	 * 		entriesScanned: number,
	 * 		loaded: number,
	 * 		total: number,
	 * 	}) => void,
	 * }} [options]
	 */
	async load(options = {}) {
		const { signal, onProgress } = options;
		if (!this.rootHandle) {
			throw new Error("Folder not selected");
		}
		this.checkAbort(signal);

		const posesDir = await this.rootHandle.getDirectoryHandle("poses");
		const data = {};
		/** @type {Array<{poseId: string, pitch: string, yaw: string, fileName: string, fileHandle: FileSystemFileHandle}>} */
		const fileEntries = [];
		let entriesScanned = 0;
		onProgress?.({ phase: "scanning", entriesScanned, loaded: 0, total: 0 });

		for await (const [poseId, poseHandle] of posesDir.entries()) {
			this.checkAbort(signal);
			entriesScanned += 1;
			onProgress?.({ phase: "scanning", entriesScanned, loaded: 0, total: 0 });
			if (poseHandle.kind !== "directory") continue;

			for await (const [pitch, pitchHandle] of poseHandle.entries()) {
				this.checkAbort(signal);
				entriesScanned += 1;
				onProgress?.({ phase: "scanning", entriesScanned, loaded: 0, total: 0 });
				if (pitchHandle.kind !== "directory") continue;

				for await (const [yaw, yawHandle] of pitchHandle.entries()) {
					this.checkAbort(signal);
					entriesScanned += 1;
					onProgress?.({ phase: "scanning", entriesScanned, loaded: 0, total: 0 });
					if (yawHandle.kind !== "directory") continue;

					for await (const [fileName, fileHandle] of yawHandle.entries()) {
						this.checkAbort(signal);
						entriesScanned += 1;
						onProgress?.({ phase: "scanning", entriesScanned, loaded: 0, total: 0 });
						if (fileHandle.kind !== "file") continue;
						fileEntries.push({ poseId, pitch, yaw, fileName, fileHandle });
					}
				}
			}
		}

		const total = fileEntries.length;
		let loaded = 0;
		onProgress?.({ phase: "reading", entriesScanned, loaded, total });

		for (const { poseId, pitch, yaw, fileName, fileHandle } of fileEntries) {
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
			onProgress?.({ phase: "reading", entriesScanned, loaded, total });
		}

		return data;
	}

	async save(poseId, pitch, yaw, n, imageBlob) {
		if (!this.rootHandle) {
			throw new Error("Folder not selected");
		}

		const posesDir = await this.rootHandle.getDirectoryHandle("poses", { create: true });
		const poseDir = await posesDir.getDirectoryHandle(poseId, { create: true });
		const pitchDir = await poseDir.getDirectoryHandle(String(pitch), { create: true });
		const yawDir = await pitchDir.getDirectoryHandle(String(yaw), { create: true });

		const fileHandle = await yawDir.getFileHandle(`${n}.png`, { create: true });

		const writable = await fileHandle.createWritable();
		await writable.write(imageBlob);
		await writable.close();
	}
}