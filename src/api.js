var logger  = require('./logger.js').logger;
var request = require('request');
var _       = require('lodash');
var CmwnApiRequest;
var apiOptions;

var api = function () {
    this.initialized = false;
};

api.initialize = function (options) {
    apiOptions = _.defaults(options, { timeout: 3000, json: true, strictSsl: true });
    if (apiOptions.auth == null ||
        apiOptions.auth.user == null ||
        apiOptions.auth.password == null
    ) {
        logger.log('error', 'Cannot make api requests with missing options');
        process.exit(2);
    }

    CmwnApiRequest = request.defaults(apiOptions);
    this.initialized = true;
};

api.isInitialized = function () {
    return this.initialized;
};

api.getUrl = function (uri, resolve, reject) {
    if (!this.isInitialized()) {
        logger.log('error', 'Cannot make API request when not initialized');
        process.exit(3);
    }

    return new Promise(function (apiResolve, apiReject) {
        CmwnApiRequest.get(uri, (err, response, body) => {
            if (err) {
                logger.error('Error requesting:', uri, err);
                return apiReject(err);
            }

            if (response.statusCode !== 200) {
                logger.error('Invalid response code:', response.statusCode, 'from:', uri);
                return apiReject(Error('Invalid response code: ' + response.statusCode));
            }

            if (_.isEmpty(body)) {
                logger.error('Empty response body from:', uri);
                return apiReject(Error('Empty response body from: ' + skribbleUrl));
            }


            return apiResolve(body);
        });
    })
        .then(function (body) {
            logger.log('debug', 'Successful api request for uri', uri);
            resolve(body);
            return body;
        })
        .catch(function (err) {
            logger.error('Failed to import from api: ', err);
            reject(err);
            throw err;
        });
};

api.getResource = function (resource, resolve, reject) {
    return api.getUrl(apiOptions.uri + resource, resolve, reject)
        .then(function (json) {
            return json;
        });
};

module.exports = {
    api,
};
