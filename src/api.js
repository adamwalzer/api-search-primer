var _ = require('lodash');
var request = require('request');

/**
 * Marshals calls to the API
 *
 * @module api
 * @param {String} apiUri - the base path for the API
 * @param {Object} options - key value for the
 * @param {Object.<logger>} logger - Logger
 * @return {{apiRequest, postRequest}}
 */
module.exports = function (apiUri, options, logger) {
    logger.info('debug', 'Initializing API');
    _.defaults(options, {});

    options.timeout = 3000;
    options.json = true;
    options.strictSsl = true;

    if (options.auth == null ||
        options.auth.user == null ||
        options.auth.password == null
    ) {
        throw Error('Cannot make api requests with missing options');
    }

    var requester = request.defaults(options);

    /**
     * Makes a get call to the API
     *
     * @param {Function.<request>} request - Request Module
     * @param {String} url - the FQ URI
     * @param {Object} query - query params
     * @param {Function} resolve - resolving function
     * @param {Function} reject - rejecting function
     * @return {Promise}
     */
    var getUrl = (request, url, query, resolve, reject) => {
        _.defaults(query, {});
        logger.log('debug', 'Making call to:' , url, 'with the following query:', query);
        return new Promise(function (apiResolve, apiReject) {
            request(url, {qs: query}, (err, response, body) => {
                if (err) {
                    return apiReject(Error('Error requesting: ' + url + ' ' + err));
                }

                if (response.statusCode !== 200) {
                    return apiReject(Error('Invalid response code: ' + response.statusCode));
                }

                if (_.isEmpty(body)) {
                    return apiReject(Error('Empty response body from: ' + url));
                }

                return apiResolve(body);
            });
        })
            .then(body => {
                logger.log('debug', 'Completed request to:', url);
                _.attempt(resolve, body);
                return body;
            })
            .catch(err => {
                logger.log('error', err);
                _.attempt(reject, [err]);
                throw err;
            });
    };

    /**
     * Makes a get call to the API
     *
     * @param {Function.<request>} request - Request Module
     * @param {String} base - api host
     * @param {String} path - path to call
     * @param {Object} query - query params
     * @param {Function} resolve - resolving function
     * @param {Function} reject - rejecting function
     * @return {Promise}
     */
    var getResource = (request, base, path, query, resolve, reject) => {
        _.defaults(query, {});
        path = _.startsWith('/', path) ? path.substring(1) : path;
        base = !_.endsWith('/', base) ? base + '/' : base;
        var apiUrl = base + path;
        return getUrl(request, apiUrl, query, resolve, reject)
    };

    /**
     * Makes a Post call to the API
     *
     * @param {Function.<request>} request - Request Module
     * @param {String} base
     * @param {String} path
     * @param {Object} data
     * @param resolve
     * @param reject
     * @return {Promise}
     */
    var postResource = (request, base, path, data, resolve, reject) => {
        path = _.startsWith('/', path) ? path.substring(1) : path;
        base = !_.endsWith('/', base) ? base + '/' : base;
        var apiUrl = base + path;
        logger.log('debug', 'Posting to:' , apiUrl, 'with the following data:', data);
        return new Promise(function (apiResolve, apiReject) {
            request(base + path, {method: 'POST', json: data}, (err, response, body) => {
                if (err) {
                    return apiReject(Error('Error posting: ' + apiUrl + ' ' + err));
                }

                return apiResolve(response);
            });
        })
            .then((body) => {
                logger.log('debug', 'Completed POST request to:', apiUrl);
                _.attempt(resolve, body);
            })
            .catch(err => {
                logger.log('error', err);
                _.attempt(reject, [err]);
                throw err;
            });
    };

    return {
        getUrl: _.partial(getUrl, requester),
        getResource: _.partial(getResource, requester, apiUri),
        postResource: _.partial(postResource, requester, apiUri)
    }
};
