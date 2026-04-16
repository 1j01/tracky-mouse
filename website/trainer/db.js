/*
AI prompt used:
> I'm planning to use the FS Access API as a database of images, in this structure:
> `<selected folder>/poses/<pose id>/<pitch>/<yaw>/<n>.png` 
> 
> 
> Implement a storage class like so:
> 
> export class TrainerDB {
> 	selectFolder() {
> 
> 	}
> 	load() {
> 
> 	}
> 	save(poseId, pitch, yaw, n, image) {
> 
> 	}
> }
> 
> Warn if selecting `poses` folder that you should select the parent folder.

Followup:
> Persist folder access.
*/
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

		const hasPermission = await this._verifyPermission(handle);
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

		await this._verifyPermission(handle, true);

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

	async _verifyPermission(handle, write = false) {
		const opts = { mode: write ? "readwrite" : "read" };

		if ((await handle.queryPermission(opts)) === "granted") {
			return true;
		}

		if ((await handle.requestPermission(opts)) === "granted") {
			return true;
		}

		return false;
	}
}