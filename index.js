var _                 = require('lodash');
var request           = require('request').defaults();
var logger            = require('./src/logger.js').logger;
var commandLineArgs   = require('command-line-args');
var api               = require('./src/api.js').api;
var search            = require('./src/search.js').search;

var optionDefinitions = [
    { name: 'verbose', alias: 'v', type: Boolean },
    { name: 'debug', alias: 'd', type: Boolean },
    { name: 'api', type: String },
    { name: 'search', type: String },
    { name: 'user', alias: 'u', type: String },
    { name: 'pass', alias: 'p', type: String }
];
var options           = commandLineArgs(optionDefinitions);
var apiUri            = options.api;
var searchUri         = options.search;
var user              = options.user;
var pass              = options.pass;
var processor         = require('./src/processor.js').processor;

if (options.verbose) {
    logger.level = 'verbose';
}

if (options.debug) {
    logger.level = 'debug';
}

logger.info('Cache Primer');
logger.log('debug', options);

if (apiUri == undefined || searchUri == undefined || user == undefined || pass == undefined) {
    logger.error('Missing required options');
    process.exit(1);
}

api.initialize({uri: apiUri, auth: {user: user, password: pass}});
search.initialize({uri: searchUri});

var primeCache= function() {
    return Promise.resolve(processor.importData(api, search, 'user'));
};

primeCache().then(function () {
    logger.log('done');
}).catch(function () {
    logger.error(err);
});

// api.getResource(apiUri + 'user', _.noop, _.noop).then(function (body) {
//     logger.debug(body);
// });