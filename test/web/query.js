
const query1 = {
  type: 'QueryByExample',
  credentialQuery: [{
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
    /*
    trustedIssuer: [{
      required: true,
      issuer: 'urn:some:required:issuer'
    }],
    issuerQuery: [<another query by example for a VC for the
      issuer if using delegated trust>]
    */
  }]
};


const query2 = {
  type: 'QueryByExample',
  credentialQuery: [{
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
    trustedIssuer: [{
      required: true,
      issuer: 'https://example.edu/issuers/565049'
    }],
    /*
    issuerQuery: [<another query by example for a VC for the
      issuer if using delegated trust>]
    */
  }]
};

export default {
  query1,
  query2
};
