/**
 * @typedef {import('@rspack/core').Configuration} Configuration
 */

import { isProduction } from './rspack.env';
import { plugins } from './rspack.plugins';
import { rules } from './rspack.rules';
import { pathResolve } from './utils';

/** @type {Configuration} */
export const mainConfig = {
	/**
	 * This is the main entry point for your application, it's the first file
	 * that runs in the main process.
	 */
	entry: './electron-main/electron-main.js',
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
