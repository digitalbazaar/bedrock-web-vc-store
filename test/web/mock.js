/*!
 * Copyright (c) 2018-2021 Digital Bazaar, Inc. All rights reserved.
 */
import didContext from 'did-context';
import didMethodKey from 'did-method-key';
import {Ed25519VerificationKey2018}
  from '@digitalbazaar/ed25519-verification-key-2018';
import {EdvClient} from 'edv-client';
import {MockHmac} from './mockHmac.js';
import {MockInvoker} from './mockInvoker.js';
import {MockKak} from './mockKak.js';
import {MockStorage} from './mockStorage.js';
import {MockServer} from './mockServer.js';

const driver = didMethodKey.driver();
export class TestMock {
  constructor(server = new MockServer()) {
    // create mock server
    this.server = server;
    const accountId = this.accountId = 'test';
    // mock edv storage
    this.edvStorage = new MockStorage(
      {server: this.server, controller: accountId});
    // this is used to store recipient keys
    this.keyStorage = new Map();
  }
  async init() {
    // only init keys once
    // this is used for the edv controller's keys in the tests
    if(!this.keys) {
      // create mock keys
      this.keys = {};

      // this creates the same invocationSigner for each test.
      this.invocationSigner = new MockInvoker();
      // create KAK and HMAC keys for creating edvs
      // this creates the same keyAgreementKey for each test.
      this.keys.keyAgreementKey = new MockKak();
      // the creates the same hmac for each test.
      this.keys.hmac = await MockHmac.create();
      // only store the KaK in the recipients' keyStorage.
      this.keyStorage.set(
        this.keys.keyAgreementKey.id, this.keys.keyAgreementKey);
      this.keyResolver = ({id}) => {
        const key = this.keyStorage.get(id);
        if(key) {
          return key;
        }
        throw new Error(`Key ${id} not found`);
      };
      this.documentLoader = async url => {
        if(url.startsWith('did:key:')) {
          const id = url.replace('did:key:');
          return {
            contextUrl: null,
            documentUrl: url,
            document: this.keyResolver({id})
          };
        }
        if(url === 'https://www.w3.org/ns/did/v1') {
          return {
            contextUrl: null,
            documentUrl: url,
            document: didContext.contexts.get('https://w3id.org/did/v0.11')
          };
        }
      };
    }
  }
  async createEdv({controller, referenceId, keyResolver} = {}) {
    const {keyAgreementKey, hmac} = this.keys;
    let config = {
      sequence: 0,
      controller: controller || this.invocationSigner.id,
      keyAgreementKey: {id: keyAgreementKey.id, type: keyAgreementKey.type},
      hmac: {id: hmac.id, type: hmac.type}
    };
    if(referenceId) {
      config.referenceId = referenceId;
    }
    config = await EdvClient.createEdv(
      {config, url: 'http://localhost:9876/edvs'});
    return new EdvClient({id: config.id, keyAgreementKey, hmac, keyResolver});
  }
  async createCapabilityAgent() {
    const keyPair = await Ed25519VerificationKey2018.generate();
    const didKey = await this.createKeyAgreementKey(keyPair);
    keyPair.id = didKey.id;
    return {capabilityAgent: new MockInvoker(keyPair), didKey};
  }
  async createKeyAgreementKey(keyMaterial) {

    const didKey = keyMaterial ?
      await driver.keyToDidDoc(keyMaterial) : await driver.generate();
    const [kaK] = didKey.keyAgreement;
    this.keyStorage.set(
      didKey.id, {'@context': 'https://w3id.org/security/v2', kaK});
    return didKey;
  }
}

const singleton = new TestMock();
export default singleton;
