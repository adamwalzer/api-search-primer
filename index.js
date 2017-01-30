var _               = require('lodash');
var request         = require('request').defaults();
var logger          = require('./src/logger.js').logger;
var commandLineArgs = require('command-line-args');
var api             = require('./src/api.js').api;
var search          = require('./src/search.js').search;
var url             = require('url');
var Processor       = require('./src/processor.js').processor;

var optionDefinitions = [
    { name: 'verbose', alias: 'v', type: Boolean },
    { name: 'debug', alias: 'd', type: Boolean },
    { name: 'spawn', alias: 's', type: Boolean },
    { name: 'api', type: String },
    { name: 'search', type: String },
    { name: 'function', alias: 'f', type: String },
    { name: 'user', alias: 'u', type: String },
    { name: 'pass', alias: 'p', type: String },
];

var options   = commandLineArgs(optionDefinitions);
var user      = options.user;
var pass      = options.pass;
var spawn     = options.spawn;

if (options.verbose) {
    logger.level = 'verbose';
}

if (options.debug) {
    logger.level = 'debug';
}

logger.info('Cache Primer');
logger.log('debug', options);

var processor = new Processor(options);

var primeCache = function () {
    return Promise.resolve(processor.importData());
};

primeCache()
    .catch(function (err) {
        logger.error(err);
    });