import fs from 'fs';
import path from 'path';

const appDirectory = fs.realpathSync(process.cwd());

/**
 * @param {string} relativePath 
 * @returns {string}
 */
export const pathResolve = (relativePath) => {
	return path.resolve(appDirectory, relativePath);
};

export const appSrcPath = pathResolve('./src');
