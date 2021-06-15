/*!
 * Copyright (c) 2019-2020 Digital Bazaar, Inc. All rights reserved.
 */

/* eslint-disable quotes, quote-props, max-len */

// https://w3c.github.io/vc-data-model/#example-1-a-simple-example-of-a-verifiable-credential
const AlumniCredential = {
  // set the context, which establishes the special terms we will be using
  // such as 'issuer' and 'alumniOf'.
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://www.w3.org/2018/credentials/examples/v1",
    "https://w3id.org/security/ed25519-signature-2020/v1"
  ],
  // specify the identifier for the credential
  "id": "http://example.edu/credentials/1872",
  // the credential types, which declare what data to expect in the credential
  "type": [
    "VerifiableCredential",
    "AlumniCredential"
  ],
  // the entity that issued the credential
  "issuer": "https://example.edu/issuers/565049",
  // when the credential was issued
  "issuanceDate": "2010-01-01T19:73:24Z",
  // claims about the subjects of the credential
  "credentialSubject": {
    // identifier for the only subject of the credential
    "id": "did:example:ebfeb1f712ebc6f1c276e12ec21",
    // assertion about the only subject of the credential
    "alumniOf": "<span lang='en'>Example University</span>"
  },
  // digital proof that makes the credential tamper-evident
  "proof": {
    // the cryptographic signature suite that was used to generate the signature
    "type": "Ed25519Signature2020",
    // the date the signature was created
    "created": "2020-05-18T21:19:10Z",
    "proofPurpose": "assertionMethod",
    "proofValue": "z3vG9cHevmrtMiTfb8e7qSPtKyZz1ziPbcxePqcYJ5Rtx5asWsHFq6rPfj8GaPxXkYqvb7qu2dFYg9amc1dpqQhsY",
    "verificationMethod": "https://example.edu/issuers/565049#z6MkjLrk3gKS2nnkeWcmcxiZPGskmesDpuwRBorgHxUXfxnG"
  }
};

export default {
  AlumniCredential
};
