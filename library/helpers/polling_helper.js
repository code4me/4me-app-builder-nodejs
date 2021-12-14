'use strict';

const TimeHelper = require('./time_helper');

class PollingHelper {
  constructor() {
    this.timeHelper = new TimeHelper();
  }

  async poll(interval, maxWait, providerFunction) {
    const pollStart = this.timeHelper.getMsSinceEpoch();
    let timeRemaining = maxWait;
    while (timeRemaining > 0) {
      const callStart = this.timeHelper.getMsSinceEpoch();
      const result = await providerFunction(timeRemaining);
      if (result) {
        return result;
      } else {
        const callDuration = this.timeHelper.getMsSince(callStart);
        await this.timeHelper.wait(interval - callDuration);
        timeRemaining = maxWait - this.timeHelper.getMsSince(pollStart);
      }
    }
    return {error: `No result available after ${this.timeHelper.getMsSince(pollStart)}ms`};
  }
}

module.exports = PollingHelper;