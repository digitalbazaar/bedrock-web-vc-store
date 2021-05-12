/*!
 * Copyright (c) 2019-2020 Digital Bazaar, Inc. All rights reserved.
 */

/**
 * Each instance of this API is associated with a single edv and performs
 * initialization (ensures required indexes are created)
 */
export default class VerifiableCredentialStore {
  constructor({edv, invocationSigner}) {
    this.edv = edv;
    this.invocationSigner = invocationSigner;
    this.edv.ensureIndex({attribute: [
      'meta.issuer',
      'meta.displayable',
      'content.type'
    ]});
    this.edv.ensureIndex({attribute: 'content.id', unique: true});
  }

  /**
   * Gets a verifiable credential by its ID
   *
   * @param {string} id
   */
  async get({id}) {
    const {invocationSigner} = this;
    const {documents: [doc]} = await this.edv.find({
      equals: {'content.id': id},
      invocationSigner
    });
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
   * @param {boolean} [displayable]
   *
   * @return {Promise<Array>} List of matching VCs
   */
  async find({query} = {}) {
    const equals = [];
    query = Array.isArray(query) ? query : [query];
    for(const {type, issuer, displayable} of query) {
      const entry = {};
      if(type) {
        entry['content.type'] = type;
      }
      if(issuer) {
        entry['meta.issuer'] = issuer;
      }
      if(displayable) {
        entry['meta.displayable'] = displayable;
      }
      equals.push(entry);
    }

    const {invocationSigner} = this;
    const {documents: docs} = await this.edv.find({equals, invocationSigner});
    return docs.map(({content, meta}) => {
      return {
        content,
        meta
      };
    });
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
    // needs to be implemented on the edv-client side first
    const {type} = query;
    let results;
    if(type === 'QueryByExample') {
      const {credentialQuery} = query;
      results = await this._queryByExample({credentialQuery});
    } else {
      throw new Error(`Unsupported query type: "${type}"`);
    }
    return results.map(engine);
  }

  /**
   * Stores a verifiable credential in remote private storage
   *
   * @param {object} credential
   * @param {object} meta
   */
  async insert({credential, meta = {}}) {
    const {invocationSigner} = this;
    meta.issuer = this._getIssuer({credential});
    const doc = await this.edv.insert({
      doc: {
        meta,
        content: credential
      },
      invocationSigner
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
      const {invocationSigner} = this;
      const {documents: [doc]} = await this.edv.find({
        equals: {'content.id': id},
        invocationSigner
      });
      if(!doc) {
        return false;
      }
      return this.edv.delete({doc, invocationSigner});
    } catch(e) {
      if(e.response.status === 404) {
        return false;
      }
      throw e;
    }
  }

  async _queryByExample({credentialQuery}) {
    if(!credentialQuery) {
      throw new Error(
        '"credentialQuery" is needed to execute a QueryByExample.');
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

      // build query to find all VCs that match any combination of type+issuer
      const query = [];
      const issuers = trustedIssuers.filter(({required}) => required)
        .map(({issuer}) => issuer);
      const types = Array.isArray(type) ? type : [type];
      for(const type of types) {
        if(issuers.length === 0) {
          query.push({type});
          continue;
        }
        for(const issuer of issuers) {
          query.push({type, issuer});
        }
      }
      return this.find({query});
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

  _getIssuer({credential}) {
    const {issuer} = credential;
    if(!issuer) {
      throw new Error('A verifiable credential MUST have an issuer property');
    }
    if(!(typeof issuer === 'string' || typeof issuer.id === 'string')) {
      throw new Error('The value of the issuer property MUST be either a URI' +
        ' or an object containing an id property.');
    }
    return typeof issuer === 'string' ? issuer : issuer.id;
  }
}
