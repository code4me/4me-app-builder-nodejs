'use strict';

const LansweeperHelper = require('./lansweeper_helper');
const LoggedError = require('../../../library/helpers/errors/logged_error');

class ReferencesHelper {
  constructor(customer4meHelper) {
    this.lansweeperHelper = new LansweeperHelper();
    this.customer4meHelper = customer4meHelper;

    this.allSoftware = null;
    this.allOperatingSystems = [];
    this.osEndOfSupports = new Map();
    this.softwareFound = new Map();
    this.softwareNotFound = [];
    this.allPeople = null;
    this.peopleFound = new Map();
    this.peopleNotFound = [];
  }

  async lookup4meReferences(assets) {
    const accessToken = await this.customer4meHelper.getToken();

    return {
      softwareCis: await this.getSoftwareReferences(accessToken, assets),
      users: await this.getUserReferences(accessToken, assets),
    };
  }

  async getSoftwareReferences(accessToken, assets) {
    const softwareNames = this.lansweeperHelper.extractSoftwareNames(assets);
    const osNames = this.lansweeperHelper.extractOperatingSystemNames(assets);
    this.allOperatingSystems = Array.from(new Set([...this.allOperatingSystems, ...osNames]));

    const endOfSupports = this.lansweeperHelper.extractOperatingSystemEndOfSupport(assets);
    for (const item of endOfSupports) {
      this.osEndOfSupports.set(...item);
    }

    const names = new Set([...osNames, ...softwareNames]);
    return await this.getSoftwareNameToIdMap(Array.from(names), accessToken);
  }

  async getUserReferences(accessToken, assets) {
    const userNames = this.lansweeperHelper.extractUserNames(assets);
    return await this.getUserNameToIdMap(userNames, accessToken);
  }

  async getSoftwareNameToIdMap(softwareNames, accessToken) {
    const softwareToFind = softwareNames.filter(n => !this.softwareFound.has(n) && !this.softwareNotFound.includes(n));
    if (softwareToFind.length === 0) {
      return this.softwareFound;
    }

    const allCis = await this.lookupAllSoftware(accessToken);
    if (allCis.error) {
      console.error('Error querying software references:\n%j', allCis);
      throw new LoggedError('Unable to query 4me software data');
    }
    return this.findSoftwareIds(softwareToFind, allCis);
  }

  async getUserNameToIdMap(userNames, accessToken) {
    const allPeopleToFind = userNames.filter(n => !this.peopleFound.has(n) && !this.peopleNotFound.includes(n));
    let peopleToFind = allPeopleToFind;
    while (peopleToFind.length > 0) {
      const extraPeopleToFind = peopleToFind.slice(ReferencesHelper.maxPeopleCount);

      peopleToFind = peopleToFind.slice(0, ReferencesHelper.maxPeopleCount);
      const newPeople = await this.findPeopleByUsername(accessToken, peopleToFind);
      if (newPeople.error) {
        console.error('Error querying user references:\n%j', peopleToFind);
        throw new LoggedError('Unable to query 4me people data');
      }

      peopleToFind = extraPeopleToFind;
    }
    this.peopleNotFound.push(...allPeopleToFind.filter(userName => !this.peopleFound.has(userName)));
    return this.peopleFound;
  }

  async lookupAllSoftware(accessToken) {
    if (this.allSoftware) {
      return this.allSoftware;
    }

    const query = `query($statuses: [CiStatus!]!, $previousEndCursor: String) {
      configurationItems(first: 100, after: $previousEndCursor,
                         filter: {ruleSet: {values: [software]}, status: {values: $statuses}}) {
        pageInfo { hasNextPage endCursor }
        nodes { id name alternateNames }
      }
    }`;

    const software = await this.customer4meHelper.reducePagedGraphQLQuery('All software lookup',
                                                                          accessToken,
                                                                          query,
                                                                          {statuses: ReferencesHelper.acceptableSoftwareStatuses});
    if (!software.error) {
      software.forEach(s => {
        s.name = this.lansweeperHelper.cleanupName(s.name);
        if (s.alternateNames) {
          s.alternateNames = s.alternateNames.map(n => this.lansweeperHelper.cleanupName(n));
        }
      });
      this.allSoftware = software;
    }
    return software;
  }

  async findPeopleByUsername(accessToken, userNames) {
    if (userNames.length > ReferencesHelper.maxPeopleCount) {
      const error = `Too many usernames for single lookup: ${userNames.length}`;
      console.error(error);
      return {error: error};
    }

    const fields = ReferencesHelper.peopleFields.split(' ');
    const queries = [];
    fields.forEach(field => {
      queries.push(`${field}: people(first: ${ReferencesHelper.maxPeopleCount}, view: all, filter: {${field}: {values: $names}, disabled: false}) {
                      nodes { userName: ${field} id }
                    }`);
    });
    const query = `query($names: [String!]!) {
${queries.join('\n')}
    }`;

    const result = await this.customer4meHelper.getGraphQLQuery('People by username',
                                                                accessToken,
                                                                query,
                                                                {names: userNames});
    if (result.error) {
      return result;
    }

    fields.forEach(field => {
      result[field].nodes
        .filter(node => !!node)
        .forEach(node => {
          const lowerCaseName = node.userName.toLowerCase();
          if (!this.peopleFound.has(lowerCaseName)) {
            this.peopleFound.set(lowerCaseName, node.id);
          }
        });
    });

    return this.peopleFound;
  }

  async lookupAllPeople(accessToken) {
    if (this.allPeople) {
      return this.allPeople;
    }

    const query = `query($previousEndCursor: String) {
      people(view: all, first: ${ReferencesHelper.maxPeopleCount}, after: $previousEndCursor) {
        pageInfo { hasNextPage endCursor }
        nodes { id ${ReferencesHelper.peopleFields} }
      }
    }`;

    const people = await this.customer4meHelper.reducePagedGraphQLQuery('All people lookup',
                                                                        accessToken,
                                                                        query);
    if (!people.error) {
      this.allPeople = people;
    }
    return people;
  }

  findSoftwareIds(softwareToFind, allCis) {
    softwareToFind.forEach(name => {
      const hit = allCis.find(p => p.name === name || (p.alternateNames && p.alternateNames.includes(name)));
      if (hit) {
        this.softwareFound.set(name, hit.id);
      } else {
        this.softwareNotFound.push(name);
      }
    });
    return this.softwareFound;
  }

  findUserIds(peopleToFind, allPeople) {
    const fields = ReferencesHelper.peopleFields.split(' ');
    peopleToFind.forEach(userName => {
      const hit = allPeople.find(p => {
        for (const field of fields) {
          if (p[field] === userName) {
            return true;
          }
        }
        return false;
      });
      if (hit) {
        this.peopleFound.set(userName, hit.id);
      } else {
        this.peopleNotFound.push(userName);
      }
    });
    return this.peopleFound;
  }
}

ReferencesHelper.acceptableSoftwareStatuses = ['reserved', 'being_built', 'installed', 'being_tested', 'standby_for_continuity', 'in_production'];
ReferencesHelper.peopleFields = 'authenticationID primaryEmail sourceID employeeID supportID';
ReferencesHelper.maxPeopleCount = 100;

module.exports = ReferencesHelper;
