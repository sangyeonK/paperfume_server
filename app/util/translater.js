'use strict';

/**
 * 구글번역기를 이용해 한글 -> 영문 번역
 */

var translate = require('node-google-translate-skidz');

module.exports = function (inText, cb) {
  translate({
    text: inText,
    source: 'ko',
    target: 'en'
  }, function (result) {
    cb(null, result);
  });
}