var winston = require('winston');
var rollbar = require('winston-rollbar').Rollbar;
var rollbarToken = process.env.ROLLBAR_TOKEN;
var rollbarConfig = {
    environment: "lambda",
    level: "error",
    enabled: true
};

var logger = new (winston.Logger)({
    exitOnError: false,
    level: 'info',
    transports: [
        new (winston.transports.Console)({
            colorize: true
        }),
        new (winston.transports.Rollbar)({
            rollbarAccessToken: rollbarToken,
            rollbarConfig: rollbarConfig,
            level: rollbarConfig.level,
            enabled: rollbarConfig.enabled,
            handleExceptions: true
        })
    ]
});

module.exports = {
    logger
};
