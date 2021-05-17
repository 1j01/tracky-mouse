import { terser } from "rollup-plugin-terser";
import scss from 'rollup-plugin-scss'
import pkg from './package.json';

export default {
	input: 'tracky-mouse.js',
	plugins: [
		terser(),
		scss({
			output: 'dist/tracky-mouse.min.css',
			outputStyle: "compressed",
		}),
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
