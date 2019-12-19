/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
import Pretender from 'pretender';
import {EdvClient} from 'edv-client';
import {MockStorage} from 'bedrock-web-mock-data-hub-storage';
import {MockKmsService} from 'bedrock-web-mock-kms-http';
//import {KmsClient} from 'webkms-client';

// FIXME: Very out of date, needs to be updated to work with
// modern `edv-client` and `webkms-client`

// TODO: add some static data to test against

export async function init({mock = {}} = {}) {
  throw new Error('FIXME: Out of date');

  const accountId = mock.accountId = 'test';

  // create mock server
  const server = mock.server = new Pretender();
  // FIXME: there is special behavior here that the Mock* classes rely on;
  // we need to clean that up
  server.prepareHeaders = function prepareHeaders(headers) {
    if(headers) {
      if(headers.json) {
        headers['content-type'] = 'application/json';
        delete headers.json;
      }
    } else {
      headers = {};
    }
    return headers;
  };
  server.prepareBody = function prepareBody(body, headers) {
    if(headers && headers['content-type'] === 'application/json') {
      return (body && typeof body !== 'string') ?
        JSON.stringify(body) : '{"message": "mock server error"}';
    }
    return body;
  };

  // mock backend for KMS
  mock.kms = new MockKmsService({server});

  // mock edv storage
  mock.edvStorage = new MockStorage({server, controller: accountId});

  // only init keys once
  if(!mock.keys) {
    // create mock keys
    mock.keys = {};

    // // account master key for using KMS
    // const secret = 'bcrypt of password';
    // const kmsService = new KmsService();
    // mock.keys.master = await AccountMasterKey.fromSecret(
    //   {secret, accountId, kmsService, kmsPlugin: 'mock'});
    //
    // // create KEK and HMAC keys for creating edvs
    // mock.keys.kek = await mock.keys.master.generateKey({type: 'kek'});
    // mock.keys.hmac = await mock.keys.master.generateKey({type: 'hmac'});
  }

  return mock;
}

export async function createEdv({mock, primary = false} = {}) {
  const controller = mock.accountId;
  const {kek, hmac} = mock.keys;
  let config = {
    sequence: 0,
    controller,
    kek: {id: kek.id, algorithm: kek.algorithm},
    hmac: {id: hmac.id, algorithm: hmac.algorithm}
  };
  if(primary) {
    config.referenceId = 'primary';
  }
  config = await EdvClient.create({config});
  return new EdvClient({config, kek, hmac});
}
