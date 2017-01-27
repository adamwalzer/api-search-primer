var logger  = require('./logger.js').logger;
var request = require('request');
var _       = require('lodash');
var CmwnSearchRequest;
var searchOptions;

var search = function () {

};

search.initialize = function (options) {
    searchOptions = _.defaults(options, { timeout: 3000, json: true });
    if (searchOptions.uri == null) {
        logger.log('error', 'Cannot make search requests with missing options');
        process.exit(5);
    }

    CmwnSearchRequest = request.defaults(searchOptions);
};

search.put = function(uri, data, resolve, reject) {
    if (CmwnSearchRequest == undefined) {
        logger.log('error', 'Cannot make search request when not initialized');
        process.exit(7);
    }

    return new Promise(function (searchResolve, searchReject) {
        CmwnSearchRequest(
            uri,
            {
                uri: uri,
                method: 'PUT',
                json: data,
            },
            function (err, response) {
                if (err) {
                    logger.error('Error putting data:', uri, err);
                    searchReject(err);
                    return;
                }

                if (response.statusCode !== 200) {
                    logger.error('Incorrect response code: ', response.statusCode, 'to:', uri);
                    searchReject('Invalid response code: ' + response.statusCode);
                    return;
                }


                searchResolve();
            }
        );
    })
        .then(function () {
            resolve('foo');
            logger.log('verbose', 'Put data to:', uri);
            return 'bar';
        })
        .catch(function (err) {
            logger.error('Failed to import from search: ', err);
            reject(err);
            throw err;
        });
};

search.putResource = function (resource, resourceId, data, resolve, reject) {
    return search.put(searchOptions.uri + resource + '/' + resourceId, data, resolve, reject)
        .then(function (json) {
            return json;
        });
};

module.exports = {
    search,
};
