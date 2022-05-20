/*!
 * Copyright (c) 2019-2022 Digital Bazaar, Inc. All rights reserved.
 */
import credentials from './credentials.js';
import {EdvClient} from '@digitalbazaar/edv-client';
import mock from './mock.js';
import {queryWithMatchingTrustedIssuer} from './query.js';
import uuid from 'uuid-random';
import {VerifiableCredentialStore} from '@bedrock/web-vc-store';

const {alumniCredential} = credentials;

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

    const doc = await vcStore.insert({credential: alumniCredential});
    doc.should.be.an('object');
    doc.should.include.keys(['content', 'meta']);
    const {content: credential} = doc;
    credential.should.deep.equal(alumniCredential);
  });

  it('should get a credential', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    await vcStore.insert({credential: alumniCredential});
    const doc = await vcStore.get({id: alumniCredential.id});
    doc.should.be.an('object');
    doc.should.include.keys(['content', 'meta']);
    const {content: credential} = doc;
    credential.should.deep.equal(alumniCredential);
  });

  it('should find a credential using a string for type', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    await vcStore.insert({credential: alumniCredential});
    const type = 'AlumniCredential';
    const result = await vcStore.find({query: {type}});
    result.should.be.an('object');
    result.should.include.keys(['documents']);
    result.documents.should.be.an('array');
    const [doc] = result.documents;
    doc.should.be.an('object');
    doc.should.include.keys(['content', 'meta']);
    const {content: credential} = doc;
    credential.should.deep.equal(alumniCredential);
  });

  it('should find a credential using an array for type', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    await vcStore.insert({credential: alumniCredential});
    const type = ['AlumniCredential', 'VerifiableCredential'];
    const query = type.map(type => ({type}));

    const {documents: [doc]} = await vcStore.find({query});
    doc.should.be.an('object');
    doc.should.include.keys(['content', 'meta']);
    const {content: credential} = doc;
    credential.should.deep.equal(alumniCredential);
  });

  it('should fail to find a credential for a non-existent type', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    await vcStore.insert({credential: alumniCredential});
    const type = 'KingCredential';
    const {documents} = await vcStore.find({query: {type}});
    documents.length.should.equal(0);
  });

  it('should find a credential for a given issuer', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    await vcStore.insert({credential: alumniCredential});
    const issuer = 'https://example.edu/issuers/565049';
    const {documents: [doc]} = await vcStore.find({query: {issuer}});
    doc.should.be.an('object');
    doc.should.include.keys(['content', 'meta']);
    const {content: credential} = doc;
    credential.should.deep.equal(alumniCredential);
  });

  it('should fail to find a credential for a non-existent issuer', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    await vcStore.insert({credential: alumniCredential});
    const issuer = 'did:example:1234';
    const {documents} = await vcStore.find({query: {issuer}});
    documents.length.should.equal(0);
  });

  it('should not find credential when querying for an AlumniCredential ' +
    'with an issuer different from the issuer on the credential', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    await vcStore.insert({credential: alumniCredential});

    const newCred = {...alumniCredential, id: 'foo'};
    await vcStore.insert({credential: newCred});

    // this is a VPR query
    const queryWithNonMatchingTrustedIssuer =
      JSON.parse(JSON.stringify(queryWithMatchingTrustedIssuer));
    // intentionally change the trustedIsser to a non matching one.
    queryWithNonMatchingTrustedIssuer.credentialQuery[0].trustedIssuer = [{
      id: 'urn:some:unmatching:issuer'
    }];

    // convert VPR query into local queries
    const {queries} = await vcStore.convertVPRQuery({
      vprQuery: queryWithNonMatchingTrustedIssuer
    });
    // run local queries
    const results = await Promise.all(
      queries.map(async query => vcStore.find({query})));
    results[0].documents.length.should.equal(0);
  });

  it('should throw error if "id" of a trustedIssuer is undefined', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    // insert VCs
    await vcStore.insert({credential: alumniCredential});
    const newCred = {...alumniCredential, id: 'foo'};
    await vcStore.insert({credential: newCred});

    // this is a VPR query
    const queryWithTrustedIssuerWithoutId =
      JSON.parse(JSON.stringify(queryWithMatchingTrustedIssuer));
    queryWithTrustedIssuerWithoutId.credentialQuery[0].trustedIssuer = [{}];

    let err;
    try {
      await vcStore.convertVPRQuery({
        vprQuery: queryWithTrustedIssuerWithoutId
      });
    } catch(e) {
      err = e;
    }

    should.exist(err);
    err.name.should.equal('NotSupportedError');
  });

  it('should find credential when querying for an AlumniCredential ' +
    'with a matching issuer', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    await vcStore.insert({credential: alumniCredential});

    // convert VPR query into local queries
    const {queries} = await vcStore.convertVPRQuery({
      vprQuery: queryWithMatchingTrustedIssuer
    });

    // run local queries
    const results = await Promise.all(
      queries.map(async query => vcStore.find({query})));
    results[0].documents.length.should.equal(1);
    const {content: credential} = results[0].documents[0];
    credential.should.deep.equal(alumniCredential);
  });

  it('should find credential when querying for an AlumniCredential ' +
    'with any issuer', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    await vcStore.insert({credential: alumniCredential});

    // this is a VPR query
    const queryWithoutTrustedIssuer =
      JSON.parse(JSON.stringify(queryWithMatchingTrustedIssuer));
    delete queryWithoutTrustedIssuer.credentialQuery[0].trustedIssuer;

    // convert VPR query into local queries
    const {queries} = await vcStore.convertVPRQuery({
      vprQuery: queryWithoutTrustedIssuer
    });

    // run local queries
    const results = await Promise.all(
      queries.map(async query => vcStore.find({query})));
    results[0].documents.length.should.equal(1);
    const {content: credential} = results[0].documents[0];
    credential.should.deep.equal(alumniCredential);
  });

  it('should delete an existing credential', async () => {
    // first insert VC
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});
    await vcStore.insert({credential: alumniCredential});

    // then delete VC
    const result = await vcStore.delete({id: alumniCredential.id});
    result.should.be.an('object');
    result.should.have.keys(['deleted', 'doc', 'bundle']);
    result.deleted.should.equal(true);
    result.doc.should.be.an('object');
    let err;
    try {
      await vcStore.get({id: alumniCredential.id});
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.name.should.equal('NotFoundError');
  });

  it('should fail to delete a non-existent credential', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});
    const result = await vcStore.delete({id: alumniCredential.id});
    result.should.be.an('object');
    result.should.have.keys(['deleted', 'doc', 'bundle']);
    result.deleted.should.equal(false);
  });

  it('should fail to insert non-array bundle', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});
    let err;
    try {
      await vcStore.insert({
        credential: alumniCredential,
        bundleContents: false
      });
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.name.should.equal('TypeError');
  });

  it('should fail to insert non-array of objects bundle', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});
    let err;
    try {
      await vcStore.insert({
        credential: alumniCredential,
        bundleContents: [false]
      });
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.name.should.equal('TypeError');
  });

  it('should insert a bundle', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    const subCredential = {
      ..._deepClone(alumniCredential),
      id: _newId()
    };

    const doc = await vcStore.insert({
      credential: alumniCredential,
      bundleContents: [{
        credential: subCredential
      }]
    });
    doc.should.be.an('object');
    doc.should.include.keys(['content', 'meta']);
    const {content: credential} = doc;
    credential.should.deep.equal(alumniCredential);
  });

  it('should fail to upsert non-array bundle', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});
    let err;
    try {
      await vcStore.upsert({
        credential: alumniCredential,
        bundleContents: false
      });
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.name.should.equal('TypeError');
  });

  it('should fail to upsert non-array of objects bundle', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});
    let err;
    try {
      await vcStore.upsert({
        credential: alumniCredential,
        bundleContents: [false]
      });
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.name.should.equal('TypeError');
  });

  it('should upsert a bundle', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    const subCredential = {
      ..._deepClone(alumniCredential),
      id: _newId()
    };

    const doc = await vcStore.upsert({
      credential: alumniCredential,
      bundleContents: [{
        credential: subCredential
      }]
    });
    doc.should.be.an('object');
    doc.should.include.keys(['content', 'meta']);
    const {content: credential} = doc;
    credential.should.deep.equal(alumniCredential);
  });

  it('should upsert a bundle that mutates an existing VC', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    const subCredential = {
      ..._deepClone(alumniCredential),
      id: _newId()
    };

    // upsert `subCredential` first
    await vcStore.upsert({credential: subCredential, meta: {special: true}});

    // now create bundle that includes previously existing `subCredential`
    const doc = await vcStore.upsert({
      credential: alumniCredential,
      bundleContents: [{
        credential: subCredential
      }]
    });
    should.exist(doc);
    doc.should.be.an('object');
    doc.should.include.keys(['content', 'meta']);
    const {content: credential} = doc;
    credential.should.deep.equal(alumniCredential);

    // confirm sub credential still has `special` meta value and is
    // independent
    const subDoc = await vcStore.get({id: subCredential.id});
    should.exist(subDoc);
    subDoc.should.include.keys(['content', 'meta']);
    should.exist(subDoc.content.id);
    subDoc.content.id.should.equal(subCredential.id);
    should.exist(subDoc.meta.special);
    subDoc.meta.special.should.equal(true);
    should.not.exist(subDoc.meta.dependent);
  });

  it('should get a bundle', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    const subCredential = {
      ..._deepClone(alumniCredential),
      id: _newId()
    };

    const doc = await vcStore.upsert({
      credential: alumniCredential,
      bundleContents: [{
        credential: subCredential
      }]
    });
    doc.should.be.an('object');
    doc.should.include.keys(['content', 'meta']);
    const {content: credential} = doc;
    credential.should.deep.equal(alumniCredential);

    const result = await vcStore.getBundle({id: doc.content.id});
    should.exist(result);
    result.should.have.keys(['doc', 'bundle', 'allSubDocuments']);
    should.exist(result.doc);
    result.doc.should.be.an('object');
    should.exist(result.doc.content);
    result.doc.content.should.deep.equal(alumniCredential);
    should.exist(result.bundle);
    result.bundle.should.be.an('object');
    result.bundle.should.have.keys(['id', 'contents']);
    should.exist(result.bundle.id);
    result.bundle.id.should.equal(doc.content.id);
    should.exist(result.bundle.contents);
    result.bundle.contents.should.be.an('array');
    result.bundle.contents.length.should.equal(1);
    should.exist(result.bundle.contents[0]);
    result.bundle.contents[0].should.be.an('object');
    result.bundle.contents[0].should.have.keys(['doc']);
    should.exist(result.bundle.contents[0].doc);
    result.bundle.contents[0].doc.should.be.an('object');
    should.exist(result.bundle.contents[0].doc.content);
    result.bundle.contents[0].doc.content.should.deep.equal(subCredential);
  });

  it('should delete a bundle', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    const subCredential = {
      ..._deepClone(alumniCredential),
      id: _newId()
    };

    const doc = await vcStore.upsert({
      credential: alumniCredential,
      bundleContents: [{
        credential: subCredential
      }]
    });
    doc.should.be.an('object');
    doc.should.include.keys(['content', 'meta']);
    const {content: credential} = doc;
    credential.should.deep.equal(alumniCredential);

    const result = await vcStore.delete({id: doc.content.id});
    should.exist(result);
    result.should.have.keys(['deleted', 'doc', 'bundle']);
    should.exist(result.deleted);
    result.deleted.should.equal(true);
    should.exist(result.doc);
    result.doc.should.be.an('object');
    should.exist(result.doc.content);
    result.doc.content.should.deep.equal(alumniCredential);
    should.exist(result.bundle);
    result.bundle.should.be.an('object');
    result.bundle.should.have.keys(['id', 'contents']);
    should.exist(result.bundle.id);
    result.bundle.id.should.equal(doc.content.id);
    should.exist(result.bundle.contents);
    result.bundle.contents.should.be.an('array');
    result.bundle.contents.length.should.equal(1);
    should.exist(result.bundle.contents[0]);
    result.bundle.contents[0].should.be.an('object');
    result.bundle.contents[0].should.have.keys(['doc']);
    should.exist(result.bundle.contents[0].doc);
    result.bundle.contents[0].doc.should.be.an('object');
    should.exist(result.bundle.contents[0].doc.content);
    result.bundle.contents[0].doc.content.should.deep.equal(subCredential);

    // confirm sub credential is deleted
    let err;
    try {
      await vcStore.get({id: subCredential.id});
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.name.should.equal('NotFoundError');
  });

  it('should delete a bundle w/ preserve independent contents', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    const subCredential = {
      ..._deepClone(alumniCredential),
      id: _newId()
    };

    const doc = await vcStore.upsert({
      credential: alumniCredential,
      bundleContents: [{
        credential: subCredential,
        dependent: false
      }]
    });
    doc.should.be.an('object');
    doc.should.include.keys(['content', 'meta']);
    const {content: credential} = doc;
    credential.should.deep.equal(alumniCredential);

    const result = await vcStore.delete({id: doc.content.id});
    should.exist(result);
    result.should.have.keys(['deleted', 'doc', 'bundle']);
    should.exist(result.deleted);
    result.deleted.should.equal(true);
    should.exist(result.doc);
    result.doc.should.be.an('object');
    should.exist(result.doc.content);
    result.doc.content.should.deep.equal(alumniCredential);
    should.exist(result.bundle);
    result.bundle.should.be.an('object');
    result.bundle.should.have.keys(['id', 'contents']);
    should.exist(result.bundle.id);
    result.bundle.id.should.equal(doc.content.id);
    should.exist(result.bundle.contents);
    result.bundle.contents.should.be.an('array');
    result.bundle.contents.length.should.equal(1);
    should.exist(result.bundle.contents[0]);
    result.bundle.contents[0].should.be.an('object');
    result.bundle.contents[0].should.have.keys(['doc']);
    should.exist(result.bundle.contents[0].doc);
    result.bundle.contents[0].doc.should.be.an('object');
    should.exist(result.bundle.contents[0].doc.content);
    result.bundle.contents[0].doc.content.should.deep.equal(subCredential);

    // confirm sub credential is not deleted but is unlinked
    const subDoc = await vcStore.get({id: subCredential.id});
    should.exist(subDoc);
    subDoc.content.id.should.equal(subCredential.id);
    should.not.exist(subDoc.meta.bundledBy);
  });

  it('should delete a bundle w/ preserve pre-existing contents', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    const subCredential = {
      ..._deepClone(alumniCredential),
      id: _newId()
    };

    // upsert `subCredential` first
    await vcStore.upsert({credential: subCredential, meta: {special: true}});

    // now create bundle that includes previously existing `subCredential`
    const doc = await vcStore.upsert({
      credential: alumniCredential,
      bundleContents: [{
        credential: subCredential
      }]
    });

    const result = await vcStore.delete({id: doc.content.id});
    should.exist(result);
    result.should.have.keys(['deleted', 'doc', 'bundle']);
    should.exist(result.deleted);
    result.deleted.should.equal(true);
    should.exist(result.doc);
    result.doc.should.be.an('object');
    should.exist(result.doc.content);
    result.doc.content.should.deep.equal(alumniCredential);
    should.exist(result.bundle);
    result.bundle.should.be.an('object');
    result.bundle.should.have.keys(['id', 'contents']);
    should.exist(result.bundle.id);
    result.bundle.id.should.equal(doc.content.id);
    should.exist(result.bundle.contents);
    result.bundle.contents.should.be.an('array');
    result.bundle.contents.length.should.equal(1);
    should.exist(result.bundle.contents[0]);
    result.bundle.contents[0].should.be.an('object');
    result.bundle.contents[0].should.have.keys(['doc']);
    should.exist(result.bundle.contents[0].doc);
    result.bundle.contents[0].doc.should.be.an('object');
    should.exist(result.bundle.contents[0].doc.content);
    result.bundle.contents[0].doc.content.should.deep.equal(subCredential);

    // confirm sub credential is not deleted but is unlinked
    const subDoc = await vcStore.get({id: subCredential.id});
    should.exist(subDoc);
    subDoc.content.id.should.equal(subCredential.id);
    should.not.exist(subDoc.meta.bundledBy);
  });

  it('should delete a bundle w/ preserve other bundled contents', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    const subCredential = {
      ..._deepClone(alumniCredential),
      id: _newId()
    };

    // first create a bundle w/`subCredential`
    const doc = await vcStore.upsert({
      credential: alumniCredential,
      bundleContents: [{
        credential: subCredential
      }]
    });

    // now create a second one w/`subCredential`
    const secondDoc = await vcStore.upsert({
      credential: {
        ..._deepClone(alumniCredential),
        id: _newId()
      },
      bundleContents: [{
        credential: subCredential
      }]
    });

    // now delete the first VC bundle, which should NOT delete `subCredential`
    const result = await vcStore.delete({id: doc.content.id});
    should.exist(result);
    result.should.have.keys(['deleted', 'doc', 'bundle']);
    should.exist(result.deleted);
    result.deleted.should.equal(true);
    should.exist(result.doc);
    result.doc.should.be.an('object');
    should.exist(result.doc.content);
    result.doc.content.should.deep.equal(alumniCredential);
    should.exist(result.bundle);
    result.bundle.should.be.an('object');
    result.bundle.should.have.keys(['id', 'contents']);
    should.exist(result.bundle.id);
    result.bundle.id.should.equal(doc.content.id);
    should.exist(result.bundle.contents);
    result.bundle.contents.should.be.an('array');
    result.bundle.contents.length.should.equal(1);
    should.exist(result.bundle.contents[0]);
    result.bundle.contents[0].should.be.an('object');
    result.bundle.contents[0].should.have.keys(['doc']);
    should.exist(result.bundle.contents[0].doc);
    result.bundle.contents[0].doc.should.be.an('object');
    should.exist(result.bundle.contents[0].doc.content);
    result.bundle.contents[0].doc.content.should.deep.equal(subCredential);

    // confirm sub credential is not deleted but is unlinked from the first
    // credential bundle
    const subDoc = await vcStore.get({id: subCredential.id});
    should.exist(subDoc);
    subDoc.content.id.should.equal(subCredential.id);
    should.exist(subDoc.meta.bundledBy);
    subDoc.meta.bundledBy.should.deep.equal([secondDoc.content.id]);

    // now delete the second bundle, which should also delete `subCredential`
    await vcStore.delete({id: secondDoc.content.id});

    // confirm sub credential is deleted
    let err;
    try {
      await vcStore.get({id: subCredential.id});
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.name.should.equal('NotFoundError');
  });

  it('should fail to delete a member of an existing bundle', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    const subCredential = {
      ..._deepClone(alumniCredential),
      id: _newId()
    };

    const doc = await vcStore.upsert({
      credential: alumniCredential,
      bundleContents: [{
        credential: subCredential
      }]
    });
    doc.should.be.an('object');
    doc.should.include.keys(['content', 'meta']);
    const {content: credential} = doc;
    credential.should.deep.equal(alumniCredential);

    let err;
    try {
      await vcStore.delete({id: subCredential.id});
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.name.should.equal('ConstraintError');
    err.message.should.equal(
      'Cannot delete credential; all other credentials that bundle it ' +
      'must be deleted first.');
  });

  it('should force delete a member of an existing bundle', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    const subCredential = {
      ..._deepClone(alumniCredential),
      id: _newId()
    };

    const doc = await vcStore.upsert({
      credential: alumniCredential,
      bundleContents: [{
        credential: subCredential
      }]
    });
    doc.should.be.an('object');
    doc.should.include.keys(['content', 'meta']);
    const {content: credential} = doc;
    credential.should.deep.equal(alumniCredential);

    const result = await vcStore.delete({id: subCredential.id, force: true});
    should.exist(result);
    result.should.have.keys(['deleted', 'doc', 'bundle']);
    should.exist(result.deleted);
    result.deleted.should.equal(true);
    should.exist(result.doc);
    result.doc.should.be.an('object');
    should.exist(result.doc.content);
    result.doc.content.should.deep.equal(subCredential);
    should.not.exist(result.bundle);

    // confirm sub credential is deleted
    let err;
    try {
      await vcStore.get({id: subCredential.id});
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.name.should.equal('NotFoundError');

    // confirm alumni credential is not deleted
    const topDoc = await vcStore.get({id: alumniCredential.id});
    should.exist(topDoc);
    topDoc.content.id.should.equal(alumniCredential.id);
  });

  it('should fail to delete a credential w/o its bundle', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    const subCredential = {
      ..._deepClone(alumniCredential),
      id: _newId()
    };

    const doc = await vcStore.upsert({
      credential: alumniCredential,
      bundleContents: [{
        credential: subCredential
      }]
    });
    doc.should.be.an('object');
    doc.should.include.keys(['content', 'meta']);
    const {content: credential} = doc;
    credential.should.deep.equal(alumniCredential);

    let err;
    try {
      await vcStore.delete({id: alumniCredential.id, deleteBundle: false});
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.name.should.equal('ConstraintError');
    err.message.should.equal(
      'Cannot delete credential; other credentials are bundled by it.');
  });

  it('should force delete a credential w/o its bundle', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    const subCredential = {
      ..._deepClone(alumniCredential),
      id: _newId()
    };

    const doc = await vcStore.upsert({
      credential: alumniCredential,
      bundleContents: [{
        credential: subCredential
      }]
    });
    doc.should.be.an('object');
    doc.should.include.keys(['content', 'meta']);
    const {content: credential} = doc;
    credential.should.deep.equal(alumniCredential);

    const result = await vcStore.delete({
      id: alumniCredential.id, deleteBundle: false, force: true
    });
    should.exist(result);
    result.should.have.keys(['deleted', 'doc', 'bundle']);
    should.exist(result.deleted);
    result.deleted.should.equal(true);
    should.exist(result.doc);
    result.doc.should.be.an('object');
    should.exist(result.doc.content);
    result.doc.content.should.deep.equal(alumniCredential);
    should.not.exist(result.bundle);

    // confirm top credential is deleted
    let err;
    try {
      await vcStore.get({id: alumniCredential.id});
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.name.should.equal('NotFoundError');

    // confirm sub credential is not deleted
    const subDoc = await vcStore.get({id: subCredential.id});
    should.exist(subDoc);
    subDoc.content.id.should.equal(subCredential.id);
  });

  it('should upsert a deep bundle', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    const subSubCredential = {
      ..._deepClone(alumniCredential),
      id: _newId()
    };

    const subCredential = {
      ..._deepClone(alumniCredential),
      id: _newId()
    };

    const doc = await vcStore.upsert({
      credential: alumniCredential,
      bundleContents: [{
        credential: subCredential,
        bundleContents: [{
          credential: subSubCredential
        }]
      }]
    });
    doc.should.be.an('object');
    doc.should.include.keys(['content', 'meta']);
    const {content: credential} = doc;
    credential.should.deep.equal(alumniCredential);
  });

  it('should delete a deep bundle', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    const subSubCredential = {
      ..._deepClone(alumniCredential),
      id: _newId()
    };

    const subCredential = {
      ..._deepClone(alumniCredential),
      id: _newId()
    };

    const doc = await vcStore.upsert({
      credential: alumniCredential,
      bundleContents: [{
        credential: subCredential,
        bundleContents: [{
          credential: subSubCredential
        }]
      }]
    });
    doc.should.be.an('object');
    doc.should.include.keys(['content', 'meta']);
    const {content: credential} = doc;
    credential.should.deep.equal(alumniCredential);

    const result = await vcStore.delete({id: doc.content.id});
    should.exist(result);
    result.should.have.keys(['deleted', 'doc', 'bundle']);
    should.exist(result.deleted);
    result.deleted.should.equal(true);
    should.exist(result.doc);
    result.doc.should.be.an('object');
    should.exist(result.doc.content);
    result.doc.content.should.deep.equal(alumniCredential);
    should.exist(result.bundle);
    result.bundle.should.be.an('object');
    result.bundle.should.have.keys(['id', 'contents']);
    should.exist(result.bundle.id);
    result.bundle.id.should.equal(doc.content.id);
    should.exist(result.bundle.contents);
    result.bundle.contents.should.be.an('array');
    result.bundle.contents.length.should.equal(1);
    should.exist(result.bundle.contents[0]);
    result.bundle.contents[0].should.be.an('object');
    result.bundle.contents[0].should.have.keys(['doc', 'bundle']);
    should.exist(result.bundle.contents[0].doc);
    result.bundle.contents[0].doc.should.be.an('object');
    should.exist(result.bundle.contents[0].doc.content);
    result.bundle.contents[0].doc.content.should.deep.equal(subCredential);
    // subSubCredential
    should.exist(result.bundle.contents[0].bundle);
    const subBundle = result.bundle.contents[0].bundle;
    subBundle.should.be.an('object');
    subBundle.should.have.keys(['id', 'contents']);
    should.exist(subBundle.id);
    subBundle.id.should.equal(subCredential.id);
    subBundle.contents.should.be.an('array');
    subBundle.contents.length.should.equal(1);
    should.exist(subBundle.contents[0]);
    subBundle.contents[0].should.be.an('object');
    subBundle.contents[0].should.have.keys(['doc']);
    should.exist(subBundle.contents[0].doc);
    subBundle.contents[0].doc.should.be.an('object');
    should.exist(subBundle.contents[0].doc.content);
    subBundle.contents[0].doc.content.should.deep.equal(subSubCredential);

    // confirm sub credential is deleted
    let err;
    try {
      await vcStore.get({id: subCredential.id});
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.name.should.equal('NotFoundError');

    // confirm sub sub credential is deleted
    err = undefined;
    try {
      await vcStore.get({id: subSubCredential.id});
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.name.should.equal('NotFoundError');
  });

  it('should fail to delete a deep member of an existing bundle', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    const subSubCredential = {
      ..._deepClone(alumniCredential),
      id: _newId()
    };

    const subCredential = {
      ..._deepClone(alumniCredential),
      id: _newId()
    };

    const doc = await vcStore.upsert({
      credential: alumniCredential,
      bundleContents: [{
        credential: subCredential,
        bundleContents: [{
          credential: subSubCredential
        }]
      }]
    });
    doc.should.be.an('object');
    doc.should.include.keys(['content', 'meta']);
    const {content: credential} = doc;
    credential.should.deep.equal(alumniCredential);

    let err;
    try {
      await vcStore.delete({id: subSubCredential.id});
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.name.should.equal('ConstraintError');
    err.message.should.equal(
      'Cannot delete credential; all other credentials that bundle it ' +
      'must be deleted first.');
  });

  it('should force delete a deep member of an existing bundle', async () => {
    const {edvClient} = await mock.createEdv();
    const vcStore = new VerifiableCredentialStore({edvClient});

    const subSubCredential = {
      ..._deepClone(alumniCredential),
      id: _newId()
    };

    const subCredential = {
      ..._deepClone(alumniCredential),
      id: _newId()
    };

    const doc = await vcStore.upsert({
      credential: alumniCredential,
      bundleContents: [{
        credential: subCredential,
        bundleContents: [{
          credential: subSubCredential
        }]
      }]
    });
    doc.should.be.an('object');
    doc.should.include.keys(['content', 'meta']);
    const {content: credential} = doc;
    credential.should.deep.equal(alumniCredential);

    const result = await vcStore.delete({id: subSubCredential.id, force: true});
    should.exist(result);
    result.should.have.keys(['deleted', 'doc', 'bundle']);
    should.exist(result.deleted);
    result.deleted.should.equal(true);
    should.exist(result.doc);
    result.doc.should.be.an('object');
    should.exist(result.doc.content);
    result.doc.content.should.deep.equal(subSubCredential);
    should.not.exist(result.bundle);

    // confirm sub credential is not deleted
    const subDoc = await vcStore.get({id: subCredential.id});
    should.exist(subDoc);
    subDoc.content.id.should.equal(subCredential.id);

    // confirm alumni credential is not deleted
    const topDoc = await vcStore.get({id: alumniCredential.id});
    should.exist(topDoc);
    topDoc.content.id.should.equal(alumniCredential.id);

    // confirm sub credential is deleted
    let err;
    try {
      await vcStore.get({id: subSubCredential.id});
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.name.should.equal('NotFoundError');
  });
});

function _deepClone(x) {
  return JSON.parse(JSON.stringify(x));
}

function _newId() {
  return `urn:uuid:${uuid()}`;
}
