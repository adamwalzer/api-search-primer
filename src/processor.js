var _         = require('lodash');
var logger    = require('./logger.js').logger;

var processData = function (search, json, resource, resolve, reject) {
    logger.log('verbose', 'processing api json');
    logger.log('debug', 'on page', _.get(json,'page', -1));
    var embedded = _.get(json, '_embedded.' + resource);
    return _.map(embedded, function (resourceData) {
        var resourceId = _.get(resourceData, resource + '_id', false);
        logger.log('debug', 'Id for', resource, 'resource:', resourceId);
        resourceData = _.omit(resourceData, ['_embedded', '_links', 'scope']);

        return search.putResource(resource, resourceId, resourceData, resolve, reject);
    });
};

var getNextPage = function (api, search, json) {
    var nextLink = _.getResource(json, '_links.next.href', false);
    var nextPage = parseInt(_.getResource(json, 'page', 0)) + 1;

    if (nextLink === false) {
        logger.log('debug', 'No more pages to process');
        return;
    }

    logger.log('verbose', 'Getting page ', nextPage);
    return processor.importData(api, search, nextLink);
};

var processor = function () {};

processor.importData = function (api, search, resource) {
    return new Promise(function (resolve, reject) {
        logger.log('verbose', 'Importing resource ', resource);
        api.getResource(resource, resolve, reject)
            .then(function (json) {
                logger.log('info', 'Fetching asset data from media API');
                Promise.resolve(Promise.all(processData(search, json, resource, resolve, reject)));
                return json;
            })
            .then(function (json) {
                var bar = true;
            })
            .catch(reject);
    });
};

module.exports = {
    processor
};