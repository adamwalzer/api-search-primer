var logger        = require('./logger.js').logger;
var request       = require('request');
var _             = require('lodash');
var elasticsearch = require('elasticsearch');
var url           = require('url');
var initialized   = false;
var searchOptions;
var client;


var search = function () {

};

search.initialize = function (options) {
    searchOptions = _.defaults(options, { timeout: 3000, json: true });
    if (searchOptions.host == null || searchOptions.index == null) {
        logger.log('error', 'Cannot make search requests with missing options');
        process.exit(5);
    }

    client = new elasticsearch.Client({
        host: searchOptions.host
    });

    initialized = true;
};

search.putOps = function(operations) {
    if (!initialized) {
        logger.log('error', 'Cannot make search request when not initialized');
        process.exit(7);
    }

    return new Promise(function (searchResolve, searchReject) {
        client.bulk({
            body: operations
        }, function (err, response) {
            if (err) {
                logger.error('Failed to complete bulk operation', err);
                return searchReject(err);
            }

            logger.info('Complete bulk operation(s)');
            searchResolve();
        });
    })
        .then(function () {
            logger.log('verbose', 'Updated Documents');
        })
        .catch(function (err) {
            logger.error('Failed to import from search: ', err);
            reject(err);
            throw err;
        });
};

search.putResource = function (resource, resourceId, data) {
    return new Promise(function (resolve, reject) {
        return resolve([
            {
                update: {
                    _index: searchOptions.index,
                    _type:  resource,
                    _id:    resourceId
                }
            },
            { doc: data, doc_as_upsert : true }
        ]);
    })
    .catch(function (err) {
        throw err;
    });
};

module.exports = {
    search,
};
