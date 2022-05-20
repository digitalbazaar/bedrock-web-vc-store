/*!
 * Copyright (c) 2019-2022 Digital Bazaar, Inc. All rights reserved.
 */
import * as assert from './assert.js';
import canonicalize from 'canonicalize';
import pAll from 'p-all';

// `10` is chosen as the concurrency value because it is the lowest power of
// ten that is an acceptable number of concurrent web requests when pipelining
// may not be available (for remote credential stores)
const OPS_CONCURRENCY = 10;

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
   * @param {*} options.edv - A removed parameter, DO NOT USE.
   * @param {*} options.capability - A removed parameter, DO NOT USE.
   * @param {*} options.invocationSigner - A removed parameter, DO NOT USE.
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
    assert.object(edvClient, 'edvClient');
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
    // index to find the VCs that *directly* bundled a credential; bundles
    // may reference other VCs that are themselves bundles, but indirect
    // bundle membership is not tracked here
    edvClient.ensureIndex({attribute: 'meta.bundledBy'});
    // index to find by type
    edvClient.ensureIndex({attribute: ['content.type', 'meta.issuer']});
  }

  /**
   * Gets a verifiable credential by its ID.
   *
   * @param {object} options - The options to use.
   * @param {string} options.id - The ID of the credential.
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
   * Gets a bundle associated with a verifiable credential.
   *
   * @param {object} options - The options to use.
   * @param {string} [options.id] - The ID of the credential.
   * @param {object} [options.doc] - The decrypted EDV document for the
   *   credential.
   *
   * @returns {Promise<object>} The result: `{doc, bundle, allSubDocuments}`.
   */
  async getBundle({id, doc} = {}) {
    if(id && doc) {
      throw new Error('Only one of "id" or "docId" may be given.');
    }
    if(!(id || doc)) {
      throw new Error('Either "id" or "doc" must be given.');
    }

    if(id) {
      doc = await this.get({id});
    }

    if(!(doc.content.id && doc.meta.bundle)) {
      // no bundle associated with the doc
      return {doc, bundle: false, allSubDocuments: []};
    }

    const bundleResult = await this._getBundle({id});
    return {doc, ...bundleResult};
  }

  /**
   * Gets all verifiable credential instances that match the given parameters.
   *
   * @param {object} options - The options to use.
   * @param {object|Array} options.query - One or more query objects with
   *   `type`, `issuer`, `displayable`, and `bundledBy` filters.
   * @param {object} [options.options] - Query options such as `limit`.
   *
   * @returns {Promise<object>} The matching EDV documents as an array in
   *   `documents`.
   */
  async find({query, options = {}} = {}) {
    assert.objectOrArrayOfObjects(query, 'query');
    assert.object(options, 'options');

    // normalize query to an array of queries
    const queries = Array.isArray(query) ? query : [query];

    // build `equals` EDV query
    const equals = [];
    for(const q of queries) {
      assert.query(q, 'query');

      const {type, issuer, displayable, bundledBy} = q;
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
      if(bundledBy) {
        entry['meta.bundledBy'] = bundledBy;
      }
      equals.push(entry);
    }

    const q = {equals};
    if(options.limit !== undefined) {
      q.limit = options.limit;
    }
    if(options.count !== undefined) {
      q.count = options.count;
    }
    return this.edvClient.find(q);
  }

  /**
   * Converts a VPR query into a local query to run against `find()`.
   *
   * @param {object} options - The options to use.
   * @param {object} options.vprQuery - A Verifiable Presentation Request query
   *   (e.g. `{type: "QueryByExample", ...}`).
   *
   * @returns {Promise<object>} An object with `queries` set to an array where
   *   each element is a separate query to be passed to `find()`; the
   *   queries will be ordered such that they match the VPR query order; future
   *   versions may add additional properties to the returned object such as
   *   trusted issuer VCs.
   */
  async convertVPRQuery({vprQuery} = {}) {
    assert.object(vprQuery, 'vprQuery');
    const {type} = vprQuery;
    if(type === 'QueryByExample') {
      const {credentialQuery} = vprQuery;
      return this._convertQueryByExample({credentialQuery});
    }
    throw new Error(`Unsupported query type: "${type}"`);
  }

  /**
   * Stores a verifiable credential in EDV storage as the content an EDV
   * document. If `bundleContents` is passed, the credential will be marked
   * as a bundle and all sub-credentials will be upserted.
   *
   * @param {object} options - The options to use.
   * @param {object} options.credential - The credential to insert; it will be
   *   set as the `content` of the EDV document.
   * @param {object} [options.meta={}] - Custom meta data to set; the `issuer`
   *   field will be auto-populated if not set in the custom `meta`.
   * @param {Array} [options.bundleContents=[]] - Optional bundle contents if
   *   the credential is a bundle of other credentials; each element is an
   *   object:
   *   `{credential, meta, [bundleContents], [dependent=true]}` where
   *   `bundleContents` is an optional set of sub-bundle contents and
   *   `dependent` specifies whether the sub-credential will be deleted when
   *   all of its parent bundles are deleted (however, if a sub-credential was
   *   already in storage, it will not be changed to `dependent`).
   *
   * @returns {Promise<object>} - The stored EDV document.
   */
  async insert({credential, meta = {}, bundleContents}) {
    assert.object(credential, 'credential');
    assert.object(meta, 'meta');
    meta = {...meta};
    if(bundleContents !== undefined) {
      assert.bundleContents(bundleContents, 'bundleContents');
      // a VC without an ID cannot be a bundle
      if(!credential.id) {
        throw new Error(
          '"credential.id" must be a string to define a bundle.');
      }
      if(bundleContents.length > 0) {
        // VC is a bundle
        meta.bundle = true;
      }
    }
    if(!meta.issuer) {
      meta.issuer = _getIssuer({credential});
    }

    // insert the credential first (before any bundle contents), to help
    // ensure its contents can be deleted if adding the bundle contents
    // partially fails
    const result = await this.edvClient.insert({
      doc: {meta, content: credential}
    });

    // now add any bundle contents
    if(bundleContents && bundleContents.length > 0) {
      await this._addBundleContents({bundleId: credential.id, bundleContents});
    }

    return result;
  }

  /**
   * Upserts a verifiable credential in EDV storage, overwriting any previous
   * version if one exists. If `bundleContents` is passed, the credential will
   * be marked as a bundle and all sub-credentials will be upserted.
   *
   * @param {object} options - The options to use.
   * @param {object} options.credential - The credential to upsert; it will be
   *   set as the `content` of the EDV document; "credential.id" must be a
   *   string.
   * @param {object} [options.meta={}] - Custom meta data to set; the `issuer`
   *   field will be auto-populated if not set in the custom `meta`.
   * @param {Function} [options.mutator] - A function that takes the options
   *   `{doc, credential, meta}` and that is called if an existing credential
   *   is found and that must return the document to use to update the existing
   *   document; the default function will not overwrite an existing
   *   `credential` and will try to safely merge `meta` fields, this can be
   *   disabled by passing `false` to overwrite both `credential` and `meta`
   *   completely or a custom function can be passed.
   * @param {Array} [options.bundleContents=[]] - Optional bundle contents if
   *   the credential is a bundle of other credentials; each element is an
   *   object:
   *   `{credential, meta, [bundleContents], [dependent=true]}` where
   *   `bundleContents` is an optional set of sub-bundle contents and
   *   `dependent` specifies whether the sub-credential will be deleted when
   *   all of its parent bundles are deleted (however, if a sub-credential was
   *   already in storage, it will not be changed to `dependent`).
   *
   * @returns {Promise<object>} - The stored EDV document.
   */
  async upsert({
    credential, meta = {}, mutator = defaultMutator, bundleContents
  } = {}) {
    assert.object(credential, 'credential');
    assert.object(meta, 'meta');
    if(mutator !== undefined) {
      // mutator may be false or a function
      if(!(mutator === false || typeof mutator === 'function')) {
        throw new TypeError('"mutator" must be false or a function.');
      }
    }
    meta = {...meta};
    // `id` required to use `upsert`
    if(typeof credential.id !== 'string') {
      throw new TypeError('"credential.id" must be a string.');
    }
    if(bundleContents !== undefined) {
      assert.bundleContents(bundleContents, 'bundleContents');
      if(bundleContents.length > 0) {
        // VC is a bundle
        meta.bundle = true;
      }
    }
    if(!meta.issuer) {
      meta.issuer = _getIssuer({credential});
    }

    // upsert the credential first (before any bundle contents), to help
    // ensure its contents can be deleted if adding the bundle contents
    // partially fails

    // optimistically assume the credential is new (most VCs are) and try
    // to upsert it as a new doc; if that fails and it's found to already
    // exist, loop to try to update it; also loop if there are concurrent
    // updates to try the update again
    let doc;
    let isNew = true;
    let result;
    const retries = 10;
    for(let i = 0; i < retries; ++i) {
      if(isNew) {
        // try to create a new doc
        doc = {
          id: await this.edvClient.generateId(),
          content: credential, meta, sequence: 0
        };
      } else {
        // try to modify an existing doc
        if(mutator) {
          doc = await mutator({doc, credential, meta});
        } else {
          // no custom mutator so just overwrite directly
          doc.meta = meta;
          doc.content = credential;
        }
      }

      try {
        // try to update the doc in EDV storage; break on success
        result = await this.edvClient.update({doc});
        break;
      } catch(updateError) {
        // if the error was NOT caused by a concurrent update
        // (`InvalidStateError` which, btw, is only thrown when the doc isn't
        // new) nor by a duplicate new doc, then we can't handle it; throw
        if(!(updateError.name === 'InvalidStateError' ||
          (updateError.name === 'DuplicateError' && isNew))) {
          throw updateError;
        }

        // either a concurrent error occurred or the doc isn't actually new
        // like we predicted...
        try {
          // try to get a fresh copy of the doc
          doc = await this.get({id: credential.id});
          // got it, so doc is not new; loop to try to update it
          isNew = false;
          continue;
        } catch(e) {
          // if some error other than `NotFoundError` occurred then we can't
          // handle it gracefully; throw
          if(e.name !== 'NotFoundError') {
            throw e;
          }

          // doc doesn't exist and we were trying to insert it as new, which
          // means some field other than `credential.id` is in conflict and
          // therefore we can't add it, so throw the original duplicate error
          if(isNew) {
            throw updateError;
          }

          // a concurrent error must have occurred a moment ago and now the doc
          // doesn't exist; this is possible with EDV store errors or with EDV
          // implementations that do not use tombstones like they should), so
          // loop to try to be resilient and try to add it as new
          isNew = true;
        }
      }
    }

    if(!result) {
      // retries exhausted and no result
      throw new Error(
        `Failed to upsert credential "${credential.id}"; too many retries.`);
    }

    // now add any bundle contents
    if(bundleContents && bundleContents.length > 0) {
      await this._addBundleContents({bundleId: credential.id, bundleContents});
    }

    return result;
  }

  /**
   * Removes a verifiable credential identified by its ID or EDV doc ID (for
   * VCs that do not have IDs). If the credential is bundled by any other
   * credential or if the credential is a bundle and `deleteBundle=false`,
   * then an error will be thrown unless `force` is set to true.
   *
   * @param {object} options - The options to use.
   * @param {string} [options.id] - The ID of the credential.
   * @param {string} [options.docId] - The ID of the EDV document storing the
   *   credential.
   * @param {boolean} [options.deleteBundle=true] - If `true` and credential is
   *   a bundle, then any credentials that are part of it and depend on its
   *   existence (`meta.dependent=true`) will also be deleted.
   * @param {boolean} [options.force=false] - If `true` the credential will be
   *   forcibly deleted whether or not it is part of a bundle.
   *
   * @returns {Promise<object>} - An object with
   *   `{deleted: boolean, doc, bundle}` where `deleted` is set to true if
   *   anything was deleted; `doc` is only set if the deleted document was
   *   found and `bundle` is only set if a bundle was updated (an update will
   *   include unlinking the parent bundle from sub-bundles and, if any
   *   sub-credentials are dependent on parent bundles and no longer have any
   *   parents, they will be deleted as well).
   */
  async delete({id, docId, deleteBundle = true, force = false} = {}) {
    if(!(id || docId)) {
      throw new TypeError('Either "id" or "docId" must be a string.');
    }
    if(id && docId) {
      throw new Error('Only one of "id" or "docId" may be given.');
    }

    // loop to handle concurrent updates
    while(true) {
      try {
        return await this._delete({id, docId, deleteBundle, force});
      } catch(e) {
        if(e.name !== 'InvalidStateError') {
          throw e;
        }
        // loop to try again
      }
    }
  }

  // called from `insert` and `upsert` to add bundle contents
  async _addBundleContents({bundleId, bundleContents}) {
    // upsert all same-level bundle contents concurrently
    const actions = bundleContents.map(entry => {
      const {credential, meta = {}, bundleContents, dependent = true} = entry;
      return () => {
        const m = {...meta};
        if(dependent) {
          m.dependent = dependent;
        }
        // record that this VC is bundled by `bundleId`
        const set = new Set(m.bundledBy || []);
        set.add(bundleId);
        m.bundledBy = [...set];
        return this.upsert({credential, meta: m, bundleContents});
      };
    });
    await pAll(actions, {concurrency: OPS_CONCURRENCY, stopOnError: true});
  }

  // called from `delete` as a helper within a concurrent ops handling loop
  async _delete({id, docId, deleteBundle, force}) {
    let doc;
    let bundle;
    try {
      if(docId) {
        // fetch doc by `docId`
        try {
          doc = await this.edvClient.get({id: docId});
          id = doc.content.id;
        } catch(e) {
          if(e.name === 'NotFoundError') {
            return {deleted: false, doc, bundle};
          }
          throw e;
        }
      }

      // start fetching bundle
      let bundleResult;
      if(id) {
        bundleResult = this._getBundle({id}).catch(e => e);
      }

      if(!doc) {
        // fetch doc by `content.id`
        ({documents: [doc]} = await this.edvClient.find({
          equals: {'content.id': id}
        }));
      }

      // wait for bundle to be loaded
      bundleResult = await bundleResult;
      if(bundleResult instanceof Error) {
        throw bundleResult;
      }

      // if another VC bundles the VC to be deleted, then throw
      if(!force && doc && doc.meta.bundledBy &&
        doc.meta.bundledBy.length > 0) {
        const error = new Error(
          'Cannot delete credential; all other credentials that bundle it ' +
          'must be deleted first.');
        error.name = 'ConstraintError';
        throw error;
      }

      if(bundleResult.allSubDocuments.length > 0) {
        if(deleteBundle) {
          // delete / unlink the bundled docs first so if this operation
          // fails, a delete can be attempted again later
          ({bundle} = await this._deleteBundledDocs(bundleResult));
        } else if(!force) {
          const error = new Error(
            'Cannot delete credential; other credentials are bundled by it.');
          error.name = 'ConstraintError';
          throw error;
        }
      }

      if(!doc) {
        // no doc found
        return {deleted: !!bundle, doc, bundle};
      }

      await this.edvClient.delete({doc});
      return {deleted: true, doc, bundle};
    } catch(e) {
      if(e.name === 'NotFoundError') {
        return {deleted: !!bundle, doc, bundle};
      }
      throw e;
    }
  }

  // get all docs involved in a bundle
  async _getBundle({id} = {}) {
    // first, recursively load docs in bundles
    const bundle = {id, contents: []};
    const retrievedDocs = new Map();
    const bundles = new Map([[id, bundle]]);
    let bundleIds = [id];
    while(bundleIds.length > 0) {
      /* Note: Since this is an asynchronous and partitioned system, it is
      possible for two different EDV documents to be returned that have the
      same `content.id`. This does not mean that both documents had the same
      value in the database at the *same time* -- as uniqueness contraints
      prevents this. Rather, multiple queries for `content.id === X` run at
      different times may produce different document results if the documents
      containing those values are changing *concurrently*.

      For example, an operation to delete a credential bundle that contains `X`
      could be run concurrently with another operation to insert a bundle that
      contains `X` and yet another operation to delete a bundle containing `X`,
      etc. Under these conditions, the database may reach a less than ideal
      state, but it should be recoverable by finding and deleting the top-level
      bundle(s) connecting VCs together and finding and deleting any orphaned,
      dependent VCs.

      Code to do this automatically is not provided in the current version of
      this module. */

      // load all bundled docs with a single query
      const query = bundleIds.map(id => ({bundledBy: id}));
      const {documents: docs} = await this.find({query});
      bundleIds = [];
      for(const doc of docs) {
        // skip root bundle VC and any already retrieved docs
        if(doc.content.id === id || retrievedDocs.has(doc.id)) {
          continue;
        }

        // mark doc as retrieved
        retrievedDocs.set(doc.id, doc);

        // if the document is not itself a bundle, continue
        if(!(doc.content.id && doc.meta.bundle)) {
          continue;
        }

        // if a sub-bundle has already been created, continue
        if(bundles.has(doc.content.id)) {
          continue;
        }

        // add empty bundle and add bundle ID to fetch its contents
        bundles.set(doc.content.id, {id: doc.content.id, contents: []});
        bundleIds.push(doc.content.id);
      }
    }

    // second, now that all docs have been fetched, populate all bundles with
    // document references
    const allSubDocuments = [...retrievedDocs.values()];
    for(const doc of allSubDocuments) {
      // build reference to this document and any sub-bundle
      const ref = {doc};
      if(doc.content.id && doc.meta.bundle) {
        ref.bundle = bundles.get(doc.content.id);
      }

      // for every bundle in which this doc appears, add the reference
      const {meta: {bundledBy = []}} = doc;
      for(const bundleId of bundledBy) {
        const bundle = bundles.get(bundleId);
        // it is possible that the bundling VC is not part of the current
        // bundle (or erroneously does not exist in the database)
        if(bundle) {
          bundle.contents.push(ref);
        }
      }
    }

    return {bundle, allSubDocuments};
  }

  // delete or unlink bundled docs from the given bundle
  async _deleteBundledDocs({bundle} = {}) {
    // recursively iterate through bundle contents, stopping recursion at any
    // independent VCs
    let next = [bundle];
    const operationMap = new Map();
    const processedBundles = new Set();
    const bundleOps = new Set();
    const nonBundleOps = new Set();
    while(next.length > 0) {
      const current = next;
      next = [];
      for(const {id: bundleId, contents} of current) {
        processedBundles.add(bundleId);
        for(const {doc, bundle: subBundle} of contents) {
          // unlink `bundleId` from doc
          const set = new Set(doc.meta.bundledBy);
          set.delete(bundleId);
          if(set.size > 0) {
            // other VCs bundle this doc, so do not recurse into any
            // sub-bundles
            doc.meta.bundledBy = [...set];
          } else {
            // doc no longer bundled by any other VCs
            delete doc.meta.bundledBy;
          }

          // create op to update doc
          let op = operationMap.get(doc);
          if(!op) {
            operationMap.set(doc, op = {
              doc, type: 'update', before: new Set([bundleId])
            });
            // filter op into bundle / non-bundle ops set
            if(doc.meta.bundle) {
              bundleOps.add(op);
            } else {
              nonBundleOps.add(op);
            }
          } else {
            op.before.add(bundleId);
          }

          // if doc is either bundled by another VC or is not a dependent,
          // do not mark for deletion and do not recurse; note: an independent
          // VC is not to be deleted when all VCs that bundled it are deleted
          if(set.size > 0 || !doc.meta.dependent) {
            continue;
          }

          // mark doc as to be deleted instead of updated
          op.type = 'delete';

          // VC is dependent; if it has been processed yet and has a
          // sub-bundle, recurse
          if(subBundle && !processedBundles.has(doc.content.id)) {
            next.push(subBundle);
          }
        }
      }
    }

    // process all non-bundle ops in parallel
    try {
      await this._runOps({ops: [...nonBundleOps]});
    } catch(e) {
      if(e.name !== 'AggregateError') {
        throw e;
      }
      // if all of the errors are `InvalidStateError`, throw the first one
      if(e.errors.every(({name}) => name === 'InvalidStateError')) {
        throw e.errors[0];
      }
      // some errors were not invalid state, so throw the aggregate error
      // to stop the deletion process
      throw e;
    }

    /* Note: This could be further optimized by sorting bundle VCs into groups
    that can be deleted in parallel. A new version could add this optimization
    in the future. */

    // determine bundle deletion order
    const sorted = [...bundleOps].sort((a, b) => {
      // if `a` is before `b`, it comes first and vice versa
      if(a.before.has(b.doc.content.id)) {
        return -1;
      }
      if(b.before.has(a.doc.content.id)) {
        return 1;
      }
      return 0;
    });

    // run bundle ops in serial
    await this._runOps({ops: sorted, concurrency: 1, stopOnError: true});

    return {bundle};
  }

  async _convertQueryByExample({credentialQuery} = {}) {
    assert.objectOrArrayOfObjects(credentialQuery, 'credentialQuery');

    // normalize query to be an array
    const query = Array.isArray(credentialQuery) ?
      credentialQuery : [credentialQuery];

    // build local queries
    const queries = [];
    for(const q of query) {
      const {example, trustedIssuer = []} = q;
      assert.object(example, 'credentialQuery.example');

      const {type} = example;
      if(!(Array.isArray(type) || typeof type === 'string')) {
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

  async _runOps({ops, concurrency = OPS_CONCURRENCY, stopOnError = false}) {
    // try to run all operations to completion
    const actions = [];
    for(const op of ops) {
      const {doc} = op;
      if(op.type === 'update') {
        actions.push(() => this.edvClient.update({doc}));
      } else if(op.type === 'delete') {
        actions.push(() => this.edvClient.delete({doc}));
      } else {
        throw new Error(`Invalid operation type "${op.type}".`);
      }
    }
    await pAll(actions, {concurrency, stopOnError});
  }
}

// called when bundle contents are being upserted; must ensure that the bundle
// IDs from `meta.bundledBy` are added
export function defaultMutator({doc, credential, meta}) {
  // if credential is different, log a duplicate error, but do not overwrite;
  // preserve the original content
  // note: if a VC was concurrently deleted, this code path should not be hit
  // because it would trigger a conflict error and a retry -- which would not
  // find the same doc again by `content.id` if the VC was still deleted during
  // the retry
  if(canonicalize(doc.content) !== canonicalize(credential)) {
    console.error(
      `Credential ID "${credential.id}" is a duplicate and the previously ` +
      'stored credential does not match.', {
        old: doc.content,
        new: credential
      });
    /*const error = new Error('Duplicate credential.');
    error.name = 'DuplicateError';
    error.credentialId = credential.id;
    throw error;*/
  }

  // only update `doc.meta`, not `doc.content`
  const newMeta = {...doc.meta};
  for(const key in meta) {
    // skip certain meta keys for special handling
    if(key === 'bundledBy' || key === 'dependent') {
      continue;
    }
    newMeta[key] = meta[key];
  }

  // union `bundledBy`
  if(meta.bundledBy) {
    newMeta.bundledBy = _union(doc.meta.bundledBy, meta.bundledBy);
  }
  // only use the new `dependent` value if it is explicitly set to false; we
  // leave an existing value alone in the `true` case to preserve previously
  // set independence
  if(meta.dependent === false) {
    delete newMeta.dependent;
  }
  doc.meta = newMeta;
  return doc;
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

function _union(a1, a2) {
  if(!a1 || !a2) {
    return a1 || a2;
  }
  const s = new Set(a1);
  a2.forEach(s.add, s);
  return [...s];
}
