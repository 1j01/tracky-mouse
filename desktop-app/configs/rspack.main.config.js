/**
 * @typedef {import('@rspack/core').Configuration} Configuration
 */

import { isProduction } from './rspack.env.js';
import { plugins } from './rspack.plugins.js';
import { rules } from './rspack.rules.js';
import { pathResolve } from './utils.js';

/** @type {Configuration} */
export const mainConfig = {
	/**
	 * This is the main entry point for your application, it's the first file
	 * that runs in the main process.
	 */
	entry: './src/electron-main/electron-main.js',
	// Put your normal webpack config below here
	module: {
		rules,
	},
	plugins,
	resolve: {
		tsConfig: pathResolve('tsconfig.json'),
	},
	devtool: isProduction ? false : 'eval-cheap-module-source-map',
};
