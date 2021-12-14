'use strict';

const LoggedError = require('./logged_error');

class Js4meAuthorizationError extends LoggedError {
  constructor(message) {
    super(message);
  }
}

module.exports = Js4meAuthorizationError;