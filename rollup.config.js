import { terser } from "rollup-plugin-terser";
import postcss from 'rollup-plugin-postcss'
import pkg from './package.json';

export default {
	input: 'tracky-mouse.js',
	plugins: [
		terser(),
		postcss(),
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
