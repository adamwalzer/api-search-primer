var _ = require('lodash');
var request = require('request').defaults();
var logger = require('./src/logger.js').logger;
var url = require('url');
var argv = require('yargs')
    .usage('$0 [args]')
    .options(
        {
            v: {
                boolean: true,
                alias: 'verbose',
                describe: 'Turn on verbose logging'
            },
            d: {
                boolean: true,
                alias: 'debug',
                describe: 'Turn on debugging ',
            },
            swagger: {
                type: 'string',
                describe: 'Location for swagger json',
                demand: true
            },
            search: {
                type: 'string',
                describe: 'Location of elastic index',
                demand: true
            },
            index: {
                type: 'string',
                describe: 'The index (environment) to prime ',
                demand: true
            }
        }
    )
    .argv;

if (argv.v) {
    logger.level = 'info';
}

if (argv.d) {
    logger.level = 'debug';
}

var user = process.env.API_USER;
var pass = process.env.API_PASS;

logger.info('Cache Primer');
logger.log('debug', argv);

var swaggerUrl = url.parse(argv.swagger);
// TODO possibly move this into the processor so it can use what is in the swagger docs
var apiUrl = swaggerUrl.protocol + '://' + swaggerUrl.host;

var api = require('./src/api.js')(apiUrl, {auth: {user: user, password: pass}}, logger);
var search = require('./src/search.js')(argv.search, {}, argv.index, logger);
var processor = require('./src/processor')(api, search, logger);

processor.index(argv.swagger);