/** @typedef {import('@rspack/core').Configuration} Configuration */
import ReactRefreshPlugin from '@rspack/plugin-react-refresh';

import { isDevelopment, isProduction } from './rspack.env.js';
import { optimization } from './rspack.optimization.js';
import { plugins } from './rspack.plugins.js';
import { rules } from './rspack.rules.js';
import { pathResolve } from './utils.js';

rules.push({
	test: /\.(png|jpg|jpeg|gif|svg)$/i,
	type: 'asset',
});

rules.push({
	test: /\.less$/,
	type: 'css/module',
	use: [
		{
			loader: 'less-loader',
			options: {
				sourceMap: true,
				lessOptions: {
					javascriptEnabled: true,
				},
			},
		},
	].filter(Boolean),
});

const rendererPlugins = [...plugins];

if (isDevelopment) {
	rendererPlugins.push(new ReactRefreshPlugin());
}

/** @type {Configuration} */
export const rendererConfig = {
	devtool: isProduction ? false : 'eval-cheap-module-source-map',
	module: {
		generator: {
			'css/auto': {
				exportsOnly: false,
				exportsConvention: 'as-is',
				localIdentName: isProduction ? '[hash]' : '[uniqueName]-[id]-[local]',
			},
			css: {
				exportsOnly: false,
			},
			'css/module': {
				exportsOnly: false,
				exportsConvention: 'as-is',
				localIdentName: isProduction ? '[hash]' : '[uniqueName]-[id]-[local]',
			},
		},
		parser: {
			'css/auto': {
				namedExports: false,
			},
			css: {
				namedExports: false,
			},
			'css/module': {
				namedExports: false,
			},
		},
		rules,
	},
	plugins: rendererPlugins,
	optimization: isProduction ? optimization : undefined,
	resolve: {
		extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
		tsConfig: pathResolve('tsconfig.json'),
	},
	ignoreWarnings: [/Conflicting order/],
	experiments: {
		css: true,
	},
};
