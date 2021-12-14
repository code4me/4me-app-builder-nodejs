const fs = require('fs');

exports.loadTestCredentials = (credentialFile) => {
  if (!fs.existsSync(credentialFile)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(credentialFile, 'utf8'));
};
