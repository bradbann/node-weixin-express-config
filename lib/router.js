'use strict';

var assert = require('assert');
var express = require('express');
var Router = express.Router;
var fs = require('fs');
var storageLib = require('./storage');
var urls = require('./urls');
var validations = require('./validations/');

function getAppIdDefault(req, name) {
  var keys = ['params', 'body', 'query', 'session'];
  for (var i = 0; i < keys.length; i++) {
    if (req[keys[i]] && req[keys[i]][name]) {
      return req[keys[i]][name];
    }
  }
}

module.exports = function config(appIdParam, settings, cb, appIdGetter) {
  appIdGetter = appIdGetter || getAppIdDefault;
  var router = new Router({
    mergeParams: true
  });
  var storage = storageLib(settings);
  var getHandler = function(req, res) {
    var id = appIdGetter(req, appIdParam);
    var type = req.params.type;
    storage.get(id, type, function(data) {
      cb(req, res, id, data);
    });
  };
  var postHandler = function(req, res) {
    var id = appIdGetter(req, appIdParam);
    var data = req.body;
    var type = req.params.type;
    var clone = {};
    for (var k in validations[type]) {
      if (data[k] !== undefined) {
        clone[k] = data[k];
      }
    }
    data = clone;
    switch (type) {
      case 'certificate':
        assert(req.file instanceof Function);
        req.file('pfx').upload(function(error, files) {
          var value = {
            pfxKey: req.body.pfxKey,
            pfx: null
          };
          if (files && files.length) {
            var content = fs.readFileSync(files[0].fd);
            value.pfx = content;
          }
          storage.set(id, type, value, function(saved) {
            cb(req, res, id, saved);
          });
        });
        return;
      case 'urls':
        data = urls(req.body.url);
        break;
    }
    storage.set(id, type, data, function(value) {
      cb(req, res, id, value);
    });
  };

  router.get('/:type', getHandler);
  router.post('/:type', postHandler);
  router.__handlers = {
    get: getHandler,
    post: postHandler
  };
  return router;
};
