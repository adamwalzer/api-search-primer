var _         = require('lodash');
var logger    = require('./src/logger.js').logger;
var Processor = require('./src/processor.js').processor;

exports.handler = function (event, context, callback) {
    logger.log('info', 'Lambda event', event);

    process.on('exit', (code) => {
        if (code > 0) {
            callback('Process exited abnormally');
        }
    });

    event = _.defaults(event, {
        spawn:  true,
        user:   null,
        pass:   null,
        search: null,
        api:    null
    });

    var options = {
        spawn:  event.spawn,
        api:    event.api,
        search: event.search,
        user:   event.user,
        pass:   event.pass
    };

    var processor = new Processor(options);
    return Promise.resolve(processor.importData());
};