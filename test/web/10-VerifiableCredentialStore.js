/*!
 * Copyright (c) 2019-2022 Digital Bazaar, Inc. All rights reserved.
 */
import credentials from './credentials.js';
import {EdvClient} from '@digitalbazaar/edv-client';
import mock from './mock.js';
import {queryWithMatchingTrustedIssuer} from './query.js';
import {VerifiableCredentialStore} from 'bedrock-web-vc-store';

const {AlumniCredential} = credentials;

describe('VerifiableCredentialStore', () => {
  before(async () => {
    await mock.init();
  });

  after(async () => {
    mock.server.shutdown();
  });

  it('fails to get with a misconfigured EdvClient', async () => {
    let result;
    let err;
    try {
      const vcStore = new VerifiableCredentialStore({
        edvClient: new EdvClient()
      });
      result = await vcStore.get({id: 'test'});
    } catch(e) {
      err = e;
    }
    should.not.exist(result);
    should.exist(err);
  });

  it('should insert a credential', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    const doc = await vcStore.insert({credential: AlumniCredential});
    doc.should.be.an('object');
    doc.should.include.keys(['content', 'meta']);
    const {content: credential} = doc;
    credential.should.deep.equal(AlumniCredential);
  });

  it('should get a credential', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    await vcStore.insert({credential: AlumniCredential});
    const doc = await vcStore.get({id: AlumniCredential.id});
    doc.should.be.an('object');
    doc.should.include.keys(['content', 'meta']);
    const {content: credential} = doc;
    credential.should.deep.equal(AlumniCredential);
  });

  it('should find a credential using a string for type', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    await vcStore.insert({credential: AlumniCredential});
    const type = 'AlumniCredential';
    const result = await vcStore.find({query: {type}});
    result.should.be.an('object');
    result.should.include.keys(['documents']);
    result.documents.should.be.an('array');
    const [doc] = result.documents;
    doc.should.be.an('object');
    doc.should.include.keys(['content', 'meta']);
    const {content: credential} = doc;
    credential.should.deep.equal(AlumniCredential);
  });

  it('should find a credential using an array for type', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    await vcStore.insert({credential: AlumniCredential});
    const type = ['AlumniCredential', 'VerifiableCredential'];
    const query = type.map(type => ({type}));

    const {documents: [doc]} = await vcStore.find({query});
    doc.should.be.an('object');
    doc.should.include.keys(['content', 'meta']);
    const {content: credential} = doc;
    credential.should.deep.equal(AlumniCredential);
  });

  it('should fail to find a credential for a non-existent type', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    await vcStore.insert({credential: AlumniCredential});
    const type = 'KingCredential';
    const {documents} = await vcStore.find({query: {type}});
    documents.length.should.equal(0);
  });

  it('should find a credential for a given issuer', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    await vcStore.insert({credential: AlumniCredential});
    const issuer = 'https://example.edu/issuers/565049';
    const {documents: [doc]} = await vcStore.find({query: {issuer}});
    doc.should.be.an('object');
    doc.should.include.keys(['content', 'meta']);
    const {content: credential} = doc;
    credential.should.deep.equal(AlumniCredential);
  });

  it('should fail to find a credential for a non-existent issuer', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    await vcStore.insert({credential: AlumniCredential});
    const issuer = 'did:example:1234';
    const {documents} = await vcStore.find({query: {issuer}});
    documents.length.should.equal(0);
  });

  it.skip('should not find credential when querying for an AlumniCredential ' +
    'with an issuer different from the issuer on the credential', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    await vcStore.insert({credential: AlumniCredential});

    const newCred = {...AlumniCredential, id: 'foo'};
    await vcStore.insert({credential: newCred});

    const queryWithNonMatchingTrustedIssuer =
      JSON.parse(JSON.stringify(queryWithMatchingTrustedIssuer));
    // intentionally change the trustedIsser to a non matching one.
    queryWithNonMatchingTrustedIssuer.credentialQuery[0].trustedIssuer = [{
      id: 'urn:some:unmatching:issuer'
    }];

    // FIXME: use `convertVPRQuery` and `find`
    const credentials = await vcStore.match({
      query: queryWithNonMatchingTrustedIssuer
    });

    credentials.length.should.equal(0);
  });

  it.skip('should throw error if "id" of a trustedIssuer is undefined', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    await vcStore.insert({credential: AlumniCredential});

    const newCred = {...AlumniCredential, id: 'foo'};
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

  it.skip('should find credential when querying for an AlumniCredential ' +
    'with a matching issuer', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    await vcStore.insert({credential: AlumniCredential});
    const credentials = await vcStore.match({
      query: queryWithMatchingTrustedIssuer
    });

    credentials.length.should.equal(1);
    credentials[0].content.should.deep.equal(AlumniCredential);
  });

  it.skip('should find credential when querying for an AlumniCredential ' +
    'with any issuer', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

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
    // first insert VC
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});
    await vcStore.insert({credential: AlumniCredential});

    // then delete VC
    const result = await vcStore.delete({id: AlumniCredential.id});
    result.should.be.an('object');
    result.should.have.keys(['deleted', 'doc']);
    result.deleted.should.equal(true);
    result.doc.should.be.an('object');
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
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});
    const result = await vcStore.delete({id: AlumniCredential.id});
    result.should.be.an('object');
    result.should.have.keys(['deleted', 'doc']);
    result.deleted.should.equal(false);
  });
});
