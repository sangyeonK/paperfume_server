'use strict'

var fs = require("fs");
var firebase = require("firebase");
var gcloud = require('gcloud');

//Firebase - Realtime Database Service Initialize
firebase.initializeApp({
  serviceAccount: "./credentials/firebase-credential.json",
  databaseURL: "https://nexters-paperfume.firebaseio.com/"
});

var db = firebase.database();

//Firebase - Storage Service Initialize
var gcs = gcloud.storage({
  keyFilename: "./credentials/firebase-credential.json",
  projectId: "nexters-paperfume"
});
var bucket = gcs.bucket("nexters-paperfume.appspot.com");

module.exports.db = db;
module.exports.storage = bucket;