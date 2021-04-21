'use strict';

const crypto = require('crypto');

class TypeformHelper {

  convertResponseToNote(formResponse) {
    const formName = formResponse.definition.title;
    const questions = {};
    for (let field of formResponse.definition.fields) {
      questions[field.ref] = {type: field.type, title: field.title};
    }
    const answers = formResponse.answers;
    let note = `Received answer for "${formName}":`;
    for (let answer of answers) {
      const field = answer.field.ref;
      const type = questions[field].type;
      const title = questions[field].title;
      if (type === 'opinion_scale') {
        note += `\n - "${title}": ${answer.number}`;
      } else if (type === 'long_text' || type === 'short_text') {
        note += `\n - "${title}": ${answer.text}`;
      } else if (type === 'multiple_choice' || type === 'picture_choice') {
        note += `\n - "${title}": ${answer.choice.label}`;
      } else if (type === 'yes_no') {
        note += `\n - "${title}": ${answer.boolean ? 'Yes' : 'No'}`;
      } else if (type === 'rating') {
        note += `\n - "${title}": ${answer.number}`;
      } else if (type === 'phone_number') {
        note += `\n - "${title}": ${answer.phone_number}`;
      } else if (type === 'email') {
        note += `\n - "${title}": ${answer.email}`;
      } else if (type === 'date') {
        note += `\n - "${title}": ${answer.date}`;
      } else {
        this.log(`Unexpected answer type ${type} for ${title}`);
      }
    }
    return note;
  }

  isMessageValid(secret, expectedSig, body) {
    if (!body) return false;
    const hash = crypto.createHmac('sha256', secret)
      .update(body)
      .digest('base64');

    const actualSig = `sha256=${hash}`;
    return actualSig === expectedSig;
  }

  log(message, ...data) {
    if (data && data.length > 0) {
      console.log(message, ...data);
    } else {
      console.log(message);
    }
  }
}

module.exports = TypeformHelper;