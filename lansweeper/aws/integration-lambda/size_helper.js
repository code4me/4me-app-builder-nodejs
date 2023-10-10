'use strict';

class SizeHelper {
  sum(values) {
    return values
      .filter(v => !!v)
      .reduce((a, b) => a + b, 0)
  }

  bytesToGB(totalSize) {
    for (const factor of SizeHelper.FACTORS) {
      const result = totalSize / factor;
      if (this.isPowerOfTwo(result)) {
        return result;
      }
    }
    for (const factor of SizeHelper.FACTORS) {
      const result = totalSize / factor;
      if (this.isWhole(result)) {
        return result;
      }
    }
    return Math.round(totalSize / SizeHelper.THREE_1024);
  }

  isPowerOfTwo(value) {
    return this.isWhole(Math.log2(value));
  }

  isWhole(value) {
    return value % 1 === 0;
  }
}

SizeHelper.THREE_1024 = 1024 * 1024 * 1024;
SizeHelper.TWO_1024 = 1000 * 1024 * 1024;
SizeHelper.ONE_1024 = 1000 * 1000 * 1024;
SizeHelper.THREE_1000 = 1000 * 1000 * 1000;
SizeHelper.FACTORS = [SizeHelper.THREE_1024, SizeHelper.TWO_1024, SizeHelper.ONE_1024, SizeHelper.THREE_1000];

module.exports = SizeHelper;
