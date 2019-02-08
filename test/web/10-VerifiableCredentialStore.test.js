/*!
 * Copyright (c) 2019 Digital Bazaar, Inc. All rights reserved.
 */
import VerifiableCredentialStore from 'bedrock-web-vc-store';

import {store, MemoryEngine} from 'bedrock-web-store';
import {getRemoteStorage} from 'bedrock-web-data-hub';
import {mock} from './mock.js';

const password = 'password';

let vcStore;

describe('VerifiableCredentialStore', () => {
  before(async () => {
    store.setEngine({engine: new MemoryEngine()});
    mock.init();
    const remoteStorage = await getRemoteStorage({accountId: 'test'});
    await remoteStorage.createMasterKey({password});

    vcStore = new VerifiableCredentialStore({remoteStorage});
  });

  it('should insert a credential', async () => {
    const credential = {id: 'foo', someKey: 'someValue'};
    await vcStore.insert({credential});
  });

  it('should get a credential', async () => {
    const expected = {id: 'foo', someKey: 'someValue'};
    const vc = await vcStore.get({id: expected.id});
    vc.should.deep.equal(expected);
  });

  it('should delete an existing credential', async () => {
    const result = await vcStore.delete({id: 'foo'});
    result.should.equal(true);
  });

  it('should fail to get a deleted credential', async () => {
    let err;
    try {
      await vcStore.get({id: 'foo'});
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.name.should.equal('NotFoundError');
  });

  it('should fail to delete a non-existent credential', async () => {
    const result = await vcStore.delete({id: 'foo'});
    result.should.equal(false);
  });
});
