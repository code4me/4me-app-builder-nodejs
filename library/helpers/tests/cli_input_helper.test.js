'use strict';

const promptly = require('promptly');
jest.mock('promptly');

const CliInputHelper = require('../cli_input_helper');

process.env.ENV_4ME = 'qa';

test('finds default values', () => {
  const cliHelper = new CliInputHelper(__dirname, 'cli_defaults', 'sub');

  const defaults = cliHelper.defaults;

  expect(defaults['skipQuestionWithDefault']).toEqual(true);
  expect(defaults['A']).toEqual('top A');
  expect(defaults['B']).toEqual('sub B');
  expect(defaults['c']).toEqual('qa c');
  expect(defaults['D']).toEqual(undefined);
});

describe('skip with defaults', () => {
  test('no prompt for defaulted value', async () => {
    const cliHelper = new CliInputHelper(__dirname);
    cliHelper.defaults['skipQuestionWithDefault'] = true;
    cliHelper.defaults['testQuestion'] = 'answer';

    const val = await cliHelper.prompt('testQuestion', 'my prompt message', {});

    expect(val).toEqual('answer');
  });

  test('prompt for defaulted value without skip', async () => {
    const cliHelper = new CliInputHelper(__dirname);
    cliHelper.defaults['skipQuestionWithDefault'] = false;
    cliHelper.defaults['testQuestion'] = 'answer';

    promptly.prompt.mockImplementationOnce(async (message, options) => {
      expect(message).toEqual('my prompt message: ');
      expect(options).toEqual({
                                "default": "answer",
                              });
      return 'typed answer';
    });

    const val = await cliHelper.prompt('testQuestion', 'my prompt message');

    expect(val).toEqual('typed answer');
  });
});

test('gatherInput', async () => {
  const cliHelper = new CliInputHelper(__dirname);
  cliHelper.defaults['skipQuestionWithDefault'] = true;
  cliHelper.defaults['testQuestion1'] = 'answer';

  promptly.prompt.mockImplementationOnce(async (message, options) => {
    expect(message).toEqual('Question 2: ');
    expect(options).toEqual({silent: true});
    return 'answer 2';
  });

  const val = await cliHelper.gatherInput({
                                            testQuestion1: 'Question 1',
                                            testQuestion2: {'Question 2': {silent: true}},
                                            testQuestion3: {'Question 3': {default: 'b'}},
                                          });

  expect(val.testQuestion1).toEqual('answer');
  expect(val.testQuestion2).toEqual('answer 2');
  expect(val.testQuestion3).toEqual('b');
});

