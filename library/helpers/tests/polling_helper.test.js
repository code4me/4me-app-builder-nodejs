'use strict';

const TimeHelper = require('../time_helper');
jest.mock('../time_helper');

const PollingHelper = require('../polling_helper');

it('returns non-null result', async () => {
  const providerFunc = async (timeRemaining) => {
    expect(timeRemaining).toEqual(2001);
    return {a: 1};
  }

  const pollingHelper = new PollingHelper();
  const result = await pollingHelper.poll(201, 2001, providerFunc);
  expect(result.a).toEqual(1);
});

it('retries on null result', async () => {
  const sinceEpochMock = jest.fn()
    .mockImplementationOnce(() => 101)
    .mockImplementationOnce(() => 114);
  const msSinceMock = jest.fn()
    .mockImplementationOnce((callStart) => {
      expect(callStart).toEqual(114);
      return 21;
    })
    .mockImplementationOnce((pollStart) => {
      expect(pollStart).toEqual(101);
      return 12;
    });
  const waitMock = jest.fn()
    .mockImplementationOnce(async (timeout) => {
      expect(timeout).toEqual(201 - 21);
    });

  TimeHelper.mockImplementationOnce(() => ({
    getMsSinceEpoch: sinceEpochMock,
    getMsSince: msSinceMock,
    wait: waitMock,
  }));

  const providerFunc = jest.fn()
    .mockImplementationOnce(async (timeRemaining) => {
      expect(timeRemaining).toEqual(2003);
      return null;
    }).mockImplementationOnce(async (timeRemaining) => {
      expect(timeRemaining).toEqual(2003 - 12);
      return {b: 2};
    });

  const pollingHelper = new PollingHelper();
  const result = await pollingHelper.poll(201, 2003, providerFunc);
  expect(result.b).toEqual(2);
});

it('returns error if maxTime is exceeded', async () => {
  const sinceEpochMock = jest.fn()
    .mockImplementationOnce(() => 101)
    .mockImplementationOnce(() => 114);
  const msSinceMock = jest.fn()
    .mockImplementationOnce((callStart) => {
      expect(callStart).toEqual(114);
      return 21;
    })
    .mockImplementationOnce((pollStart) => {
      expect(pollStart).toEqual(101);
      return 2005;
    })
    .mockImplementationOnce((pollStart) => {
      expect(pollStart).toEqual(101);
      return 2008;
    });
  const waitMock = jest.fn()
    .mockImplementationOnce(async (timeout) => {
      expect(timeout).toEqual(201 - 21);
    });

  TimeHelper.mockImplementationOnce(() => ({
    getMsSinceEpoch: sinceEpochMock,
    getMsSince: msSinceMock,
    wait: waitMock,
  }));

  const providerFunc = jest.fn()
    .mockImplementationOnce(async (timeRemaining) => {
      return null;
    }).mockImplementationOnce(async (timeRemaining) => {
      return {b: 3};
    });

  const pollingHelper = new PollingHelper();
  const result = await pollingHelper.poll(201, 2003, providerFunc);
  await expect(result.error).toEqual('No result available after 2008ms');
});
