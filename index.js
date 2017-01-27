var _               = require('lodash');
var request         = require('request').defaults();
var logger          = require('./src/logger.js').logger;
var commandLineArgs = require('command-line-args');
var api             = require('./src/api.js').api;
var search          = require('./src/search.js').search;
var url             = require('url');

var optionDefinitions = [
    { name: 'verbose', alias: 'v', type: Boolean },
    { name: 'debug', alias: 'd', type: Boolean },
    { name: 'spawn', alias: 's', type: Boolean },
    { name: 'api', type: String },
    { name: 'search', type: String },
    { name: 'user', alias: 'u', type: String },
    { name: 'pass', alias: 'p', type: String },

];

var options   = commandLineArgs(optionDefinitions);
var apiUri    = options.api;
var searchUri = options.search;
var user      = options.user;
var pass      = options.pass;
var spawn     = options.spawn;
var processor = require('./src/processor.js').processor;

if (options.verbose) {
    logger.level = 'verbose';
}

if (options.debug) {
    logger.level = 'debug';
}

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

var urlObj = url.parse(searchUri);
var searchIndex = urlObj.path.split('/')[1];

api.initialize({ auth: { user: user, password: pass } });
search.initialize({ host: searchUri, index: searchIndex });

var primeCache = function () {
    return Promise.resolve(processor.importData(apiUri, search));
};

primeCache().then(function (nextLink) {
    if (!spawn && nextLink == null) {
        logger.log('verbose', 'Not spawning next page');
        return;
    }

    logger.log('verbose', 'Spawning next page');
}).catch(function (err) {
    logger.error(err);
});