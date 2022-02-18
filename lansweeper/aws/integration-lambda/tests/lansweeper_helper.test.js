'use strict';

const LansweeperHelper = require('../lansweeper_helper');
const assetArray = require('./assets/asset_array.json');

const helper = new LansweeperHelper();

describe('toReference', () => {
  it('replaces spaces', () => {
    const reference = helper.toReference('ESXi server');

    expect(reference).toEqual('esxi_server');
  });

  it('leaves numbers', () => {
    const reference = helper.toReference('server1');

    expect(reference).toEqual('server1');
  });

  it('removes duplicate _ and trims', () => {
    const reference = helper.toReference('VMware, Inc.');

    expect(reference).toEqual('vmware_inc');
  });

  it('limits length to 128 characters', () => {
    const reference = helper.toReference(' a'.repeat(65));

    // removes leading _ and trims, last _ is kept since it might be significant
    expect(reference.length).toEqual(128);
    expect(reference).toEqual('a_'.repeat(64));
  });
});

describe('getProduct', () => {
  it('handles undefined model and brand', () => {
    const asset = {
      assetCustom: {},
      assetBasicInfo: {type: 'Smart TV'},
    };
    const product = helper.getProduct(asset);

    expect(product.reference).toEqual('unknown_unknown_smart_tv');
    expect(product.model).toEqual('Unknown');
    expect(product.brand).toEqual('Unknown');
  });

  it('handles model and brand', () => {
    const asset1 = {
      assetCustom: {
        manufacturer: 'hp',
        model: 'DeskJet',
      },
      assetBasicInfo: {type: 'Printer'},
    };

    const asset2 = {
      assetCustom: {
        manufacturer: 'HP',
        model: 'deskjet',
      },
      assetBasicInfo: {type: 'printer'},
    };
    const product1 = helper.getProduct(asset1);
    const product2 = helper.getProduct(asset2);

    expect(product1).toBe(product2);
  });

  describe('handles SKU', () => {
    it('extracts SKU', () => {
      const asset1 = {
        assetCustom: {
          manufacturer: 'hp',
          model: 'DeskJet 550',
          sku: 'abc'
        },
        assetBasicInfo: {type: 'Printer'},
      };
      const product1 = helper.getProduct(asset1);

      expect(product1.sku).toBe('abc');
    });

    it('handles missing SKU', () => {
      const asset1 = {
        assetCustom: {
          manufacturer: 'hp',
          model: 'DeskJet 500'
        },
        assetBasicInfo: {type: 'Printer'},
      };
      const product1 = helper.getProduct(asset1);

      expect(product1.sku).toBeUndefined();
    });

    it('handles SKU found in some assets', () => {
      const asset1 = {
        assetCustom: {
          manufacturer: 'hp',
          model: 'DeskJet 530'
        },
        assetBasicInfo: {type: 'Printer'},
      };
      const product1 = helper.getProduct(asset1);
      expect(product1.name).toEqual('hp DeskJet 530 Printer');
      expect(product1.reference).toEqual('hp_deskjet_530_printer');
      expect(product1.sku).toBeUndefined();

      const asset2 = {
        assetCustom: {
          manufacturer: 'hp',
          model: 'DeskJet 530',
          sku: 'xyz'
        },
        assetBasicInfo: {type: 'Printer'},
      };
      const product2 = helper.getProduct(asset2);
      expect(product2).not.toBe(product1);
      expect(product2.name).toEqual('hp DeskJet 530 xyz Printer');
      expect(product2.reference).toEqual('hp_deskjet_530_xyz_printer');
      expect(product2.sku).toBe('xyz');

      const asset3 = {
        assetCustom: {
          manufacturer: 'hp',
          model: 'DeskJet 530'
        },
        assetBasicInfo: {type: 'Printer'},
      };
      const product3 = helper.getProduct(asset3);

      expect(product3.sku).toBeUndefined();
      expect(product3).toBe(product1);
    });
  });
});

describe('getBrand', () => {
  it('handles undefined', () => {
    const asset = {
      assetCustom: {},
    };
    const brand = helper.getBrand(asset);

    expect(brand).toEqual('Unknown');
  });

  it('case insensitive lookup', () => {
    const asset1 = {
      assetCustom: {
        manufacturer: 'hp',
      },
    };

    const asset2 = {
      assetCustom: {
        manufacturer: 'HP',
      },
    };
    const brand1 = helper.getBrand(asset1);
    const brand2 = helper.getBrand(asset2);

    expect(brand1).toBe(brand2);
  });
});

describe('getModel', () => {
  it('handles undefined', () => {
    const asset = {
      assetCustom: {},
    };
    const model = helper.getModel(asset);

    expect(model).toEqual('Unknown');
  });

  it('case insensitive lookup', () => {
    const asset1 = {
      assetCustom: {
        model: 'deskjet',
      },
    };

    const asset2 = {
      assetCustom: {
        model: 'DeskJet',
      },
    };
    const model1 = helper.getModel(asset1);
    const model2 = helper.getModel(asset2);

    expect(model1).toEqual(model2);
  });
});

describe('extractProductCategories', () => {
  it('handles empty', () => {
    const categories = helper.extractProductCategories([]);

    expect(categories).toEqual([]);
  });

  it('extracts unique values', () => {
    helper.categories = {};
    const categories = helper.extractProductCategories(assetArray);

    expect(categories.length).toEqual(13);
    expect(Object.keys(helper.categories).length).toEqual(categories.length);
  });
});

describe('extractBrands', () => {
  it('handles empty', () => {
    const brands = helper.extractBrands([]);

    expect(brands).toEqual([]);
  });

  it('extracts unique values', () => {
    helper.brands = {};
    const brands = helper.extractBrands(assetArray);

    expect(brands.length).toEqual(13);
    expect(Object.keys(helper.brands).length).toEqual(brands.length);
  });
});

describe('extractModels', () => {
  it('handles empty', () => {
    const models = helper.extractModels([]);

    expect(models).toEqual([]);
  });

  it('extracts unique values', () => {
    helper.models = {};
    const models = helper.extractModels(assetArray);

    expect(models.length).toEqual(15);
    expect(Object.keys(helper.models).length).toEqual(models.length);
  });
});

describe('extractUsers', () => {
  it('handles empty', () => {
    const users = helper.extractUserNames([]);

    expect(users).toEqual([]);
  });

  it('extracts unique values', () => {
    const users = helper.extractUserNames(assetArray);

    expect(users).toEqual(['jest', 'fred@4me.com', 'jest-test@4me.com']);

    const asset1 = assetArray.find(a => a._id === '612d9774aa105e2808be2db0');
    expect(asset1.allUsers).toEqual(['fred@4me.com', 'jest-test@4me.com']);

    const asset2 = assetArray.find(a => a._id === '612d977daa105e2808be8d77');
    expect(asset2.allUsers).toEqual(['jest', 'fred@4me.com']);
  });
});

describe('extractLastUserNames', () => {
  it('handles empty', () => {
    const users = helper.extractLastUserNames([]);

    expect(users).toEqual([]);
  });

  it('extracts unique values', () => {
    const users = helper.extractLastUserNames(assetArray);

    expect(users).toEqual(['jest', 'jest-test@4me.com']);
  });
});

describe('extractSoftwareNames', () => {
  it('handles empty', () => {
    const names = helper.extractSoftwareNames([]);

    expect(names).toEqual([]);
  });

  it('extracts unique values', () => {
    const names = helper.extractSoftwareNames(assetArray);

    expect(names.length).toEqual(99);
    // check whitespace is collapsed
    expect(names.indexOf('Microsoft Visual C++ 2010 x86 Runtime')).not.toEqual(-1);
    expect(names.indexOf('Microsoft Visual C++ 2010  x86 Runtime')).toEqual(-1);
  });
});

describe('extractOperatingSystemNames', () => {
  it('handles empty', () => {
    const names = helper.extractOperatingSystemNames([]);

    expect(names).toEqual([]);
  });

  it('extracts unique values', () => {
    const names = helper.extractOperatingSystemNames(assetArray);

    expect(names).toEqual(['Microsoft Windows Server 2012 R2 Standard',
                            'Linux 16.04',
                            'Microsoft Windows Server 2019 Standard Evaluation']);
  });
});
