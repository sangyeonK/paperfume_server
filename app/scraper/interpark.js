'use strict';

const request = require('request');
const cheerio = require('cheerio');
const urlencode = require('urlencode');
const async = require("async");

const logger = require('../util/logger.js');

const domain = "http://bsearch.interpark.com";

module.exports.findBookImage = function (bookTitle, author, cb) {
  //책 제목에서 영어는 제거
  bookTitle = bookTitle.replace(/[a-zA-Z]/g, "");

  async.waterfall([
    function (wtfCB) {
      //1. 저자명(앞 2글자) + 책제목 으로 검색 시도
      var authorWord;
      if (author.indexOf(",") > 0)
        authorWord = author.substr(0, author.indexOf(","));
      else
        authorWord = author.substr(0, author.indexOf(" "));

      var bookSearchURL = domain + '/dsearch/book.jsp?query=' + urlencode(authorWord + " " + bookTitle, "euc-kr");
      request(bookSearchURL, wtfCB);
    },
    function (response, html, wtfCB) {
      var $ = cheerio.load(html);
      var form = $("form[name*='FORM_NAME_TOTAL_BOOK']");
      if (form.length > 0) {
        var imagePath = form.find("img.bd").attr("src");
        imagePath = imagePath.replace("h.jpg", "g.jpg");
        wtfCB(true, imagePath);
      } else {
        //2. 없으면 only책제목 으로 검색 시도
        var bookSearchURL = domain + '/dsearch/book.jsp?query=' + urlencode(bookTitle, "euc-kr");
        request(bookSearchURL, wtfCB);
      }
    },
    function (response, html, wtfCB) {
      var $ = cheerio.load(html);
      var form = $("form[name*='FORM_NAME_TOTAL_BOOK']");
      if (form.length > 0) {
        var imagePath = form.find("img.bd").attr("src");
        imagePath = imagePath.replace("h.jpg", "g.jpg");
        wtfCB(true, imagePath);
      } else {
        //여기에도 없으면 에러 출력 후..기본이미지 사용 시도( 에러 핸들링 은 건너뜀 )
        logger.error(new Error("not Exist Image - " + bookTitle));
        cb(undefined, undefined);
      }
    }
  ], function (error, result) {
    if (error != undefined && error != true) {
      cb(error);
      return;
    }

    cb(undefined, result);
  });
}