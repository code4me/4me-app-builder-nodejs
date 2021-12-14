'use strict';

const Timer = require('../timer');

it('calculates duration', () => {
  const timer = new Timer();
  expect(timer.startTime.getTime()).toBeGreaterThan(0);
  expect(timer.getDurationInMilliseconds()).toBeGreaterThanOrEqual(0);
  expect(timer.endTime).toBe(null);

  timer.stop();
  expect(timer.endTime.getTime()).toBeGreaterThan(0);

  timer.startTime = new Date(timer.endTime.getTime() - 2001);
  expect(timer.getDurationInMilliseconds()).toEqual(2001);
  expect(timer.getDurationInSeconds()).toEqual(2.001);
});