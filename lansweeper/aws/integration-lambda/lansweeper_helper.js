'use strict';

class LansweeperHelper {
  constructor() {
    this.categories = {};
    this.brands = {};
    this.models = {};
    this.products = {};
  }

  extractProductCategories(assets) {
    return this.mapToUnique(assets, a => this.getProductCategory(a));
  }

  extractBrands(assets) {
    return this.mapToUnique(assets, a => this.getBrand(a));
  }

  extractModels(assets) {
    return this.mapToUnique(assets, a => this.getModel(a));
  }

  extractUserNames(assets) {
    const allUserNames = new Set();
    assets.forEach(a => {
      const assetUserNames = new Set();
      if (!!a.assetBasicInfo.userName) {
        assetUserNames.add(a.assetBasicInfo.userName);
      }
      if (!!a.users) {
        const names = a.users.filter(u => !!u.name && !LansweeperHelper.USERS_TO_IGNORE.has(u.name));
        names.map(u => !!u.email ? u.email : u.name)
          .forEach(u => assetUserNames.add(u));
        if (!!a.assetBasicInfo.userName) {
          // remove userName if we have an email for this user
          names.forEach(u => !!u.email && u.name === a.assetBasicInfo.userName && assetUserNames.delete(u.name));
        }
      }
      if (assetUserNames.size > 0) {
        a.allUsers = Array.from(assetUserNames);
        assetUserNames.forEach(u => allUserNames.add(u.toLowerCase()));
      }
    });
    const userNames = Array.from(allUserNames);
    console.info(`Found ${userNames.length} user names in ${assets.length} assets`);
    return userNames;
  }

  // only try to extract the last logged on user
  extractLastUserNames(assets) {
    let emailUserCount = 0;
    assets.filter(a => !!a.assetBasicInfo.userName && a.users)
      .forEach(a => {
        const username = a.assetBasicInfo.userName;
        const user = a.users.find(u => u.name === username && !!u.email);
        if (user) {
          a.assetBasicInfo.userName = user.email;
          emailUserCount++;
        }
      });
    const userNames = this.mapToUnique(assets, a => a.assetBasicInfo.userName);
    console.info(`Email found for ${emailUserCount} of ${userNames.length} users.`)
    return userNames;
  }

  extractSoftwareNames(assets) {
    const software = assets.flatMap(a => a.softwares).filter(s => !!s);
    return this.mapToUnique(software, s => this.cleanupName(s.name));
  }

  extractOperatingSystemNames(assets) {
    const oss = assets.map(a => a.operatingSystem).filter(os => !!os && !!os.caption);
    return this.mapToUnique(oss, os => this.cleanupName(os.caption));
  }

  cleanupName(name) {
    return name.replace(/\s+/g, ' ').trim();
  }

  getBrand(asset) {
    return this.getByReferenceOrAdd(this.brands, asset.assetCustom.manufacturer || 'Unknown');
  }

  getModel(asset) {
    return this.getByReferenceOrAdd(this.models, asset.assetCustom.model || 'Unknown');
  }

  getProduct(asset) {
    const category = this.getProductCategory(asset);
    const brand = this.getBrand(asset);
    const model = this.getModel(asset);
    const sku = asset.assetCustom.sku;
    const name = `${brand} ${model} ${sku ? `${sku} ` : ''}${category.name}`;
    const prod = this.getByReferenceOrAdd(this.products,
                                                      name,
                                                      (reference, name) => {
                                                        return {
                                                          name: name,
                                                          reference: reference,
                                                          model: model,
                                                          brand: brand,
                                                        };
                                                      });

    if (!prod.sku && asset.assetCustom.sku) {
      prod.sku = asset.assetCustom.sku;
    }

    return prod;
  }

  getProductCategory(asset) {
    return this.getByReferenceOrAdd(this.categories,
                                    asset.assetBasicInfo.type,
                                    (reference, assetType) => {
                                      return {
                                        name: assetType,
                                        reference: reference,
                                      };
                                    });
  }

  getByReferenceOrAdd(all, found, generator) {
    if (!found) {
      return found;
    }
    const ref = this.toReference(found);
    let known = all[ref];
    if (!known) {
      known = generator ? generator(ref, found) : found;
      if (known) {
        all[ref] = known;
      }
    }
    return known;
  }

  mapToUnique(assets, getFunction) {
    return assets.map(getFunction)
      .filter((v, i, a) => v && a.indexOf(v) === i);
  }

  toReference(value) {
    return value.toLowerCase()
      .replace(/[^a-z\d]+/g, '_')
      .replace(/^_?(.+?)_?$/g, '$1')
      .substring(0, 128);
  }
}

LansweeperHelper.USERS_TO_IGNORE = new Set((process.env.USERS_TO_IGNORE || 'Administrator;Guest;DefaultAccount;WDAGUtilityAccount').split(
  ';'));

module.exports = LansweeperHelper;