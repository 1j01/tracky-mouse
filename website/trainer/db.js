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
*/

export class TrainerDB {
	constructor() {
		this.rootHandle = null;
	}

	async selectFolder() {
		this.rootHandle = await window.showDirectoryPicker();

		// Warn if user picked "poses" instead of parent
		if (this.rootHandle.name === "poses") {
			console.warn(
				"You selected the 'poses' folder. Please select its parent folder instead."
			);
		}
	}

	async load() {
		if (!this.rootHandle) {
			throw new Error("Folder not selected");
		}

		const posesDir = await this._getOrCreateDir(this.rootHandle, "poses");

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

		const posesDir = await this._getOrCreateDir(this.rootHandle, "poses");
		const poseDir = await this._getOrCreateDir(posesDir, poseId);
		const pitchDir = await this._getOrCreateDir(poseDir, String(pitch));
		const yawDir = await this._getOrCreateDir(pitchDir, String(yaw));

		const fileName = `${n}.png`;
		const fileHandle = await yawDir.getFileHandle(fileName, { create: true });

		const writable = await fileHandle.createWritable();
		await writable.write(imageBlob);
		await writable.close();
	}

	async _getOrCreateDir(parent, name) {
		return await parent.getDirectoryHandle(name, { create: true });
	}
}