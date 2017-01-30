var _      = require('lodash');
var logger = require('./logger.js').logger;
var api    = require('./api.js').api;
var search = require('./search.js').search;
var url    = require('url');
var AWS    = require('aws-sdk');
var lambda = new AWS.Lambda();

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

var processor = function (options) {
    var apiUri    = options.api;
    var searchUri = options.search;
    var user      = options.user;
    var pass      = options.pass;
    var spawn     = options.spawn;
    var lambdaFun = options.function;

    logger.info('Cache Primer');
    logger.log('debug', options);

    if (apiUri == undefined ||
        searchUri == undefined ||
        user == undefined ||
        pass == undefined
    ) {
        logger.error('Missing required options');
        process.exit(1);
    }

    if (spawn && (lambdaFun == undefined)) {
        logger.error('Missing lambda function name to spawn');
        process.exit(13);
    }


    var urlObj = url.parse(searchUri);
    var searchIndex = urlObj.path.split('/')[1];

    api.initialize({ auth: { user: user, password: pass } });
    search.initialize({ host: searchUri, index: searchIndex });
    return {
        apiUrl:     apiUri,
        search:     search,
        spawn:      spawn,
        importData: function () {
            var that = this;
            return new Promise(function (resolve, reject) {
                var urlObj       = url.parse(that.apiUrl, false);
                var pathSegments = urlObj.pathname.split('/');
                var resource     = pathSegments[1];

                if (pathSegments.length > 3) {
                    logger.error('Currently the primer cannot process', apiUri);
                    process.exit(11);
                }

                logger.log('verbose', 'Caching resource ', apiUri);
                api.getUrl(that.apiUrl, resolve, reject)
                    .then(function (json) {
                        logger.log('info', 'Processing PROCESSING!!!!!!!');
                        return processPage(that.search, json, resource);
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
                .then(function (nextLink) {
                    if (!that.spawn || nextLink == null) {
                        logger.log('verbose', 'Not spawning next page');
                        return;
                    }

                    logger.log('verbose', 'Spawning next page');
                    return new Promise(function (lambdaResolve, lambdaReject) {
                        logger.log('debug', 'Sending Lambda Payload');

                        var lambdaParams = {
                            InvocationType: 'Event',
                            FunctionName:   lambdaFun
                        };

                        lambda.invoke(lambdaParams, function(err) {
                            if (err) {
                                logger.error('Failed to spanw next page');
                                return lambdaReject(err);
                            }

                            logger.log('debug', 'Successfully spawned nex page');
                            lambdaResolve('Successfully spawned nex page');
                        });
                    });
                })
                .then(function () {
                    logger.log('verbose', 'done priming the page');
                })
                .catch(function (err) {
                    throw err;
                });
        }
    };
};


module.exports = {
    processor
};