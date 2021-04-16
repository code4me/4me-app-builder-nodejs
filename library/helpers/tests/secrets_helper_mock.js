var mockedHelperConstructor;
jest.mock('../secrets_helper', () => {
    mockedHelperConstructor = jest.fn().mockName('SecretsHelperConstructor');
    return mockedHelperConstructor;
});

exports.constructor = () => mockedHelperConstructor;

exports.once = (name, func) => {
    const mocked = jest.fn().mockName(`mocked_${name}`);
    if (func) {
        mocked.mockImplementationOnce(func);
    }
    mockedHelperConstructor
        .mockImplementationOnce(() => {
            const result = {};
            result[name] = mocked;
            return result;
        });
    return mocked;
}