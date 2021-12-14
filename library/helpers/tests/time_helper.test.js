'use strict';

const TimeHelper = require('../time_helper');

it('can format dates to 4me date_time format', () => {
  const d = new Date(2019, 1, 2, 14, 2, 1, 201);
  expect(new TimeHelper().formatDateTime(d)).toEqual('2019-02-02T13:02:01Z');
});

it('can format dates to 4me date format', () => {
  const d = new Date(2019, 1, 2, 14, 2, 1, 201);
  expect(new TimeHelper().formatDate(d)).toEqual('2019-02-02');
});

it('can format duration to text', () => {
  const timeHelper = new TimeHelper();
  expect(timeHelper.secondsToDurationText(7.01)).toEqual('0:07');
  expect(timeHelper.secondsToDurationText(65)).toEqual('1:05');
  expect(timeHelper.secondsToDurationText(144)).toEqual('2:24');
  expect(timeHelper.secondsToDurationText(744.001)).toEqual('12:24');

  expect(timeHelper.secondsToDurationText(7324)).toEqual('2:02:04');
  expect(timeHelper.secondsToDurationText(7344)).toEqual('2:02:24');
  expect(timeHelper.secondsToDurationText(72744)).toEqual('20:12:24');
});

it('can wait', async () => {
  const timeHelper = new TimeHelper();

  const start = timeHelper.getMsSinceEpoch();

  await timeHelper.wait(200);

  const diff = timeHelper.getMsSince(start);
  expect(diff).toBeGreaterThanOrEqual(200);
});