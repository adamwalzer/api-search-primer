var _      = require('lodash');
var logger = require('./logger.js').logger;
var api    = require('./api.js').api;
var url = require('url');

var processPage = function (search, json, resource) {
    logger.log('verbose', 'processing api json');
    logger.log('debug', 'on page', _.get(json,'page', -1));
    var resources = _.find(_.get(json, '_embedded'));

    return _.map(resources, function (resourceData) {
        var resourceId = getResourceId(resourceData);
        logger.log('debug', 'Id for', resource, 'resource:', resourceId);
        resourceData = _.omit(resourceData, ['_embedded', '_links', 'scope']);

        return search.putResource(resource, resourceId, resourceData);
    });
};

var getResourceId = function (json) {
    var keys = Object.keys(json);
    var key  = _.findIndex(keys, function (key) {
        return key.indexOf('_id') > -1
    });

    return _.get(json, keys[key]);
};

var getNextPage = function (json) {
    var nextLink = _.get(json, '_links.next.href', false);

    if (nextLink === false) {
        logger.log('verbose', 'No more pages to process');
        return;
    }

    logger.log('debug', 'Next Link', nextLink);
    return nextLink;
};

var processor = function () {};

processor.importData = function (apiUri, search) {
    return new Promise(function (resolve, reject) {
        var urlObj       = url.parse(apiUri, false);
        var pathSegments = urlObj.pathname.split('/');
        var resource     = pathSegments[1];

        if (pathSegments.length > 3) {
            logger.error('Currently the primer cannot process', apiUri);
            process.exit(11);
        }

        logger.log('verbose', 'Caching resource ', apiUri);
        api.getUrl(apiUri, resolve, reject)
            .then(function (json) {
                logger.log('info', 'Processing PROCESSING!!!!!!!');
                return processPage(search, json, resource);
            })
            .then(function (promises) {
                return Promise.all(promises);
            })
            .then(function (operations) {
                var ops = _.flatten(operations);
                search.putOps(ops);
            });
    })
    .then(function (json) {
        return getNextPage(json);
    })
    .catch(function(err) {
       throw err;
    });
};

module.exports = {
    processor
};