import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import importCss from 'rollup-plugin-import-css';

export default {
  input: 'src/a-menu.js',
  output: [
    // Standard ES Module (unminified)
    {
      file: 'dist/a-menu.js',
      format: 'es',
      sourcemap: false,
      inlineDynamicImports: true
    },
    // Minified ES Module
    {
      file: 'dist/a-menu.js.min.js',
      format: 'es',
      plugins: [terser({
        output: { comments: false },
        compress: {
          keep_infinity: true,
          reduce_funcs: true,
          join_vars: true
        },
        mangle: { keep_classnames: true }
      })],
      sourcemap: true,
      inlineDynamicImports: true
    }
  ],
  plugins: [
    resolve(),
    importCss({ inject: true })
  ]
};

