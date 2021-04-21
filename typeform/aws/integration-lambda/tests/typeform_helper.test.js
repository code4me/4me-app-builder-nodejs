'use strict';

const TypeformHelper = require('../typeform_helper');
const event = require('../../events/typeform.event.json');
const event2 = require('../../events/typeform-2.event.json');

it('validates correct sig', () => {
  const typeformHelper = new TypeformHelper();

  expect(typeformHelper.isMessageValid('12345', 'sha256=60tDohE1q/MNqqtgc0RGwuX9yl5U1R1ucsOObokayE0=', event.body))
    .toBe(true);
});

it('detects message with incorrect hash', () => {
  const typeformHelper = new TypeformHelper();

  expect(typeformHelper.isMessageValid('123', 'sha256=60tDohE1q/MNqqtgc0RGwuX9yl5U1R1ucsOObokayE0=', event.body))
    .toBe(false);
});

it('detects message without hash', () => {
  const typeformHelper = new TypeformHelper();

  expect(typeformHelper.isMessageValid('12345', null, event.body))
    .toBe(false);
});

it('rejects message without body', () => {
  const typeformHelper = new TypeformHelper();

  expect(typeformHelper.isMessageValid('12345', 'sha256=60tDohE1q/MNqqtgc0RGwuX9yl5U1R1ucsOObokayE0=', null))
    .toBe(false);
});

it('creates note', () => {
  const typeformHelper = new TypeformHelper();

  const note = typeformHelper.convertResponseToNote(extractFormResponse(event));
  expect(note).toEqual('Received answer for "Customer Satisfaction Survey":\n' +
                         ' - "Overall, how likely are you to recommend our products to a friend or colleague?": 6\n' +
                         ' - "And finally, could you kindly tell us why you chose {{field:4f1861efe534f62e}}?": asdasd');
});

it('creates note for more complex form response', () => {
  const typeformHelper = new TypeformHelper();

  const note = typeformHelper.convertResponseToNote(extractFormResponse(event2));
  expect(note).toEqual('Received answer for "PSO_Feedback":\n' +
                         ' - "What is the answer to the Ultimate Question of Life, the Universe, and Everything?": 42\n' +
                         ' - "Are You Not Entertained?": Yes\n' +
                         ' - "How dead are you on the inside after that question?": 3\n' +
                         ' - "Call me? Please?": +48512345678\n' +
                         ' - "Type "I\'m Batman" - with correct voice in your head": qweasd\n' +
                         ' - "Type something long. Not the p word...": qweqweqweqwe\n' +
                         ' - "Choose wisely": DC\n' +
                         ' - "Where do you want all the spam?": qeqwe@weqw.pl\n' +
                         ' - "When i the cake time?": 1212-12-12'
  )
  ;
});

function extractFormResponse(event) {
  const body = JSON.parse(event.body);
  return body.form_response;
}