'use strict';
/**
 * monkeylearn 을 이용해서 특정문구의 emotion 을 찾아주는 역할을 수행하는 모듈
 */

var request = require("request");

module.exports = function (text, cb) {
  var data = {
    text_list: []
  };
  data.text_list.push(text);

  var url = "https://api.monkeylearn.com/v2/classifiers/cl_GbG8ueNa/classify/?sandbox=1";

  request.post({
    uri: url,
    encoding: "UTF-8",
    headers: {
      "Authorization": "Token 14e83ee64c17e4e2555749e95958de64b3a9f82c",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  }, function (error, response, body) {

    if (error) {
      cb(error);
      return;
    }

    var result = JSON.parse(body);
    if (undefined != result.status_code) {
      cb("MonkeyLearn Error - " + result.detail);
      return;
    }
    var label = result.result[0][0].label.trim();
    cb(undefined, label);
  });

};