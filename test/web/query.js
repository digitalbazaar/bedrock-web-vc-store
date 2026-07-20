/*!
 * Copyright (c) 2019-2026 Digital Bazaar, Inc.
 */
const queryWithMatchingAcceptedIssuers = {
  type: 'QueryByExample',
  credentialQuery: {
    required: true,
    example: {
      '@context': [
        'https://w3id.org/credentials/v1',
        'urn:poc:schema:1234'
      ],
      type: 'AlumniCredential',
      credentialSubject: {
        id: ''
      },
      // Note: No hard schema required at this time.
      /*
      credentialSchema: {
        id: 'urn:foo:1234'
        type: 'SomeType'
      }*/
    },
    // Note: This credential can be self-issued here
    acceptedIssuers: [{
      id: 'https://example.edu/issuers/565049'
    }]
  }
};

export {
  queryWithMatchingAcceptedIssuers
};
