/*!
 * Copyright (c) 2019-2022 Digital Bazaar, Inc. All rights reserved.
 */
const VALID_QUERY_KEYS = [
  'displayable', 'id', 'issuer', 'parentId', 'type'
];

/**
 * Each instance of this API is associated with a single EDV client and
 * performs initialization (ensures required indexes are created).
 */
export class VerifiableCredentialStore {
  /**
   * Creates a `VerifiableCredentialStore` interface for accessing a VC store
   * in an EDV (Encrypted Data Vault).
   *
   * @param {object} options - The options to use.
   * @param {object} options.edvClient - An `EdvClient` instance to use.
   */
  constructor({edv, edvClient, capability, invocationSigner}) {
    // throw on old parameters
    if(edv !== undefined) {
      throw new Error(
        '"edv" is no longer supported, pass "edvClient" instead.');
    }
    if(capability !== undefined) {
      throw new Error(
        '"capability" is no longer supported, pass an "edvClient" instance ' +
        'that internalizes zcap processing instead.');
    }
    if(invocationSigner !== undefined) {
      throw new Error(
        '"invocationSigner" is no longer supported, pass "edvClient" ' +
        'instance that internalizes zcap processing instead.');
    }
    if(!(edvClient && typeof edvClient === 'object')) {
      throw new TypeError('"edvClient" must be an object.');
    }
    this.edvClient = edvClient;

    // setup EDV indexes...

    // index to find by VC ID
    edvClient.ensureIndex({attribute: 'content.id', unique: true});
    // index to find by issuer
    edvClient.ensureIndex({
      attribute: ['meta.issuer', 'meta.displayable', 'content.type']
    });
    // index to find displayable VCs
    edvClient.ensureIndex({attribute: 'meta.displayable'});
    // index to find parent VCs
    edvClient.ensureIndex({attribute: ['meta.parentId']});
    // index to find by type
    edvClient.ensureIndex({attribute: ['content.type', 'meta.issuer']});
  }

  /**
   * Gets a verifiable credential by its ID.
   *
   * @param {string} id - The ID of the credential.
   *
   * @returns {Promise<object>} The EDV document for the stored VC.
   */
  async get({id} = {}) {
    const {documents: [doc]} = await this.edvClient.find({
      equals: {'content.id': id}
    });
    if(!doc) {
      const err = new Error('Verifiable Credential not found.');
      err.name = 'NotFoundError';
      throw err;
    }
    return doc;
  }

  /**
   * Gets all verifiable credential instances that match the given parameters
   *
   * @param {object|Array} query - One or more query objects with `type`,
   *   `issuer`, `displayable`, and `parentId` filters.
   *
   * @returns {Promise<object>} The matching EDV documents as an array in
   *   `documents`.
   */
  async find({query} = {}) {
    _assertObjectOrArrayOfObjects(query, 'query');

    // normalize query to an array of queries
    const queries = Array.isArray(query) ? query : [query];

    // build `equals` EDV query
    const equals = [];
    for(const q of queries) {
      _assertQuery(q);

      const {type, issuer, displayable, parentId} = q;
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
      if(parentId) {
        entry['meta.parentId'] = parentId;
      }
      equals.push(entry);
    }

    return this.edvClient.find({equals});
  }

  /**
   * Converts a VPR query into a local query to run against `find()`.
   *
   * @param {object} vprQuery - A Verifiable Presentation Request query
   *   (e.g. `{type: "QueryByExample", ...}`).
   *
   * @returns {Promise<object>} An object with `queries` set to an array where
   *   each element is a separate query to be passed to `find()`; the
   *   queries will be ordered such that they match the VPR query order; future
   *   versions may add additional properties to the returned object such as
   *   trusted issuer VCs.
   */
  async convertVPRQuery({vprQuery} = {}) {
    if(!(vprQuery && typeof vprQuery === 'object')) {
      throw new TypeError('"query" must be an object.');
    }
    const {type} = vprQuery;
    if(type === 'QueryByExample') {
      const {credentialQuery} = vprQuery;
      return this._convertQueryByExample({credentialQuery});
    }
    throw new Error(`Unsupported query type: "${type}"`);
  }

  /**
   * Stores a verifiable credential into EDV storage as the content an EDV
   * document.
   *
   * @param {object} credential - The credential to insert; it will be set as
   *   the `content` of the EDV document.
   * @param {object} [meta={}] - Custom meta data to set; the `issuer` field
   *   will be auto-populated if not set in the custom `meta`.
   *
   * @returns {Promise<object>} - The stored EDV document.
   */
  async insert({credential, meta = {}}) {
    if(!(credential && typeof credential === 'object')) {
      throw new TypeError('"credential" must be an object.');
    }
    if(!meta.issuer) {
      meta.issuer = _getIssuer({credential});
    }
    return this.edvClient.insert({doc: {meta, content: credential}});
  }

  /**
   * Upserts a verifiable credential in EDV storage, overwriting any previous
   * version if one exists.
   *
   * @param {object} credential - The credential to upsert; it will be set as
   *   the `content` of the EDV document; "credential.id" must be a string.
   * @param {object} [meta={}] - Custom meta data to set; the `issuer` field
   *   will be auto-populated if not set in the custom `meta`.
   *
   * @returns {Promise<object>} - The stored EDV document.
   */
  async upsert({credential, meta = {}}) {
    if(!(credential && typeof credential === 'object')) {
      throw new TypeError('"credential" must be an object.');
    }
    // `id` required to use `upsert`
    if(typeof credential.id !== 'string') {
      throw new TypeError('"credential.id" must be a string.');
    }
    if(!meta.issuer) {
      meta.issuer = _getIssuer({credential});
    }

    // get previous document and overwrite if it exists
    let doc;
    try {
      doc = await this.get({id: credential.id});
      doc.meta = meta;
      doc.content = credential;
    } catch(e) {
      if(e.name !== 'NotFoundError') {
        throw e;
      }
      doc = {content: credential, meta, sequence: 0};
    }
    return this.edvClient.upsert({doc});
  }

  /**
   * Removes a verifiable credential identified by its ID or EDV doc ID (for
   * VCs that do not have IDs).
   *
   * @param {string} [id] - The ID of the credential.
   * @param {string} [docId] - The ID of the EDV document storing the
   *   credential.
   *
   * @returns {Promise<object>} - An object with `{deleted: boolean, doc}`
   *   where `doc` is only set if the deleted document was found.
   */
  async delete({id, docId} = {}) {
    if(!(id || docId)) {
      throw new TypeError('Either "id" or "docId" must be a string.');
    }

    try {
      let doc;

      if(docId) {
        // fetch by `docId`
        try {
          doc = await this.edvClient.get({id: docId});
        } catch(e) {
          if(e.name === 'NotFoundError') {
            return {deleted: false};
          }
          throw e;
        }
      } else {
        // fetch by `content.id`
        ({documents: [doc]} = await this.edvClient.find({
          equals: {'content.id': id}
        }));
        if(!doc) {
          return {deleted: false};
        }
      }

      await this.edvClient.delete({doc});
      return {deleted: true, doc};
    } catch(e) {
      if(e.response.status === 404) {
        return {deleted: false};
      }
      throw e;
    }
  }

  async _convertQueryByExample({credentialQuery} = {}) {
    _assertObjectOrArrayOfObjects(credentialQuery, 'credentialQuery');

    // normalize query to be an array
    const query = Array.isArray(credentialQuery) ?
      credentialQuery : [credentialQuery];

    // build local queries
    const queries = [];
    for(const q of query) {
      const {example, trustedIssuer = []} = q;
      if(!(example && typeof example === 'object')) {
        throw new Error('"credentialQuery.example" must be an object.');
      }

      const {type} = example;
      if(typeof type !== 'string') {
        throw new Error(
          '"credentialQuery.example" without "type" is not supported.');
      }

      // normalize to arrays
      const trustedIssuers = Array.isArray(trustedIssuer) ?
        trustedIssuer : [trustedIssuer];
      const types = Array.isArray(type) ? type : [type];

      // build query to find all VCs that match any combination of type+issuer
      const query = [];

      // get issuer IDs
      const issuers = trustedIssuers.map(({id}) => {
        if(id) {
          return id;
        }
        // future version could do internal queries to find trusted issuer IDs
        // and return additional information along with `queries` below
        const error = new Error(
          '"credentialQuery.trustedIssuer" without an "id" is not supported.');
        error.name = 'NotSupportedError';
        throw error;
      });

      for(const type of types) {
        if(issuers.length === 0) {
          query.push({type});
          continue;
        }
        for(const issuer of issuers) {
          query.push({type, issuer});
        }
      }

      queries.push(query);
    }

    return {queries};
  }
}

function _assertQuery({query} = {}) {
  const keys = Object.keys(query);
  if(!keys.every(k => VALID_QUERY_KEYS.includes(k))) {
    throw new Error(
      `"query" keys must be one of: ${VALID_QUERY_KEYS.join(', ')}`);
  }
}

function _getIssuer({credential}) {
  const {issuer} = credential;
  if(!issuer) {
    throw new Error('"credential.issuer" must be an object or string.');
  }
  if(!(typeof issuer === 'string' || typeof issuer.id === 'string')) {
    throw new Error(
      '"credential.issuer" must be a URI or an object containing an ' +
      '"id" property.');
  }
  return issuer.id || issuer;
}

function _assertObjectOrArrayOfObjects(x, name) {
  if(!(x && typeof x === 'object' &&
    (!Array.isArray(x) || x.every(e => e && typeof e === 'object')))) {
    throw new TypeError(`"${name}" must be an array of objects or an object.`);
  }
}
