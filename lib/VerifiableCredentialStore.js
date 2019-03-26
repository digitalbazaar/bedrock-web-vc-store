/*!
 * Copyright (c) 2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

/**
 * Each instance of this API is associated with a single data hub
 */
export default class VerifiableCredentialStore {
  constructor({hub}) {
    this.hub = hub;
  }

  /**
   * Performs initialization (ensures required indexes are created)
   */
  init() {
    this.hub.ensureIndex({attribute: ['issuer', 'type']});
  }

  /**
   * Gets a verifiable credential by its ID
   *
   * @param {string} id
   */
  async get({id}) {
    return this.hub.get({id});
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
      equals.push({type});
    }
    if(issuer) {
      equals.push({issuer});
    }
    return this.hub.find({equals});
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
  async match({query, engine}) {
    // Needs to be implemented on the bedrock-web-data-hub side first
  }

  /**
   * Stores a verifiable credential in remote private storage
   *
   * @param {Object} credential
   */
  async insert({credential}) {
    return this.hub.insert({doc: credential});
  }

  /**
   * Removes a verifiable credential identified by its ID
   *
   * @param id
   */
  async delete({id}) {
    return this.hub.delete({id});
  }
}
