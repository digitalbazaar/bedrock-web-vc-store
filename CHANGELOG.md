# bedrock-web-vc-store ChangeLog

## 6.0.1 - 2022-02-13

### Fixed
- Fix allowing falsey `mutator` option.

## 6.0.0 - 2022-02-09

### Added
- Add `convertVPRQuery` helper to convert VPR queries into local queries that
  can be passed to `find()`. The only VPR query type presently supported is
  `QueryByExample`; the ability to register new conversion functions may
  be added in the future.
- Add indexes on `meta.displayable`, `meta.bundledBy`, and `content.type` to
  enable more queries.
- Add `upsert()` API for updating credentials based on `id`.
- Add the ability to insert credential "bundles". A credential bundle is a
  credential that "bundles" other credentials, creating meta data links
  between them such that if the credential bundle is deleted, the other
  credentials may be deleted as well. Credentials can be marked as "dependent"
  on the other credentials that bundle them, such that they will be deleted
  if all bundling credentials are also deleted.

### Changed
- **BREAKING**: The constructor for a `VerifiableCredentialStore` only
  takes one parameter now: `edvClient`. This interface must handle all
  `capability` / `invocationSigner` related business internally (if
  the edv client is for an HTTPS-based EDV.
- **BREAKING**: The `insert()` API returns the entire EDV document holding
  the VC.
- **BREAKING**: The `get()` API returns the entire EDV document holding
  the VC.
- **BREAKING**: The `find()` API returns the entire EDV documents holding
  the matching VCs.
- **BREAKING**: Use named export `VerifiableCredentialStore` instead of
  `default` export.

### Removed
- **BREAKING**: Removed the `match()` API. Instead, use `convertVPRQuery`
  to convert a Verifiable Presentation Request query into a local query that
  can be passed to `find()`. The results of `find()` can be run through
  external custom selector code to determine the best match for the query
  based on whatever algorithm the application calls for. This also simplifies
  this module's purpose by not having it provide these algorithms or a way to
  inject them into this module's functions to run internally; instead the new
  design separates these concerns.

## 5.1.0 - 2022-01-23

### Added
- Add ability to include a zcap with the authority to use an
  EDV's `/documents` API when constructing a
  `VerifiableCredentialStore` instance.

## 5.0.0 - 2021-07-12

### Changed
- **BREAKING**: Updates `get` API to return `content` and `meta`.

## 4.1.0 - 2021-07-09

### Changed
- Throw `NotSupportedError` when trustedIssuer.id is undefined.

## 4.0.1 - 2021-07-07

### Fixed
- Fix `_query()` and tests.

## 4.0.0 - 2021-06-15

### Changed
- **BREAKING**: Updates `find` API params to now only accept `query`.
- Updates `find` and `match` APIs to handle an array of `types`.

## 3.0.1 - 2021-05-06

### Changed
- Fix bug with `delete` function.

## 3.0.0 - 2021-03-26

### Changed
- **BREAKING**: Changed EDV indexing of credential documents.

## 2.0.0 - 2020-06-29

### Changed
- **BREAKING**: Use edv-client@4. This is a breaking change here because of
  changes in how edv-client serializes documents.

## 1.0.0 - 2020-03-06

### Changed
- See git history for changes.

## 0.1.0 - 2019-04-17

- See git history for changes previous to this release.
