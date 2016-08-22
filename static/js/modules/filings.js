'use strict';

/* global require, module */

var $ = require('jquery');
var _ = require('underscore');

var tables = require('./tables');
var helpers = require('../modules/helpers');

var candidateTemplate = require('../../templates/reports/candidate.hbs');
var pacTemplate = require('../../templates/reports/pac.hbs');
var ieTemplate = require('../../templates/reports/ie-only.hbs');

var templates = {
  F3: candidateTemplate,
  F3P: candidateTemplate,
  F3X: pacTemplate,
  F5: ieTemplate
};

function resolveTemplate(row) {
  return templates[row.form_type](row);
}

var renderModal = tables.modalRenderFactory(
  resolveTemplate,
  function(row) {
    var url = helpers.buildUrl(
      ['committee', row.committee_id, 'reports'],
      {beginning_image_number: row.beginning_image_number}
    );
    return $.getJSON(url).then(function(response) {
      var result = response.results.length ?
        response.results[0] :
        {};
      return _.extend({}, row, result);
    });
  }
);

function renderRow(row, data, index) {
  if (data.form_type && data.form_type.match(/^F[35][XP]?$/)) {
    row.classList.add(tables.MODAL_TRIGGER_CLASS, 'row--has-panel');
  }
}

module.exports = {
  renderModal: renderModal,
  renderRow: renderRow
};
