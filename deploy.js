const fs = require('fs/promises');
const path = require('path');
const gh_pages = require('gh-pages');

// AI-generated code imitating cp -rL
async function copyRecursive(src, dest) {
	try {
		const stats = await fs.lstat(src);

		if (stats.isDirectory()) {
			// Make sure the destination directory exists
			try {
				await fs.mkdir(dest, { recursive: true });
			} catch (err) {
				if (err.code !== 'EEXIST') throw err; // Ignore 'directory already exists' error
			}

			// Read all the files in the directory
			const files = await fs.readdir(src);
			for (let file of files) {
				const srcPath = path.join(src, file);
				const destPath = path.join(dest, file);
				await copyRecursive(srcPath, destPath);
			}
		} else if (stats.isSymbolicLink()) {
			// If it's a symlink, read the link and resolve it
			const link = await fs.readlink(src);
			const resolvedLink = path.resolve(path.dirname(src), link);
			await copyRecursive(resolvedLink, dest);
		} else {
			// If it's a file, copy it
			await fs.copyFile(src, dest);
		}
	} catch (err) {
		console.error(`Error copying from ${src} to ${dest}: ${err.message}`);
	}
}


// Copy files from this folder to the dist folder
const EXCLUDE = [
	'deploy.js',
	'package.json',
];
const DIST = '../dist';
// fs.mkdirSync(DIST, { recursive: true });
// fs.readdirSync(__dirname).forEach(file => {
// 	if (!EXCLUDE.includes(file)) {
// 		// For symlinks, copy the content of the directory or file it points to
// 		if (fs.lstatSync(file).isSymbolicLink()) {
// 			const target = fs.readlinkSync(file);
// 			if (fs.lstatSync(target).isDirectory()) {
// 				fs.mkdirSync(`${DIST}/${file}`, { recursive: true });
// 				fs.readdirSync(target).forEach(subfile => {
// 					fs.copyFileSync(`${target}/${subfile}`, `${DIST}/${file}/${subfile}`);
// 				});
// 			} else {
// 				fs.copyFileSync(target, `${DIST}/${file}`);
// 			}
// 		}
// 	}
// });
await copyRecursive(__dirname, DIST);

// gh_pages.publish('dist', function (err) {
// 	if (err) {
// 		console.log('Error deploying to gh-pages', err);
// 	} else {
// 		console.log('Deployed to gh-pages');
// 	}
// });
