
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

		// const hasPermission =
		await handle.requestPermission({ mode: "readwrite" }) === "granted";
		// if (!hasPermission) {
		// 	throw new Error("Permission denied");
		// }

		this.rootHandle = handle;
		await idbSet(KEY, handle);
	}

	async load() {
		if (!this.rootHandle) {
			throw new Error("Folder not selected");
		}

		const posesDir = await this.rootHandle.getDirectoryHandle("poses");
		const data = {};

		for await (const [poseId, poseHandle] of posesDir.entries()) {
			if (poseHandle.kind !== "directory") continue;

			data[poseId] = {};

			for await (const [pitch, pitchHandle] of poseHandle.entries()) {
				if (pitchHandle.kind !== "directory") continue;

				data[poseId][pitch] = {};

				for await (const [yaw, yawHandle] of pitchHandle.entries()) {
					if (yawHandle.kind !== "directory") continue;

					data[poseId][pitch][yaw] = [];

					for await (const [fileName, fileHandle] of yawHandle.entries()) {
						if (fileHandle.kind !== "file") continue;

						const file = await fileHandle.getFile();
						data[poseId][pitch][yaw].push({
							name: fileName,
							file
						});
					}
				}
			}
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