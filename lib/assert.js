/*!
 * Copyright (c) 2019-2022 Digital Bazaar, Inc. All rights reserved.
 */
const VALID_QUERY_KEYS = [
  'bundledBy', 'displayable', 'id', 'issuer', 'type'
];

export {query, bundleContents, objectOrArrayOfObjects};

function query(x, name) {
  const keys = Object.keys(x);
  if(!keys.every(k => VALID_QUERY_KEYS.includes(k))) {
    throw new Error(
      `"${name}" keys must be one of: ${VALID_QUERY_KEYS.join(', ')}`);
  }
}

function bundleContents(x, name) {
  if(!Array.isArray(x)) {
    throw new TypeError(`"${name}" must be an array.`);
  }
  for(const entry of x) {
    if(!(entry && typeof entry === 'object')) {
      throw new TypeError('Each element in bundle contents must be an object.');
    }
    const {
      credential, meta = {}, bundleContents: subContents, dependent
    } = entry;
    if(!(credential && typeof credential === 'object')) {
      throw new TypeError(
        '"credential" in bundle contents must be an object.');
    }
    if(subContents) {
      bundleContents(subContents, 'bundleContents');
      if(!credential.id) {
        throw new Error('"credential.id" must be a string to define a bundle.');
      }
    }
    if(meta !== undefined && !(meta && typeof meta === 'object')) {
      throw new TypeError('"meta" in bundle contents must be an object.');
    }
    if(dependent !== undefined && typeof dependent !== 'boolean') {
      throw new TypeError('"dependent" in bundle contents must be a boolean.');
    }
  }
}

function objectOrArrayOfObjects(x, name) {
  if(!(x && typeof x === 'object' &&
    (!Array.isArray(x) || x.every(e => e && typeof e === 'object')))) {
    throw new TypeError(`"${name}" must be an array of objects or an object.`);
  }
}
