'use strict';

const Js4meDeployHelper = require('../js_4me_deploy_helper');

describe('grouping automation rules by record type', () => {
  test('rules with same generic value', () => {
    const jsHelper = new Js4meDeployHelper();
    const existingRules = [
      {
        "id": "abc",
        "name": "Trigger webhook for each note added",
        "generic": "request"
      },
      {
        "id": "def",
        "name": "Trigger webhook for status changed",
        "generic": "request"
      },
    ];
    const inputRules = [
      {
        "name": "Trigger webhook for each note added updated",
        "generic": "request"
      },
    ];
    const grouped = jsHelper.groupOfferingAutomationRules(existingRules, inputRules);
    expect(Object.keys(grouped)).toEqual(['request']);
    expect(grouped['request']).toEqual([existingRules, [null, null, ...inputRules]]);
  });

  test('rules with different generic value', () => {
    const jsHelper = new Js4meDeployHelper();
    const existingRules = [
      {
        "id": "abc",
        "name": "Trigger webhook for each note added",
        "generic": "request"
      },
      {
        "id": "def",
        "name": "Trigger webhook for status changed",
        "generic": "request"
      },
    ];
    const inputRules = [
      {
        "name": "Trigger webhook for each note added updated",
        "generic": "task"
      },
    ];
    const grouped = jsHelper.groupOfferingAutomationRules(existingRules, inputRules);
    expect(Object.keys(grouped)).toEqual(['request', 'task']);
    expect(grouped['request']).toEqual([existingRules, [null, null]]);
    expect(grouped['task']).toEqual([[], inputRules]);
  });

  test('all new rules', () => {
    const jsHelper = new Js4meDeployHelper();
    const inputRules = [
      {
        "name": "Trigger webhook for each note added updated",
        "generic": "task"
      },
    ];
    const grouped = jsHelper.groupOfferingAutomationRules(null, inputRules);
    expect(Object.keys(grouped)).toEqual(['task']);
    expect(grouped['task']).toEqual([[], inputRules]);
  });

  test('remove all current rules', () => {
    const jsHelper = new Js4meDeployHelper();
    const existingRules = [
      {
        "id": "abc",
        "name": "Trigger webhook for each note added",
        "generic": "request"
      },
      {
        "id": "def",
        "name": "Trigger webhook for status changed",
        "generic": "request"
      },
    ];
    const grouped = jsHelper.groupOfferingAutomationRules(existingRules, null);
    expect(Object.keys(grouped)).toEqual(['request']);
    expect(grouped['request']).toEqual([existingRules, [null, null]]);
  });

  test('mixed rules remove first', () => {
    const jsHelper = new Js4meDeployHelper();
    const existingRules = [
      {
        "id": "abc",
        "name": "Trigger webhook for each note added",
        "generic": "request"
      },
      {
        "id": "xyz",
        "name": "Trigger webhook for each note added updated",
        "generic": "request"
      },
      {
        "id": "def",
        "name": "Trigger webhook for status changed",
        "generic": "task"
      },
    ];
    const inputRules = [
      {
        "name": "Trigger webhook for each note added updated",
        "generic": "request"
      },
      {
        "name": "Trigger webhook for status changed",
        "generic": "task"
      },
    ];
    const grouped = jsHelper.groupOfferingAutomationRules(existingRules, inputRules);
    expect(Object.keys(grouped)).toEqual(['request', 'task']);
    expect(grouped['request']).toEqual([[existingRules[0], existingRules[1]], [null, inputRules[0]]]);
    expect(grouped['task']).toEqual([[existingRules[2]], [inputRules[1]]]);
  });

  test('mixed rules remove one', () => {
    const jsHelper = new Js4meDeployHelper();
    const existingRules = [
      {
        "id": "abc",
        "name": "Trigger webhook for each note added",
        "generic": "request"
      },
      {
        "id": "xyz",
        "name": "Trigger webhook for each note added updated",
        "generic": "request"
      },
      {
        "id": "def",
        "name": "Trigger webhook for status changed",
        "generic": "task"
      },
    ];
    const inputRules = [
      {
        "name": "Trigger webhook for each note added",
        "generic": "request"
      },
      {
        "name": "Trigger webhook for status changed",
        "generic": "task"
      },
    ];
    const grouped = jsHelper.groupOfferingAutomationRules(existingRules, inputRules);
    expect(Object.keys(grouped)).toEqual(['request', 'task']);
    expect(grouped['request']).toEqual([[existingRules[0], existingRules[1]], [inputRules[0], null]]);
    expect(grouped['task']).toEqual([[existingRules[2]], [inputRules[1]]]);
  });

  test('mixed rules add one', () => {
    const jsHelper = new Js4meDeployHelper();
    const existingRules = [
      {
        "id": "abc",
        "name": "Trigger webhook for each note added",
        "generic": "request"
      },
      {
        "id": "def",
        "name": "Trigger webhook for status changed",
        "generic": "task"
      },
    ];
    const inputRules = [
      {
        "name": "Trigger webhook for each note added",
        "generic": "request"
      },
      {
        "name": "Trigger webhook for each note added extra",
        "generic": "request"
      },
      {
        "name": "Trigger webhook for status changed",
        "generic": "task"
      },
    ];
    const grouped = jsHelper.groupOfferingAutomationRules(existingRules, inputRules);
    expect(Object.keys(grouped)).toEqual(['request', 'task']);
    expect(grouped['request']).toEqual([[existingRules[0]], [inputRules[0], inputRules[1]]]);
    expect(grouped['task']).toEqual([[existingRules[1]], [inputRules[2]]]);
  });

  test('mixed rules remove all one type', () => {
    const jsHelper = new Js4meDeployHelper();
    const existingRules = [
      {
        "id": "abc",
        "name": "Trigger webhook for each note added",
        "generic": "request"
      },
      {
        "id": "xyz",
        "name": "Trigger webhook for each note added updated",
        "generic": "request"
      },
      {
        "id": "def",
        "name": "Trigger webhook for status changed",
        "generic": "task"
      },
    ];
    const inputRules = [
      {
        "name": "Trigger webhook for status changed",
        "generic": "task"
      },
    ];
    const grouped = jsHelper.groupOfferingAutomationRules(existingRules, inputRules);
    expect(Object.keys(grouped)).toEqual(['request', 'task']);
    expect(grouped['request']).toEqual([[existingRules[0], existingRules[1]], [null, null]]);
    expect(grouped['task']).toEqual([[existingRules[2]], [inputRules[0]]]);
  });

  test('non generic rules', () => {
    const jsHelper = new Js4meDeployHelper();
    const existingRules = [
      {
        "id": "abc",
        "name": "Trigger webhook for each note added",
      },
      {
        "id": "xyz",
        "name": "Trigger webhook for each note added updated",
      },
    ];
    const inputRules = [
      {
        "name": "Trigger webhook for status changed",
      },
    ];
    const grouped = jsHelper.groupOfferingAutomationRules(existingRules, inputRules);
    expect(Object.keys(grouped)).toEqual(['undefined']);
    expect(grouped['undefined']).toEqual([[existingRules[0], existingRules[1]], [null, null, inputRules[0]]]);
  });

  test('no rules', () => {
    const jsHelper = new Js4meDeployHelper();
    const grouped = jsHelper.groupOfferingAutomationRules([], []);
    expect(Object.keys(grouped)).toEqual([]);
    expect(grouped).toEqual({});
  });

  test('null rules', () => {
    const jsHelper = new Js4meDeployHelper();
    const grouped = jsHelper.groupOfferingAutomationRules(null, null);
    expect(Object.keys(grouped)).toEqual([]);
    expect(grouped).toEqual({});
  });
});
