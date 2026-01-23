/** @typedef {import('@rspack/core').ModuleOptions} ModuleOptions */

import { isDevelopment } from './rspack.env.js';
import { appSrcPath } from './utils.js';

/** @param {'typescript' | 'ecmascript'} syntax */
const swcLoaderOptions = (syntax, sourceType = 'module') => {
	return {
		module: {
			type: 'es6',
			ignoreDynamic: true,
		},
		jsc: {
			parser:
				syntax === 'typescript'
					? {
						syntax: 'typescript',
						sourceType,
						tsx: true,
						dynamicImport: true,
						decorators: true,
					}
					: {
						syntax: 'ecmascript',
						sourceType,
						jsx: true,
						numericSeparator: true,
						classPrivateProperty: true,
						privateMethod: true,
						classProperty: true,
						functionBind: true,
						decorators: true,
						decoratorsBeforeExport: true,
						exportDefaultFrom: true,
						exportNamespaceFrom: true,
						dynamicImport: true,
						nullishCoalescing: true,
						optionalChaining: true,
						importMeta: true,
						topLevelAwait: true,
						importAssertions: true,
					},
			target: 'es5',
			// false:正常模式尽可能地遵循 ECMAScript 6 的语义 true:松散模式产生更简单的 ES5 代码
			loose: false,
			externalHelpers: true,
			transform: {
				legacyDecorator: true,
				react: {
					runtime: 'automatic',
					pragma: 'React.createElement',
					pragmaFrag: 'React.Fragment',
					throwIfNamespace: true,
					development: isDevelopment,
					useBuiltins: true,
					refresh: isDevelopment,
				},
			},
		},
	};
};

/** @type {Required<ModuleOptions>['rules']} */
export const rules = [
	// Add support for native node modules
	{
		// We're specifying native_modules in the test because the asset relocator loader generates a
		// "fake" .node file which is really a cjs file.
		test: /native_modules[/\\].+\.node$/,
		use: 'node-loader',
	},
	{
		test: /\.tsx?$/,
		loader: 'builtin:swc-loader',
		include: appSrcPath,
		options: swcLoaderOptions('typescript'),
	},
	{
		test: /.*electron-main[/\\].*\.(js|mjs|jsx)$/,
		loader: 'builtin:swc-loader',
		include: appSrcPath,
		options: swcLoaderOptions('ecmascript', 'script'),
	},
	{
		test: /\.(js|mjs|jsx)$/,
		exclude: /.*electron-main[/\\].*/,
		loader: 'builtin:swc-loader',
		include: appSrcPath,
		options: swcLoaderOptions('ecmascript'),
	},
];
