'use strict';
/**
 * 로컬에 있는 책 데이터 파일을 읽어오는 모듈
 */

var fs = require('fs');

module.exports.getBookInfo = function (bookID, dataDir, cb) {

    var bookContents = fs.readFileSync(dataDir + bookID + ".json");

    var bookInfo = JSON.parse(bookContents);
    cb(null, bookInfo);
}