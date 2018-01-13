var typescript = require('rollup-plugin-typescript');

module.exports = {
  input: './src/index.ts',
  output: {
    file: 'index.js',
    format: 'cjs',
  },
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