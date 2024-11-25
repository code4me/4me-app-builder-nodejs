'use strict';

const ResultHelper = require('../result_helper');

const helper = new ResultHelper();

describe('cleanupResult', () => {
  it('removes empty values', () => {
    expect(helper.cleanupResult({uploadCount: {}, info: {}, errors: {}, kept: 'a'}))
      .toEqual({kept: 'a'});

    expect(helper.cleanupResult({uploadCount: [], info: null, errors: undefined, kept: 'a'}))
      .toEqual({kept: 'a'});

    expect(helper.cleanupResult({uploadCount: '', kept: 'a'}))
      .toEqual({kept: 'a'});
  });

  it('keeps filled values', () => {
    expect(helper.cleanupResult({uploadCount: 4, info: 'b', errors: ['a']}))
      .toEqual({uploadCount: 4, info: 'b', errors: ['a']});

    expect(helper.cleanupResult({uploadCount: {a: 'a'}, info: {b: 'b'}, errors: {c: []}}))
      .toEqual({uploadCount: {a: 'a'}, info: {b: 'b'}, errors: {c: []}});

    expect(helper.cleanupResult({uploadCount: 0, info: 'b', errors: ['a']}))
      .toEqual({uploadCount: 0, info: 'b', errors: ['a']});
  });
});
