'use strict';

const path = require('path');
const express = require('express');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const stringBuilder = require('stringbuilder');
const shuffle = require('shuffle-array');
const async = require('async');
const moment = require('moment');

const firebasew = require('./app/util/firebasew.js'); //Firebase Wrapper
const logger = require('./app/util/logger.js');
const translater = require("./app/util/translater.js")

const scr_yes24 = require("./app/scraper/yes24.js"); //scraper ( for yes24 )
const scr_interpark = require("./app/scraper/interpark.js"); //scraper ( for interpark )
const localReader = require("./app/scraper/localReader.js");
const classifier = require("./app/classifier");
const scheduler = require("./app/scheduler");

stringBuilder.extend('string');

const db = new sqlite3.Database("./database/book.db");

const dataDir = path.normalize(__dirname + "/data/");
const datamDir = path.normalize(__dirname + "/data_min/");

const port = 8082;

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, 0o0766, function (err) {
    if (err) {
      logger.error(err);
    }
  });
}
if (!fs.existsSync(datamDir)) {
  fs.mkdirSync(datamDir, 0o0766, function (err) {
    if (err) {
      logger.error(err);
    }
  });
}


const app = express();

//realtime db에 추천책 갱신( 클라이언트에서 받아가야 하는 추천책 갱신 )
function updateRecommendBooks() {
  var ref = firebasew.db.ref("recommend_books/by_feeling");

  var m = moment();
  var year = m.year();
  var month = m.month() + 1;
  var day = m.day();

  //3년 전 책까지만 검색
  month -= 3;
  if (month <= 0) {
    month += 12;
    year--;
  }

  var dateForStartSearch = year * 10000 + month * 100 + day;
  var newBookList = {
    happy: [],
    miss: [],
    groomy: [],
    stifled: []
  };

  db.all("SELECT id, recommend_time, emotion FROM books WHERE publish_date > ? and inside_text_count > 0 order by recommend_time asc, publish_date desc limit 200", dateForStartSearch, function (err, result) {
    //추천책 리스트 작성
    for (var i = 0; i < result.length; i++) {
      var feeling;
      if ("thankfulness" == result[i].emotion)
        feeling = 0; //행복
      else if ("love" == result[i].emotion)
        feeling = 1; //그리움
      else if ("sadness" == result[i].emotion)
        feeling = 2; //우울
      else if ("anger" == result[i].emotion || "fear" == result[i].emotion)
        feeling = 3; //답답
      else if ("joy") {
        //이 항목은 값이 많으므로 값이 적은 항목 둘중 하나 랜덤 선택
        if (0 == result[i].id % 2)
          feeling = 0;
        else
          feeling = 1;
      } else {
        //위에 해당하지 않는 카테고리는 그냥 id기반으로 랜덤선택
        feeling = result[i].id % 4;
      }

      switch (feeling) {
        case 0:
          if (newBookList.happy.length > 6) continue;
          newBookList.happy.push(result[i].id);
          break;
        case 1:
          if (newBookList.miss.length > 6) continue;
          newBookList.miss.push(result[i].id);
          break;
        case 2:
          if (newBookList.groomy.length > 6) continue;
          newBookList.groomy.push(result[i].id);
          break;
        case 3:
          if (newBookList.stifled.length > 6) continue;
          newBookList.stifled.push(result[i].id);
          break;
      }
    }

    shuffle(newBookList.happy);
    shuffle(newBookList.miss);
    shuffle(newBookList.groomy);
    shuffle(newBookList.stifled);
    //추천된 책의 추척카운팅 처리
    db.run("UPDATE books SET recommend_time = ? WHERE id in ( " + newBookList.happy.join() + " )", m.unix());
    db.run("UPDATE books SET recommend_time = ? WHERE id in ( " + newBookList.miss.join() + " )", m.unix());
    db.run("UPDATE books SET recommend_time = ? WHERE id in ( " + newBookList.groomy.join() + " )", m.unix());
    db.run("UPDATE books SET recommend_time = ? WHERE id in ( " + newBookList.stifled.join() + " )", m.unix());

    //모두 최소 10권씩은 추천받아야 realtime db에 적용
    if (6 < newBookList.happy.length &&
      6 < newBookList.miss.length &&
      6 < newBookList.groomy.length &&
      6 < newBookList.stifled.length) {

      //새로 추천된 책 리스트를 realtime db에 적용
      ref.set(newBookList);
      logger.info("[complete] - update recommend books");
    }
  });
}

app.get('/update_recommend_books', function (req, res) {
  updateRecommendBooks();
  res.end();
});

//크롤링 할 사이트의 페이지 번호를 입력..해당 페이지번호에 있는 책들의 데이터를 sqlite와 firebase storage에 저장한다.
function scrape(pageNumber) {
  //1st waterfall
  async.waterfall([
    function (cb) {
      scr_yes24.getBookList(pageNumber, cb);
    },
    function (bookList, cb) {
      bookList.forEach(function (elem, index, arr) {
        const bookID = elem.ID;
        const linkURL = elem.URL;
        var publishDate; //책 출간날짜
        var countInsideText; //책속으로 항목 수
        var detailInfo = {}; //책 세부데이터
        var minInfo = {}; //책 최소데이터

        //2nd waterfall
        async.waterfall([
          function (cb) {
            //2초 단위로 나눠서 실행
            setTimeout(cb, 2000 * index);
          },
          function (cb) {
            db.get("SELECT * FROM books WHERE id=?", bookID, function (error, result) {
              if (error)
                cb(error);
              else
                cb(undefined, result);
            });
          },
          function (result, cb) {
            if (result === undefined) {
              db.run("INSERT OR IGNORE INTO books (`id`, `url`, `save_data`) VALUES (?,?,?)", [bookID, linkURL, 0]);
              scr_yes24.getBookInfo(bookID, linkURL, cb);
            } else if (result.save_data == 0) {
              scr_yes24.getBookInfo(bookID, linkURL, cb);
            } else {
              cb(true);
            }
          },
          function (info, cb) {
            detailInfo = info;
            publishDate = info.date;
            countInsideText = info.inside == undefined ? 0 : info.inside.length;

            minInfo.title = info.title;
            minInfo.author = info.author;
            minInfo.image = info.image;
            minInfo.inside = info.inside;
            //영문 번역
            translater(info.introduce, cb);
          },
          function (output, cb) {
            detailInfo.en_introduce = output;
            //Emotion 예측
            classifier(output, cb);
          },

          function (emotion, cb) {
            detailInfo.emotion = emotion;
            //인터파크에서 에서 책 이미지 검색
            scr_interpark.findBookImage(detailInfo.title, detailInfo.author, cb);
          },
          function (imagePath, cb) {
            minInfo.image = imagePath;
            detailInfo.image = imagePath;
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
            //error = true 는 waterfall 종료를 위해 입력한 값
            if (true !== error)
              logger.error(error);
            return;
          }
          logger.info("book data [" + bookID + "] upload complete!");

          db.run("UPDATE books SET `save_data` = 1, `publish_date` = ?, `inside_text_count` = ?, `emotion` = ? WHERE id=?", [publishDate, countInsideText, detailInfo.emotion, bookID]);
        });

      });


      cb(undefined, undefined);
    }
  ], function (error, result) {
    if (error)
      logger.error(error);

  });

}
app.get('/scrape/:pageNumber', function (req, res) {
  const pageNumber = req.params.pageNumber === undefined ? 1 : req.params.pageNumber;
  scrape(pageNumber);
  res.end();
});


//로컬파일로 저장된 책 데이터를 가져온다. - 주로 로컬 테스트 용도로 쓰일듯..
app.get('/localfile/:book_id', function (req, res) {
  const bookID = req.params.book_id;
  res.end();

  if (bookID != undefined) {
    async.waterfall([
      function (cb) {
        localReader.getBookInfo(bookID, dataDir, cb);
      },
      /*
      //영문 번역
      function(info, cb) {
        translater(info.introduce, cb);
      },
      //Emotion 예측
      function(output, cb) {
        classifier(output, cb);
      },
      */
      //인터파크에서 에서 책 이미지 검색
      function (info, cb) {
        scr_interpark.findBookImage(info.title, info.author, cb);
      },
      //최종 출력
      function (info, cb) {
        cb(undefined, info);
      }
    ], function (error, result) {
      if (error) {
        logger.error(error);
        return;
      }

      logger.info(result);
    });
  }
});




//스케쥴링 작업 등록
function runSchedule() {

  //크롤링 할 사이트는 페이지 번호별로 책 리스트를 출력하게 된다( page1, page2, page3 ..... )
  //실행시 가장 마지막 페이지 번호를 가져온 후 이 값으로 크롤링 을 수행한다.
  var maximumPage = 1;
  var lastScrapePage = 1;
  scr_yes24.getBookListMaxPage(function (error, numLastPage) {
    if (undefined == error)
      maximumPage = numLastPage;
  });
  //크롤링 스케쥴 작업 등록
  scheduler.run_minute(function () {
    scrape(lastScrapePage);
    logger.info("scheduled scrape..page - " + lastScrapePage);
    lastScrapePage++;
    if (lastScrapePage > maximumPage)
      lastScrapePage = 1;
    //1분에 한번씩..
    updateRecommendBooks();
  });

  //하루에 한번 최대 페이지 수 계산
  scheduler.run_day(function () {
    scr_yes24.getBookListMaxPage(function (error, numLastPage) {
      if (undefined == error)
        maximumPage = numLastPage;
    });
  });
  //로컬파일 데이터 교정 작업


};
runSchedule();

app.listen(port);
logger.info('Paperfume Server Start on port ' + port);

module.exports = app;