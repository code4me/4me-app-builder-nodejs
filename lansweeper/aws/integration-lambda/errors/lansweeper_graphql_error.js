'use strict';

const LoggedError = require('../../../../library/helpers/errors/logged_error');

class LansweeperGraphQLError extends LoggedError {
  constructor(message) {
    super(message);
  }
}

module.exports = LansweeperGraphQLError;