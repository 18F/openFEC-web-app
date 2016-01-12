'use strict';

var $ = require('jquery');
var URI = require('urijs');
var _ = require('underscore');
var moment = require('moment');

var templates = {
  pending: require('../../templates/download/pending.hbs'),
  complete: require('../../templates/download/complete.hbs'),
  container: require('../../templates/download/container.hbs')
};

var PREFIX = 'download-';
var DATE_FORMAT = 'YYYY-MM-DDTHH:mm:ss';

function hydrate() {
  return storedDownloads().map(function(key) {
    return download(key.slice(PREFIX.length), true);
  });
}

function download(url, init) {
  var container = DownloadContainer.getInstance(document.body);
  var item = new DownloadItem(url, container);

  if (init || !item.isPending) {
    item.init();
  }
  return item;
}

function isPending(url) {
  return !!window.localStorage.getItem(PREFIX + url);
}

function storedDownloads() {
  return Object.keys(window.localStorage).filter(function(key) {
    return key.indexOf(PREFIX) === 0;
  });
}

function pendingCount() {
  return storedDownloads().length;
}

function getUrlParts(url) {
  var uri = URI(url);
  var path = uri.path().split('/');
  path.splice(2, 0, 'download');
  uri.path(path.join('/'));
  return {
    resource: path[path.length - 2],
    apiUrl: uri.toString()
  };
}

var defaultOpts = {
  timeout: 5000
};

function DownloadItem(url, container, opts) {
  this.url = url;
  this.container = container;
  this.opts = _.extend({}, defaultOpts, opts);

  this.$body = null;
  this.$parent = this.container.$list;

  this.timeout = null;
  this.promise = null;

  this.key = PREFIX + this.url;

  var urlParts = getUrlParts(this.url);
  this.apiUrl = urlParts.apiUrl;
  this.resource = urlParts.resource;

  var payload = JSON.parse(window.localStorage.getItem(this.key)) || {};
  this.timestamp = payload.timestamp || moment().format(DATE_FORMAT);
  this.downloadUrl = payload.downloadUrl;
  this.isPending = !_.isEmpty(payload);

  this.filename = this.resource + '-' + this.timestamp + '.zip';
}

DownloadItem.prototype.init = function() {
  this.draw();
  this.container.add();
  if (!this.downloadUrl) {
    this.refresh();
    this.push();
  }
};

DownloadItem.prototype.draw = function() {
  var template = this.downloadUrl ? templates.complete : templates.pending;
  var $body = $(template(this.serialize()));
  if (this.$body) {
    this.$body.replaceWith($body);
  } else {
    $body.appendTo(this.$parent);
  }
  $body.find('.js-close').on('click', this.close.bind(this));
  this.$body = $body;
};

DownloadItem.prototype.serialize = function() {
  return {
    url: this.url,
    apiUrl: this.apiUrl,
    downloadUrl: this.downloadUrl,
    filename: this.filename
  };
};

DownloadItem.prototype.schedule = function() {
  this.timeout = window.setTimeout(this.refresh.bind(this), this.opts.timeout);
};

DownloadItem.prototype.push = function() {
  window.localStorage.setItem(
    this.key,
    JSON.stringify({
      timestamp: this.timestamp,
      downloadUrl: this.downloadUrl
    })
  );
};

DownloadItem.prototype.refresh = function() {
  this.promise = $.ajax({
    method: 'POST',
    url: this.apiUrl,
    data: JSON.stringify({filename: this.filename}),
    contentType: 'application/json'
  });
  this.promise.then(this.handleSuccess.bind(this));
  this.promise.fail(this.handleError.bind(this));
};

DownloadItem.prototype.cancel = function() {
  var message = 'Your request contains more than 100,000 results.';
  this.close();
  window.alert(message);
};

DownloadItem.prototype.handleSuccess = function(response) {
  if (response && response.status === 'complete') {
    this.finish(response.url);
  } else {
    this.schedule();
  }
};

DownloadItem.prototype.handleError = function(xhr, textStatus) {
  if (textStatus !== 'abort') {
    this.schedule();
  } else if (xhr.status === 403) {
    this.cancel();
  }
};

DownloadItem.prototype.finish = function(downloadUrl) {
  this.downloadUrl = downloadUrl;
  this.push();
  this.draw();
};

DownloadItem.prototype.close = function() {
  window.clearTimeout(this.timeout);
  this.promise && this.promise.abort();
  this.$body && this.$body.remove();
  window.localStorage.removeItem(this.key);
  this.container.subtract();
};

function DownloadContainer(parent) {
  this.$parent = $(parent);
  this.$body = $(templates.container());
  this.$list = this.$body.find('.js-downloads-list');
  this.$parent.append(this.$body);
  this.items = 0;
}

DownloadContainer.prototype.add = function() {
  this.items++;
  if (this.$body) {
    this.$body.trigger({type: 'download:countChanged', count: this.items});
  }
};

DownloadContainer.prototype.subtract = function() {
  this.items = this.items - 1;
  if (this.$body) {
    this.$body.trigger({type: 'download:countChanged', count: this.items});
  }
  if (this.items === 0) {
    this.destroy();
  }
};

DownloadContainer.prototype.destroy = function() {
  this.$body.remove();
  DownloadContainer.instance = null;
};

DownloadContainer.instance = null;
DownloadContainer.getInstance = function(parent) {
  DownloadContainer.instance = DownloadContainer.instance || new DownloadContainer(parent);
  return DownloadContainer.instance;
};

module.exports = {
  hydrate: hydrate,
  download: download,
  isPending: isPending,
  pendingCount: pendingCount,
  DownloadItem: DownloadItem,
  DownloadContainer: DownloadContainer
  };
