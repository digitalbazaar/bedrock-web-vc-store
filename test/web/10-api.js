/*!
 * Copyright (c) 2019-2020 Digital Bazaar, Inc. All rights reserved.
 */

import {EdvClient} from 'edv-client';
import VerifiableCredentialStore from 'bedrock-web-vc-store';
const credentialStore = new VerifiableCredentialStore({
  edv: new EdvClient()
});

describe('vc store API', () => {
  describe('some API', () => {
    describe('authenticated request', () => {
      it('does something incorrectly', async () => {
        let result;
        let err;
        try {
          result = await credentialStore.get();
        } catch(e) {
          err = e;
        }
        should.not.exist(result);
        should.exist(err);
      });
    }); // end authenticated request
  }); // end create
});
