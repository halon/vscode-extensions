const path = require('path');
// eslint-disable-next-line @typescript-eslint/naming-convention
const CopyPlugin = require("copy-webpack-plugin");

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
    // eslint-disable-next-line @typescript-eslint/naming-convention
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
  devtool: 'source-map',
  plugins: [
    new CopyPlugin({
      patterns: [
        { context: 'node_modules/@halon', from: 'json-schemas/**/*.schema.json' }
      ],
    }),
  ]
};
