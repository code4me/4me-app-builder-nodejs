'use strict';

const AppError = require('./app_error');

// application error that was previously logged
class LoggedError extends AppError {
  constructor(message) {
    super(message);
    this.isLogged = true;
  }
}

module.exports = LoggedError;