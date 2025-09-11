/*!
 * Copyright (c) 2019-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {config} from '@bedrock/core';
import {createRequire} from 'node:module';
import path from 'node:path';
import webpack from 'webpack';
import '@bedrock/karma';
const require = createRequire(import.meta.url);

config.karma.suites['bedrock-web-vc-store'] = path.join('web', '**', '*.js');

// disable babel preprocessing during karma tests to avoid
// errors with dated bedrock-karma and features like spread operator
config.karma.defaults.DEFAULT_PREPROCESSORS = ['webpack'];

// polyfills
// route-params > pathname-match > assert > util > process
config.karma.config.webpack.plugins.push(
  new webpack.ProvidePlugin({
    process: 'process'
  }));

config.karma.config.webpack.resolve.fallback.process =
  require.resolve('process/');
