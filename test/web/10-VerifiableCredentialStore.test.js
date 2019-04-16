/*!
 * Copyright (c) 2019 Digital Bazaar, Inc. All rights reserved.
 */
import VerifiableCredentialStore from 'bedrock-web-vc-store';

import {init, createDataHub} from './mock.js';
import credentials from './credentials.js';
import query from './query.js';

const {AlumniCredential} = credentials;

let mock;

describe('VerifiableCredentialStore', () => {
  before(async () => {
    mock = await init();
  });
  
  after(async () => {
    mock.server.shutdown();
  });
  
  it('should insert a credential', async () => {
    const hub = await createDataHub({mock});
    const vcStore = new VerifiableCredentialStore({hub});

    const credential = await vcStore.insert({credential: AlumniCredential});
    
    credential.should.be.an('object');
    credential.should.deep.equal(AlumniCredential);
  });

  it('should get a credential', async () => {
    const hub = await createDataHub({mock});
    const vcStore = new VerifiableCredentialStore({hub});
    
    await vcStore.insert({credential: AlumniCredential});
    const credential = await vcStore.get({id: AlumniCredential.id});

    credential.should.be.an('object');
    credential.should.deep.equal(AlumniCredential);
  });


  it('should find a credential using a string for type', async () => {
    const hub = await createDataHub({mock});
    const vcStore = new VerifiableCredentialStore({hub});
  
    await vcStore.insert({credential: AlumniCredential});
    const type = 'AlumniCredential';
    const [credential] = await vcStore.find({type});

    credential.should.be.an('object');
    credential.should.deep.equal(AlumniCredential);
  });

  it('should find a credential using an array for type', async () => {
    const hub = await createDataHub({mock});
    const vcStore = new VerifiableCredentialStore({hub});
  
    await vcStore.insert({credential: AlumniCredential});
    const type = ['AlumniCredential', 'VerifiableCredential'];
    const [credential] = await vcStore.find({type});

    credential.should.be.an('object');
    credential.should.deep.equal(AlumniCredential);
  });

  it('should fail to find a credential for a non-existent type', async () => {
    const hub = await createDataHub({mock});
    const vcStore = new VerifiableCredentialStore({hub});
  
    await vcStore.insert({credential: AlumniCredential});
    const type = 'KingCredential';
    const results = await vcStore.find({type});
    const [credential] = results;

    results.length.should.equal(0);
    should.not.exist(credential);
  });

  it('should find a credential for a given issuer', async () => {
    const hub = await createDataHub({mock});
    const vcStore = new VerifiableCredentialStore({hub});
  
    await vcStore.insert({credential: AlumniCredential});
    const issuer = 'https://example.edu/issuers/565049';
    const [credential] = await vcStore.find({issuer});

    credential.should.be.an('object');
    credential.should.deep.equal(AlumniCredential);
  });

  it('should fail to find a credential for a non-existent issuer', async () => {
    const hub = await createDataHub({mock});
    const vcStore = new VerifiableCredentialStore({hub});
  
    await vcStore.insert({credential: AlumniCredential});
    const issuer = 'did:example:1234';
    const results = await vcStore.find({issuer});
    const [credential] = results;

    results.length.should.equal(0);
    should.not.exist(credential);
  });

  it('should query for an AlumniCredential with any issuer', async () => {
    const hub = await createDataHub({mock});
    const vcStore = new VerifiableCredentialStore({hub});
  
    await vcStore.insert({credential: AlumniCredential});
    // TODO: Change code to use spread operator when bedrock-karma is fixed
    const newCred = Object.assign({}, AlumniCredential, {id: 'foo'})
    await vcStore.insert({credential: newCred});
    const credentials = await vcStore.match({query: query.query1});

    credentials.length.should.equal(2);
    credentials[0].should.deep.equal(AlumniCredential);
    credentials[1].should.deep.equal(newCred);
  });

  it('should query for an AlumniCredential for a specific issuer', async () => {
    const hub = await createDataHub({mock});
    const vcStore = new VerifiableCredentialStore({hub});
  
    await vcStore.insert({credential: AlumniCredential});
    const credentials = await vcStore.match({query: query.query2});

    credentials.length.should.equal(1);
    credentials[0].should.deep.equal(AlumniCredential);
  });

  it('should delete an existing credential', async () => {
    const hub = await createDataHub({mock});
    const vcStore = new VerifiableCredentialStore({hub});

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
    const hub = await createDataHub({mock});
    const vcStore = new VerifiableCredentialStore({hub});

    const result = await vcStore.delete({id: AlumniCredential.id});
    result.should.equal(false);
  });
});
