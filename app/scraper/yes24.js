'use strict';
/**
 * yes24 에 있는 책 데이터를 읽어오는 모듈
 */

var request = require('request');
var cheerio = require('cheerio');
var iconv = require('iconv-lite');
var htmlToText = require('html-to-text');

var domain = "http://www.yes24.com";

module.exports.getBookList = function (pageNumber, cb) {
  var booklistURL = domain + '/24/Category/More/001014?ElemNo=13&ElemSeq=1&PageNumber=' + pageNumber;

  request(booklistURL, function (error, response, html) {
    if (error) {
      cb(error);
      return;
    }

    var $ = cheerio.load(html);
    var bookList = [];

    $(".goodsImgW").each(function (index, element) {
      if (element.children.length > 2) {
        var bookData = {};

        var linkPath = element.children[1].attribs.href;
        bookData.ID = linkPath.substr(linkPath.lastIndexOf("/") + 1);
        bookData.URL = domain + "/24/goods/" + bookData.ID;

        bookList.push(bookData);
      }

    });
    cb(null, bookList);
  });
}

module.exports.getBookInfo = function (bookID, linkURL, cb) {

  request({
    method: "GET",
    uri: linkURL,
    encoding: null
  }, function (error, response, body) {
    if (error) {
      cb(error);
      return;
    }

    var html = iconv.decode(body, "euc-kr");
    var $ = cheerio.load(html);

    //책 데이터 분해
    var bookData = {};

    var divTitle = $("#title");

    //타이틀 에서 괄호 제거
    bookData.title = divTitle.find("h1").find("a").text().trim().replace(/\s[(].*[)]/g, '');
    bookData.url = response.request.href;

    $("meta").each(function (index, element) {
      if (element.attribs.property == "og:image") {
        bookData.image = element.attribs.content;
      }
    });

    // 저자 | 출판사 | 기타정보...분해
    var arrAuthorPublisher = $("#title p").text().split("|");

    if (arrAuthorPublisher[0] != undefined)
      bookData.author = arrAuthorPublisher[0].trim();
    if (arrAuthorPublisher[1] != undefined)
      bookData.publisher = arrAuthorPublisher[1].trim();

    //책소개
    if ($("a[name*=contentsIntro]").length > 0) {
      bookData.introduce = htmlToText.fromString($("a[name*=contentsIntro]").next().find("p").html().trim(), {
        wordwrap: false
      });
      bookData.introduce = bookData.introduce.replace("\"", "'");
    }

    bookData.introduce_authors = [];

    //출간일
    var arrPublishData = $("dd.pdDate p").eq(0).text().trim().split(" ");

    bookData.date = Number(arrPublishData[0].substr(0, 4) + arrPublishData[1].substr(0, 2) + arrPublishData[2].substr(0, 2));

    //저자소개 분해함수
    function extractAuthorDetail(objectID) {
      var result = [];
      for (var i = 0;; i++) {
        var objAuthor = {};
        var divAuthorContent = $(objectID + i);

        if (divAuthorContent.length == 0) {
          break;
        }

        var arrAuthorRole = divAuthorContent.prev().text().split(":");

        if (arrAuthorRole.length < 2) {
          //일반적 포맷을 벗어나는 경우에 대한 예외처리 - (ex : http://www.yes24.com/24/goods/24192031)
          divAuthorContent.find("b").each(function (index, element) {
            //추후 구현
          });
        } else {
          objAuthor.role = arrAuthorRole[0].trim();
          objAuthor.author = arrAuthorRole[1].trim();

          if (divAuthorContent.find("span.OZSHOW").length > 0)
            objAuthor.introduce = htmlToText.fromString(divAuthorContent.find("span.OZSHOW").html().trim(), {
              wordwrap: false
            });
          else if (divAuthorContent.find("span.more_contents").length > 0)
            objAuthor.introduce = htmlToText.fromString(divAuthorContent.find("span.more_contents").html().trim(), {
              wordwrap: false
            });
          else
            objAuthor.introduce = htmlToText.fromString(divAuthorContent.html().trim(), {
              wordwrap: false
            });

          result.push(objAuthor);
        }
      }
      return result;
    };

    bookData.introduce_authors = extractAuthorDetail("#contents_author_text") //저자
      .concat(extractAuthorDetail("#contents_authoretc_text")); //편자

    //목차
    if ($("#contents_constitution_text0").length > 0) {
      var div = $("#contents_constitution_text0");
      if (div.find("span.more_contents").length >= 2) {
        bookData.constitution = htmlToText.fromString(div.find("span.more_contents").eq(2).html().trim(), {
          wordwrap: false
        });
      } else {
        bookData.constitution = htmlToText.fromString(div.html().trim(), {
          wordwrap: false
        });
      }
    }

    //책속으로
    bookData.inside = [];
    if ($("#contents_inside_text0").length > 0) {
      var div = $("#contents_inside_text0");
      if (div.find("span.more_contents").length >= 2) {
        var arrInsideText = htmlToText.fromString(div.find("span.more_contents").eq(2).html().trim(), {
          wordwrap: false
        }).split("\n\n");
        //각 문장 뒤의 페이지번호 문구 제거
        arrInsideText.forEach(function (element, index, arr) {
          var pos = element.lastIndexOf("---");

          if (pos > element.length / 3)
            element = element.substr(0, pos);

          bookData.inside.push(element);
        });
      } else {
        var arrInsideText = htmlToText.fromString(div.html().trim()).split("\n\n");
        //각 문장 뒤의 페이지번호 문구 제거
        arrInsideText.forEach(function (element, index, arr) {
          var pos = element.lastIndexOf("---");

          if (pos > element.length / 3)
            element = element.substr(0, pos);

          bookData.inside.push(element);
        });
      }
    }

    //줄거리
    if ($("#contents_summary_text0").length > 0) {
      var div = $("#contents_summary_text0");
      if (div.find("span.more_contents").length >= 2) {
        bookData.summary = htmlToText.fromString(div.find("span.more_contents").eq(2).html().trim(), {
          wordwrap: false
        });
      } else {
        bookData.summary = htmlToText.fromString(div.html().trim(), {
          wordwrap: false
        });
      }
    }

    //출판사 리뷰
    if ($("#contents_makerReview_text0").length > 0) {
      var div = $("#contents_makerReview_text0");
      if (div.find("span.more_contents").length >= 2) {
        bookData.publisher_review = htmlToText.fromString(div.find("span.more_contents").eq(2).html().trim(), {
          wordwrap: false
        });
      } else {
        bookData.publisher_review = htmlToText.fromString(div.html().trim(), {
          wordwrap: false
        });
      }

      //책속으로 내용이 없으면 출판사 리뷰 로 보충한다.
      if (0 == bookData.inside.length) {
        bookData.inside.push(bookData.publisher_review);
      }
    }

    cb(null, bookData);
  });
}

module.exports.getBookListMaxPage = function (cb) {
  var booklistURL = domain + '/24/Category/More/001014?ElemNo=13&ElemSeq=1';

  request(booklistURL, function (error, response, html) {
    if (error) {
      cb(error);
      return;
    }

    var $ = cheerio.load(html);
    var countPageLinks = $("p.page a").length;
    var linktextLastPage = $("p.page a").eq(countPageLinks - 1).attr("href");
    var numLastPage = Number(linktextLastPage.substring(linktextLastPage.lastIndexOf("=") + 1, linktextLastPage.length));

    cb(null, numLastPage);
  });
}