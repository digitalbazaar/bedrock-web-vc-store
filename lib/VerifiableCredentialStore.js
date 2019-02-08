/*!
 * Copyright (c) 2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

/**
 * Each instance of this API is associated with a single data hub
 */
export default class VerifiableCredentialStore {
  /**
   * Creates a `VerifiableCredentialStore` instance and specifies the
   * `RemoteStorage` API to use and ensures there is an `issuer` index.
   * Note: This may change as we make changes to the RemoteStorage API...
   */
  constructor({remoteStorage}) {
    this.remoteStorage = remoteStorage;
  }

  /**
   * Gets a verifiable credential by its ID
   *
   * @param id
   */
  async get({id}) {
    return this.remoteStorage.get({id});
  }

  /**
   * Gets all verifiable credential instances that match the given parameters
   *
   * @param type
   * @param issuer
   */
  find({type, issuer}) {
  }

  /**
   * Finds the best matching verifiable credential for the given query
   *
   * @param query a VerifiablePresentation credential handler query
   *   (e.g. right now, support `QueryByExample`).
   * @param engine
   */
  match({query, engine}) {
  }

  /**
   * Stores a verifiable credential in remote private storage
   *
   * @param credential
   */
  async insert({credential}) {
    return this.remoteStorage.insert({doc: credential});
  }

  /**
   * Removes a verifiable credential identified by its ID
   *
   * @param id
   */
  async delete({id}) {
    return this.remoteStorage.delete({id});
  }
}
