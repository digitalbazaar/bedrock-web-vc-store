/*!
 * Copyright (c) 2019-2022 Digital Bazaar, Inc. All rights reserved.
 */
import VerifiableCredentialStore from 'bedrock-web-vc-store';
import mock from './mock.js';
import credentials from './credentials.js';
import {queryWithMatchingTrustedIssuer} from './query.js';

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
    const edv = await mock.createEdv({keyResolver});
    const vcStore = new VerifiableCredentialStore({edv, invocationSigner});

    const credential = await vcStore.insert({credential: AlumniCredential});

    credential.should.be.an('object');
    credential.should.deep.equal(AlumniCredential);
  });

  it('should get a credential', async () => {
    const edv = await mock.createEdv({keyResolver});

    const vcStore = new VerifiableCredentialStore({edv, invocationSigner});

    await vcStore.insert({credential: AlumniCredential});
    const {content: credential} = await vcStore.get({id: AlumniCredential.id});

    credential.should.be.an('object');
    credential.should.deep.equal(AlumniCredential);
  });

  it('should find a credential using a string for type', async () => {
    const edv = await mock.createEdv({keyResolver});

    const vcStore = new VerifiableCredentialStore({edv, invocationSigner});

    await vcStore.insert({credential: AlumniCredential});
    const type = 'AlumniCredential';
    const [credential] = await vcStore.find({query: {type}});
    const {content} = credential;
    content.should.be.an('object');
    content.should.deep.equal(AlumniCredential);
  });

  it('should find a credential using an array for type', async () => {
    const edv = await mock.createEdv({keyResolver});

    const vcStore = new VerifiableCredentialStore({
      edv, invocationSigner});

    await vcStore.insert({credential: AlumniCredential});
    const type = ['AlumniCredential', 'VerifiableCredential'];
    const query = type.map(type => ({type}));

    const [credential] = await vcStore.find({query});
    const {content} = credential;

    content.should.be.an('object');
    content.should.deep.equal(AlumniCredential);
  });

  it('should fail to find a credential for a non-existent type', async () => {
    const edv = await mock.createEdv({keyResolver});

    const vcStore = new VerifiableCredentialStore({edv, invocationSigner});

    await vcStore.insert({credential: AlumniCredential});
    const type = 'KingCredential';
    const results = await vcStore.find({query: {type}});
    const [credential] = results;

    results.length.should.equal(0);
    should.not.exist(credential);
  });

  it('should find a credential for a given issuer', async () => {
    const edv = await mock.createEdv({keyResolver});

    const vcStore = new VerifiableCredentialStore({edv, invocationSigner});

    await vcStore.insert({credential: AlumniCredential});
    const issuer = 'https://example.edu/issuers/565049';
    const [credential] = await vcStore.find({query: {issuer}});

    const {content} = credential;
    content.should.be.an('object');
    content.should.deep.equal(AlumniCredential);
  });

  it('should fail to find a credential for a non-existent issuer', async () => {
    const edv = await mock.createEdv({keyResolver});

    const vcStore = new VerifiableCredentialStore({edv, invocationSigner});

    await vcStore.insert({credential: AlumniCredential});
    const issuer = 'did:example:1234';
    const results = await vcStore.find({query: {issuer}});
    const [credential] = results;

    results.length.should.equal(0);
    should.not.exist(credential);
  });

  it('should not find credential when querying for an AlumniCredential ' +
    'with an issuer different from the issuer on the credential', async () => {
    const edv = await mock.createEdv({keyResolver});

    const vcStore = new VerifiableCredentialStore({edv, invocationSigner});

    await vcStore.insert({credential: AlumniCredential});

    const newCred = Object.assign({}, AlumniCredential, {id: 'foo'});
    await vcStore.insert({credential: newCred});

    const queryWithNonMatchingTrustedIssuer =
      JSON.parse(JSON.stringify(queryWithMatchingTrustedIssuer));
    // Intentionally change the trustedIsser to a non matching one.
    queryWithNonMatchingTrustedIssuer.credentialQuery[0].trustedIssuer = [{
      id: 'urn:some:unmatching:issuer'
    }];
    const credentials = await vcStore.match({
      query: queryWithNonMatchingTrustedIssuer
    });

    credentials.length.should.equal(0);
  });

  it('should throw error if "id" of a trustedIssuer is undefined', async () => {
    const edv = await mock.createEdv({keyResolver});

    const vcStore = new VerifiableCredentialStore({edv, invocationSigner});

    await vcStore.insert({credential: AlumniCredential});

    const newCred = Object.assign({}, AlumniCredential, {id: 'foo'});
    await vcStore.insert({credential: newCred});

    const queryWithTrustedIssuerWithoutId =
      JSON.parse(JSON.stringify(queryWithMatchingTrustedIssuer));
    queryWithTrustedIssuerWithoutId.credentialQuery[0].trustedIssuer = [{}];
    let credentials;
    let err;
    try {
      credentials = await vcStore.match({
        query: queryWithTrustedIssuerWithoutId
      });
    } catch(e) {
      err = e;
    }

    should.exist(err);
    err.name.should.equal('NotSupportedError');
    should.not.exist(credentials);
  });

  it('should find credential when querying for an AlumniCredential ' +
    'with a matching issuer', async () => {
    const edv = await mock.createEdv({keyResolver});

    const vcStore = new VerifiableCredentialStore({
      edv, invocationSigner});

    await vcStore.insert({credential: AlumniCredential});
    const credentials = await vcStore.match({
      query: queryWithMatchingTrustedIssuer
    });

    credentials.length.should.equal(1);
    credentials[0].content.should.deep.equal(AlumniCredential);
  });

  it('should find credential when querying for an AlumniCredential ' +
    'with any issuer', async () => {
    const edv = await mock.createEdv({keyResolver});

    const vcStore = new VerifiableCredentialStore({
      edv, invocationSigner});

    await vcStore.insert({credential: AlumniCredential});
    const queryWithoutTrustedIssuer =
      JSON.parse(JSON.stringify(queryWithMatchingTrustedIssuer));
    delete queryWithoutTrustedIssuer.credentialQuery[0].trustedIssuer;

    const credentials = await vcStore.match({
      query: queryWithoutTrustedIssuer
    });

    credentials.length.should.equal(1);
    credentials[0].content.should.deep.equal(AlumniCredential);
  });

  it('should delete an existing credential', async () => {
    const edv = await mock.createEdv({keyResolver});

    const vcStore = new VerifiableCredentialStore({edv, invocationSigner});

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
    const edv = await mock.createEdv({keyResolver});

    const vcStore = new VerifiableCredentialStore({edv, invocationSigner});

    const result = await vcStore.delete({id: AlumniCredential.id});
    result.should.equal(false);
  });
});
