'use strict';
/**
 * 주기적으로  동작하는 스케쥴러 작업 등록
 */

const cron = require('node-cron');
const logger = require('../util/logger.js');

//1분 마다 callback 실행
module.exports.run_minute = function (cb) {

  var schedule = cron.schedule("0 * * * * *", cb);
  logger.info("scheduled job in every minute START!!");
  schedule.start();
}

//1시간 마다 callback 실행
module.exports.run_hour = function (cb) {

  var schedule = cron.schedule("0 0 * * * *", cb);
  logger.info("scheduled job in every hour START!!");
  schedule.start();
}

//1일 마다 callback 실행
module.exports.run_day = function (cb) {

  var schedule = cron.schedule("0 0 0 * * *", cb);
  logger.info("scheduled job in every day START!!");
  schedule.start();
}