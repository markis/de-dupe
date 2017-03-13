var typescript = require('rollup-plugin-typescript');

module.exports = {
  entry: './src/index.ts',
  dest: 'index.js',
  format: 'cjs',
  moduleId: 'de-dupe',
  moduleName: 'dedupe',
  external: [
    'chai',
    'fs',
    'path',
    'mocha',
    'typescript'
  ],
  plugins: [
    typescript({
      typescript: require('typescript')
    }),
  ]
};