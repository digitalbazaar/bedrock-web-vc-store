/*!
 * Copyright (c) 2019 Digital Bazaar, Inc. All rights reserved.
 */
import VerifiableCredentialStore from 'bedrock-web-vc-store';

import {init, createDataHub} from './mock.js';

let mock, vcStore;

describe('VerifiableCredentialStore', () => {
  before(async () => {
    mock = await init();
    const hub = await createDataHub({mock});
    vcStore = new VerifiableCredentialStore({hub});
  });

  after(async () => {
    mock.server.shutdown();
  });

  it('should insert a credential', async () => {
    const credential = {id: 'foo', content: {someKey: 'someValue'}};
    await vcStore.insert({credential});
  });

  it('should get a credential', async () => {
    const expected = {id: 'foo', content: {someKey: 'someValue'}};
    const decrypted = await vcStore.get({id: expected.id});
    const dataHub = vcStore.hub;

    decrypted.should.be.an('object');
    decrypted.id.should.equal('foo');
    decrypted.sequence.should.equal(0);
    decrypted.indexed.should.be.an('array');
    decrypted.indexed.length.should.equal(1);
    decrypted.indexed[0].should.be.an('object');
    decrypted.indexed[0].sequence.should.equal(0);
    decrypted.indexed[0].hmac.should.be.an('object');
    decrypted.indexed[0].hmac.should.deep.equal({
      id: dataHub.indexHelper.hmac.id,
      algorithm: dataHub.indexHelper.hmac.algorithm
    });
    decrypted.indexed[0].attributes.should.be.an('array');
    decrypted.jwe.should.be.an('object');
    decrypted.jwe.protected.should.be.a('string');
    decrypted.jwe.recipients.should.be.an('array');
    decrypted.jwe.recipients.length.should.equal(1);
    decrypted.jwe.recipients[0].should.be.an('object');
    decrypted.jwe.recipients[0].header.should.deep.equal({
      kid: dataHub.kek.id,
      alg: dataHub.kek.algorithm
    });
    decrypted.jwe.iv.should.be.a('string');
    decrypted.jwe.ciphertext.should.be.a('string');
    decrypted.jwe.tag.should.be.a('string');
    decrypted.content.should.deep.equal(expected.content);
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
