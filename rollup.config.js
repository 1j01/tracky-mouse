import { terser } from "rollup-plugin-terser";
import commonjs from '@rollup/plugin-commonjs';
import webWorkerLoader from 'rollup-plugin-web-worker-loader';
import postcss from 'rollup-plugin-postcss'
import pkg from './package.json';

export default {
	input: 'tracky-mouse.js',
	plugins: [
		// terser(),
		postcss(),
		commonjs(),
		webWorkerLoader(),
	],
	output: [
		{
			name: 'tracky-mouse',
			file: pkg.browser,
			format: 'umd',
		},
		{
			file: pkg.module,
			format: 'es',
		},
	],
};
