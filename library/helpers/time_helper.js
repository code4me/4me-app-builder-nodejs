'use strict';

class TimerHelper {
  formatDate(date) {
    return date.toISOString().slice(0, 10);
  }

  formatDateTime(date) {
    return `${date.toISOString().slice(0, -5)}Z`;
  }

  secondsToDurationText(secondsWithMs) {
    let seconds = Math.floor(secondsWithMs);
    // 2- Extract hours:
    let hours = Math.floor(seconds / 3600); // 3,600 seconds in 1 hour
    seconds = seconds % 3600; // seconds remaining after extracting hours
    // 3- Extract minutes:
    let minutes = Math.floor(seconds / 60); // 60 seconds in 1 minute
    // 4- Keep only seconds not extracted to minutes:
    seconds = seconds % 60;

    if (seconds < 10) {
      seconds = '0' + seconds;
    }

    if (hours > 0) {
      if (minutes < 10) {
        minutes = '0' + minutes;
      }
      return `${hours}:${minutes}:${seconds}`;
    } else {
      return `${minutes}:${seconds}`;
    }
  }

  getMsSinceEpoch() {
    return Date.now();
  }

  getMsSince(msSinceEpoch) {
    return this.getMsSinceEpoch() - msSinceEpoch;
  }

  async wait(milliseconds) {
    return await new Promise(resolve => setTimeout(resolve, milliseconds));
  }
}

module.exports = TimerHelper;