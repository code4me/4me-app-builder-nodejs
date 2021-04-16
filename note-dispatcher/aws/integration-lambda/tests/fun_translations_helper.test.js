'use strict';

const FunTranslationsHelper = require('../fun_translations_helper')

it('can translate', async () => {
  const helper = new FunTranslationsHelper();

  const translation = 'pirate';
  const text = 'Just do it';

  const response = await helper.getTranslation(translation, text);

  expect(response.translation).toBe(translation);
  expect(response.text).toBe(text);
  expect(response.translated).not.toBeNull();
});

it('supports multiple translations', async () => {
  const helper = new FunTranslationsHelper();
  expect(helper.translations.length).toBeGreaterThan(0);
  expect(helper.translations).toBe(FunTranslationsHelper.TRANSLATIONS);
});

it('can generate random translation', async () => {
  const helper = new FunTranslationsHelper();

  const text = 'Just do it';
  const response = await helper.getRandomTranslation(text);

  expect(response.text).toBe(text);
  expect(response.translated).not.toBeNull();

  const translation = response.translation;
  expect(translation).not.toBeNull();
  expect(helper.translations.includes(translation)).toBeTruthy();
});
