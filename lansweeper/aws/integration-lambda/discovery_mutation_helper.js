'use strict';

const LansweeperHelper = require('./lansweeper_helper');
const TimeHelper = require('../../../library/helpers/time_helper');
const LoggedError = require('../../../library/helpers/errors/logged_error');

class DiscoveryMutationHelper {
  constructor(referenceData) {
    this.referenceData = referenceData;
    this.lansweeperHelper = new LansweeperHelper();
    this.timeHelper = new TimeHelper();
    this.categories = [];
  }

  toDiscoveryUploadInput(assets) {
    assets.forEach(a => this.addCi(a));

    return {
      source: 'Lansweeper',
      referenceStrategies: {
        ciUserIds: {strategy: 'APPEND'},
      },
      physicalAssets: this.categories,
    };
  }

  addCi(asset) {
    const key = asset.key;
    if (!asset.assetCustom) {
      console.info(`Skipping ${key}. No assetCustom data available`);
      return;
    }
    if (asset.assetBasicInfo.type === 'Location') {
      console.info(`Skipping Location ${key}.`);
      return;
    }

    try {
      const ci = this.createCi(asset);
      const mappedProduct = this.mapProduct(asset);
      mappedProduct.configurationItems.push(ci);
    } catch (e) {
      console.error(`Error processing: ${key}`);
      throw new LoggedError(e);
    }
  }

  createCi(asset) {
    const ci = {
      sourceID: asset.key,
      name: asset.assetBasicInfo.name,
      serialNr: asset.assetCustom.serialNumber,
      systemID: asset.url,
      status: this.mapState(asset.assetCustom.stateName),
    };
    let puchaseDate = null;
    if (asset.assetCustom.purchaseDate) {
      puchaseDate = new Date(asset.assetCustom.purchaseDate);
      if (puchaseDate.getTime() > 0) {
        ci.inUseSince = this.timeHelper.formatDate(puchaseDate);
      }
    }
    if (asset.assetCustom.warrantyDate) {
      const warrantyDate = new Date(asset.assetCustom.warrantyDate);
      if (warrantyDate.getTime() > 0 && (!puchaseDate || puchaseDate <= warrantyDate)) {
        ci.warrantyExpiryDate = this.timeHelper.formatDate(warrantyDate);
      }
    }
    if (asset.allUsers) {
      const nodeIDs = asset.allUsers.map(u => this.mapUser(u)).filter(n => !!n);
      if (nodeIDs.length > 0) {
        ci.userIds = nodeIDs;
      }
    } else if (asset.assetBasicInfo.userName) {
      const userNodeID = this.mapUser(asset.assetBasicInfo.userName);
      if (userNodeID) {
        ci.userIds = [userNodeID];
      }
    }
    if (asset.softwares) {
      const softwareIDs = this.mapSoftware(asset.softwares);
      if (softwareIDs.length > 0) {
        ci.ciRelations = {childIds: softwareIDs};
      }
    }
    if (asset.operatingSystem && asset.operatingSystem.caption) {
      const softwareIDs = this.mapSoftwareName([asset.operatingSystem.caption]);
      if (softwareIDs.length > 0) {
        if (ci.ciRelations) {
          ci.ciRelations.childIds = ci.ciRelations.childIds.concat(softwareIDs)
        } else {
          ci.ciRelations = {childIds: softwareIDs}
        }
      }

    }
    return ci;
  }

  mapState(stateName) {
    switch (stateName) {
      case 'Active':
        return 'in_production';
      case "Don't show":
        return 'archived';
      case 'In repair':
        return 'being_repaired';
      case 'Non-active':
        return 'installed';
      case 'Spare':
        return 'standby_for_continuity';
      case 'Stock':
        return 'in_stock';
      case 'Stolen':
        return 'lost_or_stolen';
      default:
        return 'broken_down';
    }
  }

  mapUser(userName) {
    const name = userName;
    return this.referenceData.users.get(name);
  }

  mapSoftware(softwares) {
    return this.mapSoftwareName(softwares.map(s => s.name));
  }

  mapSoftwareName(softwareNames) {
    return softwareNames
      .map(n => this.lansweeperHelper.cleanupName(n))
      .map(n => this.referenceData.softwareCis.get(n))
      .filter(id => !!id);
  }

  mapProduct(asset) {
    const product = this.lansweeperHelper.getProduct(asset);
    if (!product.mapped) {
      product.mapped = {
        meta: {strategy: 'CREATE'},
        sourceID: product.reference,
        name: product.name,
        brand: product.brand,
        model: product.model,
        configurationItems: [],
      };
      const category = this.mapCategory(asset);
      this.addProduct(category, product.mapped);
    }

    return product.mapped;
  }

  mapCategory(asset) {
    const category = this.lansweeperHelper.getProductCategory(asset);
    if (!category.mapped) {
      category.mapped = {
        meta: {strategy: 'CREATE'},
        reference: category.reference,
        name: category.name,
        products: [],
      };
      this.categories.push(category.mapped);
    }
    return category.mapped;
  }

  addProduct(category, product) {
    if (category.products.indexOf(product) === -1) {
      category.products.push(product);
    }
  }
}

module.exports = DiscoveryMutationHelper;