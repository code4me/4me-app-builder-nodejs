'use strict';

const SizeHelper = require('../size_helper');
const helper = new SizeHelper();

describe('sum', () => {
  it('sums values', () => {
    expect(helper.sum([])).toEqual(0);
    expect(helper.sum([1, 2, 3, 4])).toEqual(10);
  });

  it('ignores null and undefined values', () => {
    expect(helper.sum([1, null, 2, undefined, 3, 40])).toEqual(46);
  });
});

describe('bytesToGB', () => {
  it('handlers 1024 * 1024 * 1024', () => {
    [4, 8, 16, 32, 64, 128, 256].forEach(r => {
      const result = helper.bytesToGB(r * 1024 * 1024 * 1024);
      expect(result).toEqual(r);
    });
  });

  it('handlers 1000 * 1024 * 1024', () => {
    [128, 256].forEach(r => {
      const result = helper.bytesToGB(r * 1000 * 1024 * 1024);
      expect(result).toEqual(r);
    });
  });

  it('handlers 1000 * 1000 * 1024', () => {
    [4, 8, 16, 32, 64, 128, 256].forEach(r => {
      const result = helper.bytesToGB(r * 1000 * 1000 * 1024);
      expect(result).toEqual(r);
    });
  });

  it('handlers 1000 * 1000 * 1000', () => {
    [4, 8, 16, 32, 64, 128, 256].forEach(r => {
      const result = helper.bytesToGB(r * 1000 * 1000 * 1000);
      expect(result).toEqual(r);
    });
  });

  it('handlers others', () => {
    let result = helper.bytesToGB(6.8 * 1024 * 1024 * 1024);
    expect(result).toEqual(7);

    result = helper.bytesToGB(6.5 * 1024 * 1024 * 1024);
    expect(result).toEqual(7);

    result = helper.bytesToGB(6.1 * 1024 * 1024 * 1024);
    expect(result).toEqual(6);
  });
});
