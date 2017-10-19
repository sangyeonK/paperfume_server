'use strict'

const fs = require("fs");
const path = require("path");
const async = require("async");
const sqlite3 = require('sqlite3').verbose();

const localReader = require("../app/scraper/localReader.js");
const firebasew = require('../app/util/firebasew.js'); //Firebase Wrapper
const logger = require('../app/util/logger.js');

const scr_interpark = require("../app/scraper/interpark.js"); //scraper ( for interpark )

const db = new sqlite3.Database(path.normalize(__dirname + "/../database/book.db"));

const dataDir = path.normalize(__dirname + "/../data/");
const datamDir = path.normalize(__dirname + "/../data_min/");

fs.readdir(dataDir, function (err, files) {
  if (err) {
    logger.error(err);
    return;
  }
  var remainCount = files.length;
  files.forEach(function (elem, index, arr) {
    var bookID = Number(elem.replace(".json", ""));

    var countInsideText; //책속으로 항목 수
    var detailInfo = {}; //책 세부데이터
    var minInfo = {}; //책 최소데이터

    async.waterfall([
      function (cb) {
        //0.1초 단위로 나눠서 실행
        setTimeout(cb, 100 * index);
      },
      function (cb) {
        localReader.getBookInfo(bookID, dataDir, cb);
      },
      function (info, cb) {
        //책 제목에서 괄호부분 제거
        info.title = info.title.replace(/\s[(].*[)]/g, '');
        if (info.inside.length == 0) {
          info.inside.push(info.publisher_review);
        }

        detailInfo = info;

        countInsideText = info.inside == undefined ? 0 : info.inside.length;

        minInfo.title = info.title;
        minInfo.author = info.author;
        minInfo.image = info.image;
        minInfo.inside = info.inside;

        //인터파크에서 에서 책 이미지 검색 
        scr_interpark.findBookImage(info.title, info.author, cb);
      },
      function (imagePath, cb) {
        if (imagePath != undefined) {
          minInfo.image = imagePath;
          detailInfo.image = imagePath;
        }
        //파일 저장 - min Info
        fs.createWriteStream(datamDir + bookID + ".json").end(JSON.stringify(minInfo), cb);
      },
      function (cb) {
        //firebase( /book_data ) 업로드 - min info
        firebasew.storage.upload(datamDir + bookID + ".json", {
          destination: "book_data/" + bookID + ".json"
        }, cb);
      },
      function (file, cb) {
        //파일 저장 - detailInfo
        fs.createWriteStream(dataDir + bookID + ".json").end(JSON.stringify(detailInfo), cb);
      },
      function (cb) {
        //firebase( /book_data_detail ) 업로드 - detail info
        firebasew.storage.upload(dataDir + bookID + ".json", {
          destination: "book_data_detail/" + bookID + ".json"
        }, cb);
      }
    ], function (error, result) {
      if (error) {
        logger.error(error);
        return;
      }

      remainCount--;
      logger.info("book data [" + bookID + "] arrange complete! (remain " + remainCount + " )");

      db.run("UPDATE books SET `inside_text_count` = ? WHERE id=?", [countInsideText, bookID]);

    });


  });
});