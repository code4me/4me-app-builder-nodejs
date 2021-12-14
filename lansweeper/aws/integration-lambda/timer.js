'use strict';

class Timer {
  constructor() {
    this.startTime = new Date();
    this.endTime = null;
  }

  stop() {
    this.endTime = new Date();
  }

  getDurationInSeconds() {
    return this.getDurationInMilliseconds() / 1000;
  }

  getDurationInMilliseconds() {
    return (this.endTime || new Date()).getTime() - this.startTime.getTime();
  }
}

module.exports = Timer;