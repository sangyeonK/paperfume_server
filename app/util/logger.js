'use strict'

var fs = require('fs');
var winston = require('winston');
var path = require('path');

var dataDir = __dirname + "/../../logs/";

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, 0o0766, function (err) {
        if (err) {
            console.log(err);
        }
    });
}

var logConfig = {
    levels: {
        error: 0,
        warn: 1,
        info: 2,
        verbose: 3,
        debug: 4,
        silly: 5
    },
    colors: {
        error: 'red',
        warn: 'yellow',
        info: 'green',
        verbose: 'cyan',
        debug: 'blue',
        silly: 'magenta'
    }
};

var logger = new winston.Logger({
    transports: [
        new(winston.transports.Console)({
            name: 'console_base',
            level: 'debug',
            json: false,
            colorize: true,
            prettyPrint: true
        }),
        new(require('winston-daily-rotate-file'))({
            name: 'error_file_daily',
            filename: path.normalize(__dirname + '/../../logs/log'),
            level: 'error',
            json: false,
            timestamp: true,
            prettyPrint: true,
            prepend: true
        })
    ],
    levels: logConfig.levels,
    colors: logConfig.colors,
    exitOnError: false
});

module.exports = logger;