const path = require('path');

module.exports = {
  mode: 'none',
  target: 'node',
  entry: {
    extension: './src/extension.ts'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  node: {
    __dirname: false
  },
  module: {
    rules: [{
      test: /\.ts$/,
      exclude: /node_modules/,
      use: [{
        loader: 'ts-loader',
        options: {
          compilerOptions: {
            'sourceMap': true,
            'declaration': false
          }
        }
      }]
    }]
  },
  externals: {
    vscode: "commonjs vscode"
  },
  output: {
    filename: 'extension.js',
    path: path.resolve(__dirname, './dist'),
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: "./../[resource-path]"
  },
  devtool: 'source-map'
}
