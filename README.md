# Bedrock Web Verifiable Credentials Store _(bedrock-web-vc-store)_

> A Javascript library for storing Verifiable Credentials for Bedrock web apps

## Table of Contents

- [Background](#background)
- [Install](#install)
- [Usage](#usage)
- [Contribute](#contribute)
- [Commercial Support](#commercial-support)
- [License](#license)

## Background

TBD

See also (related specs):

* [Verifiable Credentials Data Model](https://w3c.github.io/vc-data-model/)

## Install

To install locally (for development):

```
git clone https://github.com/digitalbazaar/bedrock-web-vc-store.git
cd bedrock-web-vc-store
npm install
```

## Usage

```js
import {getRemoteStorage} from 'bedrock-web-data-hub';
import VerifiableCredentialStore from 'bedrock-web-vc-store';

const hub = await getRemoteStorage({accountId: 'test'});

const vcStore = new VerifiableCredentialStore({hub});

await vcStore.insert({credential});
```

## Contribute

See [the contribute file](https://github.com/digitalbazaar/bedrock/blob/master/CONTRIBUTING.md)!

PRs accepted.

Small note: If editing the Readme, please conform to the
[standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## Commercial Support

Commercial support for this library is available upon request from
Digital Bazaar: support@digitalbazaar.com

## License

[Bedrock Non-Commercial License v1.0](LICENSE.md) © Digital Bazaar
