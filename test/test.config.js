/*!
 * Copyright (c) 2019-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {config} from '@bedrock/core';
import path from 'node:path';
import webpack from 'webpack';
import '@bedrock/karma';

config.karma.suites['bedrock-web-vc-store'] = path.join('web', '**', '*.js');

// disable babel preprocessing during karma tests to avoid
// errors with dated bedrock-karma and features like spread operator
config.karma.defaults.DEFAULT_PREPROCESSORS = ['webpack'];

config.karma.config.webpack.plugins.push(
  // pathname-match > assert > util > process
  new webpack.ProvidePlugin({
    process: 'process'
  }));
