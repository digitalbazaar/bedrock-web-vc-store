/*!
 * Copyright (c) 2019-2020 Digital Bazaar, Inc. All rights reserved.
 */
import VerifiableCredentialStore from 'bedrock-web-vc-store';
import mock from './mock.js';
import credentials from './credentials.js';
import query from './query.js';

const {AlumniCredential} = credentials;

describe('VerifiableCredentialStore', () => {
  let invocationSigner;
  let keyResolver;
  before(async () => {
    await mock.init();
    invocationSigner = mock.invocationSigner;
    keyResolver = mock.keyResolver;
  });

  after(async () => {
    mock.server.shutdown();
  });

  it('should insert a credential', async () => {
    const hub = await mock.createEdv({keyResolver});
    const vcStore = new VerifiableCredentialStore({edv: hub, invocationSigner});

    const credential = await vcStore.insert({credential: AlumniCredential});

    credential.should.be.an('object');
    credential.should.deep.equal(AlumniCredential);
  });

  it('should get a credential', async () => {
    const hub = await mock.createEdv({keyResolver});

    const vcStore = new VerifiableCredentialStore({edv: hub, invocationSigner});

    await vcStore.insert({credential: AlumniCredential});
    const credential = await vcStore.get({id: AlumniCredential.id});

    credential.should.be.an('object');
    credential.should.deep.equal(AlumniCredential);
  });

  it('should find a credential using a string for type', async () => {
    const hub = await mock.createEdv({keyResolver});

    const vcStore = new VerifiableCredentialStore({edv: hub, invocationSigner});

    await vcStore.insert({credential: AlumniCredential});
    const type = 'AlumniCredential';
    const [credential] = await vcStore.find({query: {type}});
    const {content} = credential;
    content.should.be.an('object');
    content.should.deep.equal(AlumniCredential);
  });

  it.skip('should find a credential using an array for type', async () => {
    const hub = await mock.createEdv({keyResolver});

    const vcStore = new VerifiableCredentialStore({
      edv: hub, invocationSigner});

    await vcStore.insert({credential: AlumniCredential});
    const type = ['AlumniCredential', 'VerifiableCredential'];

    const [credential] = await vcStore.find({query: {type}});

    credential.should.be.an('object');
    credential.should.deep.equal(AlumniCredential);
  });

  it('should fail to find a credential for a non-existent type', async () => {
    const hub = await mock.createEdv({keyResolver});

    const vcStore = new VerifiableCredentialStore({edv: hub, invocationSigner});

    await vcStore.insert({credential: AlumniCredential});
    const type = 'KingCredential';
    const results = await vcStore.find({query: {type}});
    const [credential] = results;

    results.length.should.equal(0);
    should.not.exist(credential);
  });

  it('should find a credential for a given issuer', async () => {
    const hub = await mock.createEdv({keyResolver});

    const vcStore = new VerifiableCredentialStore({edv: hub, invocationSigner});

    await vcStore.insert({credential: AlumniCredential});
    const issuer = 'https://example.edu/issuers/565049';
    const [credential] = await vcStore.find({query: {issuer}});

    const {content} = credential;
    content.should.be.an('object');
    content.should.deep.equal(AlumniCredential);
  });

  it('should fail to find a credential for a non-existent issuer', async () => {
    const hub = await mock.createEdv({keyResolver});

    const vcStore = new VerifiableCredentialStore({edv: hub, invocationSigner});

    await vcStore.insert({credential: AlumniCredential});
    const issuer = 'did:example:1234';
    const results = await vcStore.find({query: {issuer}});
    const [credential] = results;

    results.length.should.equal(0);
    should.not.exist(credential);
  });

  it('should query for an AlumniCredential with any issuer', async () => {
    const hub = await mock.createEdv({keyResolver});

    const vcStore = new VerifiableCredentialStore({edv: hub, invocationSigner});

    await vcStore.insert({credential: AlumniCredential});

    const newCred = Object.assign({}, AlumniCredential, {id: 'foo'});
    await vcStore.insert({credential: newCred});

    const credentials = await vcStore.match({query: query.query1});

    credentials.length.should.equal(2);
    credentials[0].content.should.deep.equal(AlumniCredential);
    credentials[1].content.should.deep.equal(newCred);
  });

  it('should query for an AlumniCredential for a specific issuer',
    async () => {
      const hub = await mock.createEdv({keyResolver});

      const vcStore = new VerifiableCredentialStore({
        edv: hub, invocationSigner});

      await vcStore.insert({credential: AlumniCredential});
      const credentials = await vcStore.match({query: query.query2});

      credentials.length.should.equal(1);
      credentials[0].content.should.deep.equal(AlumniCredential);
    });

  it('should delete an existing credential', async () => {
    const hub = await mock.createEdv({keyResolver});

    const vcStore = new VerifiableCredentialStore({edv: hub, invocationSigner});

    await vcStore.insert({credential: AlumniCredential});

    const result = await vcStore.delete({id: AlumniCredential.id});

    result.should.equal(true);
    let err;
    try {
      await vcStore.get({id: AlumniCredential.id});
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.name.should.equal('NotFoundError');
  });

  it('should fail to delete a non-existent credential', async () => {
    const hub = await mock.createEdv({keyResolver});

    const vcStore = new VerifiableCredentialStore({edv: hub, invocationSigner});

    const result = await vcStore.delete({id: AlumniCredential.id});
    result.should.equal(false);
  });
});
