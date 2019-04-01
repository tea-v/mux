/* eslint-disable @typescript-eslint/no-var-requires */

const dotenv = require('dotenv').config();
const path = require('path');
const serverlessWebpack = require('serverless-webpack');
const webpack = require('webpack');
const webpackNodeExternals = require('webpack-node-externals');

if (dotenv.error) {
  throw dotenv.error;
}

module.exports = {
  entry: serverlessWebpack.lib.entries,
  externals: [webpackNodeExternals()],
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.(js|ts)$/,
        loader: 'babel-loader',
        options: {
          presets: [
            ['@babel/typescript'],
            ['env', { targets: { node: '8.10' } }],
          ],
        },
      },
    ],
  },
  output: {
    filename: '[name].js',
    libraryTarget: 'commonjs',
    path: path.join(__dirname, '.webpack'),
  },
  plugins: [
    new webpack.DefinePlugin({
      MOVIES_BUCKET_NAME: JSON.stringify(process.env.MOVIES_BUCKET_NAME),
      USER_POOL_PUBLIC_KEYS: process.env.USER_POOL_PUBLIC_KEYS,
      USER_POOL_URL: JSON.stringify(process.env.USER_POOL_URL),
    }),
  ],
  resolve: {
    alias: {
      ':clients': path.resolve(__dirname, './clients'),
      ':functions': path.resolve(__dirname, './functions'),
      ':types': path.resolve(__dirname, './types'),
    },
    extensions: ['.js', '.ts'],
  },
  stats: 'minimal',
  target: 'node',
};
