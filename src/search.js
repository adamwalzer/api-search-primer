var logger = require('./logger.js').logger;
var request = require('request');
var _ = require('lodash');

/**
 * @typedef {Object} ElasticMapping
 * @property {Boolean} index
 * @property {String} type
 * @property {String} format
 * @property {Boolean} ignore_malformed
 * @property {Boolean} doc_values
 */


module.exports = function (searchUri, options, index, logger) {
    logger.info('debug', 'Initializing Search');
    _.defaults(options, {});

    options.timeout = 3000;
    options.json = true;
    options.strictSsl = true;
    options.aws = {
        key: process.env.AWS_KEY,
        secret: process.env.AWS_SECRET,
        sign_version: 4
    };

    var requester = request.defaults(options);
    var indexUri = searchUri + index;

    /**
     * Makes a get call to the Elastic search
     *
     * @type {Function}
     * @param {Function.<request>} request - Request Module
     * @param {String} url - the FQ URI
     * @param {Object} query - query params
     * @param {Function} resolve - resolving function
     * @param {Function} reject - rejecting function
     * @return {Promise}
     */
    var getUrl = _.partial((request, url, query, resolve, reject) => {
        _.defaults(query, {});
        logger.log('debug', 'Making call to:', url, 'with the following query:', query);
        return new Promise((apiResolve, apiReject) => {
            request(url, {qs: query}, (err, response, body) => {
                if (err) {
                    return apiReject(Error('Error requesting: ' + url + ' ' + err));
                }

                return apiResolve(response);
            });
        })
            .then(response => {
                logger.log('debug', 'Completed request to:', url);
                _.attempt(resolve, response);
                return response;
            })
            .catch(err => {
                logger.log('error', err);
                _.attempt(reject, [err]);
            });
    }, requester);

    /**
     * Makes a post all elastic search
     *
     * @type {Function}
     * @param {Function.<request>} request - Request Module
     * @param {String} postUrl - the FQ URL to post to
     * @param {String} method - the HTTP verb to use
     * @param {Object} data - data to post
     * @param {Function} resolve - resolving function
     * @param {Function} reject - rejecting function
     *
     */
    var postUrl = _.partial((request, postUrl, method, data, resolve, reject) => {
        _.defaultTo(method, 'POST');
        logger.log('debug', 'Posting to:', postUrl, 'with the following data:', data);
        return new Promise((apiResolve, apiReject) => {
            request(postUrl, {method: method, json: data}, (err, response) => {
                if (err) {
                    return apiReject(Error('Error posting: ' + postUrl + ' ' + err));
                }

                return apiResolve(response);
            });
        })
            .then(response => {
                logger.log('debug', 'Completed POST request to:', postUrl);
                _.attempt(resolve, response);
                return response;
            })
            .catch(err => {
                logger.log('error', err);
                _.attempt(reject, [err]);
                throw err;
            });
    }, requester);

    return {
        /**
         * Checks if the index is created
         *
         * @type {Function}
         * @param {Function.<getUrl>} getUrl
         * @param {String} indexUri
         * @param {String} type
         */
        checkIndex: _.partial((getUrl, indexUri) => {
            return getUrl(indexUri)
                .then(response => {
                    logger.log('debug', 'checkIndex response code', response.statusCode);
                    if (response.statusCode === 200 || response.statusCode === 404) {
                        return response.statusCode === 200;
                    }

                    throw Error('Failed to check index: ' + JSON.stringify(response.body));
                });
        }, getUrl, indexUri),

        /**
         * Creates the index
         *
         * @type {Function}
         */
        createIndex: _.partial(postUrl, indexUri, 'POST', {}),

        /**
         * Makes a call to get a mapping for a type
         *
         * @type {Function}
         * @param {Function.<getUrl>} getUrl
         * @param {String} indexUri
         * @param {String} type
         */
        getMapping: _.partial((getUrl, uri, index, type) => {
            return getUrl(uri + '/' + type).then(response => {
                logger.log('debug', 'getMapping response code', response.statusCode);
                if (response.statusCode == 200) {
                    return _.get(response, 'body.' + index + '.mappings.' + type + '.properties');
                }

                throw Error('Failed to get mapping: ' + JSON.stringify(response.body));
            })
        }, getUrl, indexUri + '/_mapping', index),

        /**
         * Creates the mapping for a type in elastic
         *
         * @type {Function}
         * @param {String} indexUri - URI to the elastic index
         * @param {String} type - the entity to map
         * @param {Object.<ElasticMapping>} mapping - entities property map
         */
        createMapping: _.partial(
            (postFunc, indexUri, type, mapping) => {
                indexUri += '/_mapping/' + type;
                return postFunc(indexUri, 'POST', _.set({}, 'properties', mapping));
            },
            postUrl, indexUri
        ),

        /**
         * Posts a document to elastic
         *
         * @type {Function}
         * @param {String} type - the type of document
         * @param {String} docId - the Id of the document
         * @param {Object} document - the document to post
         *
         * @return {Promise}
         */
        indexDocument: _.partial(
            (postFunc, indexUrl, type, docId, document) => {
                var docUrl = indexUrl + '/' + type + '/' + docId;
                return postUrl(docUrl, 'POST', document);
            },
            postUrl, indexUri
        )
    }
};
