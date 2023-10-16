# bedrock-web-vc-store ChangeLog

## 8.1.0 - 2023-10-TBD

### Changed
- Add `engines` to `package.json`.
- Use `canonicalize@2`. This version adds error handling for illegal numeric
  values: Infinite and NaN.

## 8.0.1 - 2023-09-13

### Fixed
- Ensure `meta` is spread when overwriting without mutator
  on upsert.

## 8.0.0 - 2022-08-19

### Changed
- **BREAKING**: Use `exports` instead of `module`.
- **BREAKING**: Require Web Crypto API exists for testing.
- Update dependencies.
- Lint module.

## 7.4.0 - 2022-08-11

### Added
- Add support for credentials without an `id` property. A new index
  on a new credential record property, `meta.id`, will be created and
  the `meta.id` property will be populated for all newly inserted or
  updated credentials. The `meta.id` property will be set to the
  `credential.id` value if present and a new UUID URN if not.

## 7.3.2 - 2022-06-03

### Fixed
- Fix aggregate error check.

## 7.3.1 - 2022-06-03

### Fixed
- Allow for aggregate error without `.errors` field properly set.

## 7.3.0 - 2022-06-03

### Added
- Add `addBundleContentsFirst` option to allow control of when bundle
  contents are inserted / upserted relative to the bundling VC. By
  default (and for backwards compatibility) this flag is set to
  `false`. A future breaking version may set it to `true` by default
  if it proves to be a better option most of the time.

## 7.2.0 - 2022-06-03

### Added
- Add `created` and `updated` dates in meta to stored VC docs.

## 7.1.0 - 2022-05-20

### Added
- Add credential cache that can be used via `useCache: true` on `get()`.

### Changed
- Improve performance when adding credentials by better guessing whether
  the credential will be new or not.

## 7.0.0 - 2022-04-10

### Changed
- **BREAKING**: Rename package to `@bedrock/web-vc-store`.
- **BREAKING**: Convert to module (ESM).

## 6.0.2 - 2022-02-13

### Fixed
- Force `mutator` to be `false` not just falsey to avoid bugs.

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
