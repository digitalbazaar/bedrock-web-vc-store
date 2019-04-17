/*!
 * Copyright (c) 2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

import uuid from 'uuid-random';

/**
 * Each instance of this API is associated with a single data hub and performs
 * initialization (ensures required indexes are created)
 */
export default class VerifiableCredentialStore {
  constructor({hub}) {
    this.hub = hub;
    this.hub.ensureIndex({attribute: ['issuer', 'type']});
    this.hub.ensureIndex({attribute: 'id', unique: true});
  }

  /**
   * Gets a verifiable credential by its ID
   *
   * @param {string} id
   */
  async get({id}) {
    const [doc] = await this.hub.find({equals: {id}});
    if(!doc) {
      const err = new Error('Verifiable Credential not found.');
      err.name = 'NotFoundError';
      throw err;
    }
    return doc.content;
  }

  /**
   * Gets all verifiable credential instances that match the given parameters
   *
   * @param {string} [type]
   * @param {string} [issuer]
   *
   * @return {Promise<Array>} List of matching VCs
   */
  async find({type, issuer}) {
    const equals = [];
    if(type) {
      if(Array.isArray(type)) {
        const query = type.map(type => ({type}));
        equals.push(...query);
      } else {
        equals.push({type});
      }
    }
    if(issuer) {
      equals.push({issuer});
    }
    const results = await this.hub.find({equals});
    return results.map(({content}) => content);
  }

  async _queryByExample({credentialQuery}) {
    if(!credentialQuery) {
      throw new Error('"credentialQuery" is needed to execute a QueryByExample.');
    }
    if(typeof credentialQuery !== 'object') {
      throw new Error('"credentialQuery" must be an object or an array.');
    }
  
    // normalize query to be an array
    let query;  
    if(Array.isArray(credentialQuery)) {
      query = credentialQuery;
    } else {
      query = [credentialQuery];
    }

    const _query = async ({example}) => {
      const {type, trustedIssuer = []} = example;
      // normalize trusted issuers to be an array
      let trustedIssuers;
      if(Array.isArray(trustedIssuer)) {
        trustedIssuers = trustedIssuer;
      } else {
        trustedIssuers = [trustedIssuer];
      }
      const issuer = trustedIssuers.filter(({required}) => required)
        .map(({issuer}) => issuer);
      const results = await this.find({issuer, type});
      if(results.length === 0) {
        const err = new Error(`Unable to find required credential.`);
        err.name = 'NotFoundError';
        err.query = example;
        throw err;
      }
      return results
    };

    // // only look for credentials that are required
    // const requiredQuery =  query.filter(({required}) => required);
    // const requiredCredentials = await Promise.all(requiredQuery.map(_query));
    const requiredCredentials = await Promise.all(query.map(_query));

    // flatten results
    const credentials = requiredCredentials
      .reduce((acc, val) => acc.concat(val), []);
    return credentials;
  }
  
  /**
   * Finds the best matching verifiable credential for the given query
   *
   * @param query a VerifiablePresentation credential handler query
   *   (e.g. right now, support `QueryByExample`).
   * @param engine
   *
   * @return {Promise<Array>} List of matching VCs
   */
  async match({query, engine = credentials => credentials}) {
    // Needs to be implemented on the bedrock-web-data-hub side first
    const {type} = query;
    let results;
    if(type === 'QueryByExample') {
      const {credentialQuery} = query;
      results = await this._queryByExample({credentialQuery});
    } else {
      throw new Error(`Unsupported query type: "${type}"`)
    }
    return results.map(engine);
  }

  /**
   * Stores a verifiable credential in remote private storage
   *
   * @param {Object} credential
   */
  async insert({credential}) {
    const doc = await this.hub.insert({
      doc: {
        id: uuid(),
        content: credential
      }
    });
    return doc.content;
  }

  /**
   * Removes a verifiable credential identified by its ID
   *
   * @param id
   */
  async delete({id}) {
    try {
      const [doc] = await this.hub.find({equals: {id}});
      if(!doc) {
        return false;
      }
      return this.hub.delete({id: doc.id});
    } catch(e) {
      if(e.response.status === 404) {
        return false;
      }
      throw e;
    }
  }
}
