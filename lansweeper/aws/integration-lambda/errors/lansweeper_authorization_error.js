'use strict';

const LoggedError = require('../../../../library/helpers/errors/logged_error');

class LansweeperAuthorizationError extends LoggedError {
  constructor(message) {
    super(message);
  }
}

module.exports = LansweeperAuthorizationError;