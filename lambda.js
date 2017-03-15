var _ = require('lodash');
var logger = require('./src/logger.js').logger;
var url = require('url');
var user = process.env.API_USER;
var pass = process.env.API_PASS;

exports.handler = function (event, context, callback) {
    var swaggerUri = _.get(event, 'swagger', false);
    var searchUri = _.get(event, 'search', false);
    var index = _.get(event, 'index', false);

    if (_.get(event, 'verbose', false)) {
        logger.level = 'info';
    }

    if (_.get(event, 'debug', false)) {
        logger.level = 'debug';
    }

    logger.log('debug', 'Lambda event', JSON.stringify(event));
    logger.log('debug', 'Context', JSON.stringify(context));
    logger.log('info', 'Swagger Url', swaggerUri);

    if (_.isEmpty(swaggerUri)) {
        logger.log('error', 'Swagger Uri missing from lambda event');
        callback('API Uri missing from lambda event');
        return;
    }

    var swaggerUrl = url.parse(swaggerUri);
    var apiUrl = swaggerUrl.protocol + '://' + swaggerUrl.host;

    var api = require('./src/api.js')(apiUrl, {auth: {user: user, password: pass}}, logger);
    var search = require('./src/search.js')(searchUri, {}, index, logger);
    var processor = require('./src/processor')(api, search, logger);

    processor.index(swaggerUrl)
        .then(() => {
            callback(null, 'Completed indexing');
        })
        .catch(err => {
            callback('Failed to index', [err]);
        });
};