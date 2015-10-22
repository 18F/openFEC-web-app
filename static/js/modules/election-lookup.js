'use strict';

/* global window */

var $ = require('jquery');
var URI = require('URIjs');
var _ = require('underscore');
var moment = require('moment');
var topojson = require('topojson');
var colorbrewer = require('colorbrewer');

var L = require('leaflet');
require('leaflet-providers');

var helpers = require('./helpers');
var analytics = require('./analytics');
var utils = require('./election-utils');

var states = require('../data/us-states-10m.json');
var districts = require('../data/stateDistricts.json');

var stateFeatures = topojson.feature(states, states.objects.states).features;

var districtTemplate = require('../../templates/districts.hbs');
var resultTemplate = require('../../templates/electionResult.hbs');
var zipWarningTemplate = require('../../templates/electionZipWarning.hbs');
var noResultsTemplate = require('../../templates/electionNoResults.hbs');

var officeMap = {
  P: 'President',
  S: 'Senate',
  H: 'House'
};

function serializeObject($form) {
  return _.chain($form.serializeArray())
    .map(function(obj) {
      return [obj.name, obj.value];
    })
    .object()
    .value();
}

function formatResult(result, lookup) {
  return _.extend({}, result, {
    officeName: officeMap[result.office],
    electionName: formatName(result),
    electionDate: formatElectionDate(result),
    incumbent: formatIncumbent(result),
    color: formatColor(result, lookup),
    url: formatUrl(result),
  });
}

function formatName(result) {
  var parts = [result.state, officeMap[result.office]];
  if (result.district) {
    parts = parts.concat('District ' + result.district.toString());
  }
  return parts.join(' ');
}

function formatElectionDate(result) {
  var date = moment()
    .year(result.cycle)
    .month('November')
    .date(1);
  while (date.format('E') !== '1') {
    date = date.add(1, 'day');
  }
  return date
    .add(1, 'day')
    .format('MMMM Do, YYYY');
}

function formatIncumbent(result) {
  if (result.incumbent_id) {
    return {
      name: result.incumbent_name,
      url: helpers.buildAppUrl(['candidate', result.incumbent_id])
    };
  } else {
    return null;
  }
}

function formatUrl(result) {
  var path = ['elections', officeMap[result.office].toLowerCase()];
  if (['S', 'H'].indexOf(result.office) !== -1) {
    path = path.concat(result.state);
  }
  if (result.office === 'H') {
    path = path.concat(result.district);
  }
  path = path.concat(result.cycle);
  return helpers.buildAppUrl(path, {});
}

function formatColor(result, lookup) {
  var palette = lookup.map.districtPalette[result.state] || {};
  return palette[result.district % palette.length] || '#000000';
}

function hasOption($select, value) {
  return $select.find('option[value="' + value + '"]').length > 0;
}

function getStatePalette(scale) {
  var colorOptions = _.map(Object.keys(scale), function(key) {
    return parseInt(key);
  });
  return scale[_.max(colorOptions)];
}

function getDistrictPalette(scale) {
  var colorOptions = _.map(Object.keys(scale), function(key) {
    return parseInt(key);
  });
  var minColors = Math.min.apply(null, colorOptions);
  var maxColors = Math.max.apply(null, colorOptions);
  return _.chain(utils.districtFeatures.features)
    .groupBy(function(feature) {
      var district = utils.decodeDistrict(feature.id);
      return district.state;
    })
    .map(function(features, state) {
      var numColors = Math.max(minColors, Math.min(features.length, maxColors));
      return [state, scale[numColors]];
    })
    .object()
    .value();
}

var ElectionFormMixin = {
  handleZipChange: function() {
    this.$state.val('');
    this.$district.val('');
  },

  handleStateChange: function() {
    var state = this.$state.val();
    this.updateDistricts(state);
    if (state) {
      this.$zip.val('');
    }
  },

  updateDistricts: function(state) {
    state = state || this.$state.val();
    this.districts = districts[state] ? districts[state].districts : 0;
    this.$district
      .html(districtTemplate(_.range(1, this.districts + 1)))
      .val('')
      .prop('disabled', !(state && this.districts));
  }
};

function ElectionLookup(selector) {
  this.$elm = $(selector);
  this.init();
}

_.extend(ElectionLookup.prototype, ElectionFormMixin);

ElectionLookup.prototype.init = function() {
  this.districts = 0;
  this.serialized = {};

  this.$form = this.$elm.find('form');
  this.$zip = this.$form.find('[name="zip"]');
  this.$state = this.$form.find('[name="state"]');
  this.$district = this.$form.find('[name="district"]').prop('disabled', true);
  this.$cycle = this.$form.find('[name="cycle"]');
  this.$resultsItems = this.$elm.find('.js-results-items');
  this.$resultsTitle = this.$elm.find('.js-results-title');

  this.$zip.on('change', this.handleZipChange.bind(this));
  this.$state.on('change', this.handleStateChange.bind(this));
  this.$form.on('change', 'input,select', this.search.bind(this));
  this.$form.on('submit', this.search.bind(this));
  $(window).on('popstate', this.handlePopState.bind(this));

  this.handleStateChange();
  this.handlePopState();

  this.$map = $('.election-map');
  this.map = new ElectionLookupMap(this.$map.get(0), {
    drawStates: _.isEmpty(this.serialized),
    handleSelect: this.handleSelectMap.bind(this)
  });
};

ElectionLookup.prototype.handleSelectMap = function(state, district) {
  this.$zip.val('');
  this.$state.val(state);
  this.updateDistricts(state);
  if (district && hasOption(this.$district, district)) {
    this.$district.val(district);
  }
  this.search();
};

ElectionLookup.prototype.getUrl = function(query) {
  return helpers.buildUrl(['elections', 'search'], query);
};

ElectionLookup.prototype.serialize = function() {
  var params = serializeObject(this.$form);
  return _.extend(helpers.filterNull(params));
};

ElectionLookup.prototype.search = function(e, opts) {
  e && e.preventDefault();
  opts = _.extend({pushState: true}, opts || {});
  var self = this;
  var serialized = self.serialize();
  if (self.shouldSearch(serialized) && !_.isEqual(serialized, self.serialized)) {
    $.getJSON(self.getUrl(serialized)).done(function(response) {
      // Note: Update district color map before rendering results
      self.drawDistricts(response.results);
      self.draw(response.results);
    });
    self.serialized = serialized;
    if (opts.pushState) {
      window.history.pushState(serialized, null, URI('').query(serialized).toString());
      analytics.pageView();
    }
  }
};

ElectionLookup.prototype.handlePopState = function() {
  var params = URI.parseQuery(window.location.search);
  this.$zip.val(params.zip);
  this.$state.val(params.state);
  this.handleStateChange();
  this.$district.val(params.district);
  this.$cycle.val(params.cycle || this.$cycle.val());
  this.search(null, {pushState: false});
};

ElectionLookup.prototype.drawDistricts = function(results) {
  var encoded = _.chain(results)
    .filter(function(result) {
      return result.state && result.district;
    })
    .map(function(result) {
      return utils.encodeDistrict(result.state, result.district);
    })
    .value();
  var state = this.$state.val();
  var district = this.$district.val();
  if (state) {
    encoded.push(utils.encodeDistrict(state, district));
  }
  encoded = _.unique(encoded);
  if (encoded.length) {
    this.map.drawDistricts(encoded);
  }
};

ElectionLookup.prototype.shouldSearch = function(serialized) {
  return serialized.zip || serialized.state;
};

ElectionLookup.prototype.draw = function(results) {
  if (results.length) {
    this.$resultsItems.html(resultTemplate(_.map(results, _.partial(formatResult, _, this))));
    if (this.serialized.zip) {
      this.drawZipWarning();
    }
    this.$resultsTitle.text(this.getTitle());
    this.updateLocations();
  } else {
    this.$resultsTitle.text('');
    this.$resultsItems.html(noResultsTemplate(this.serialized));
  }
};

ElectionLookup.prototype.drawZipWarning = function() {
  var houseResults = this.$resultsItems.find('.result[data-office="H"]');
  if (houseResults.length > 1) {
    houseResults.eq(0).before(zipWarningTemplate(this.serialized));
  }
};

/**
 * Fetch location image if not cached, then add to relevant districts
 */
ElectionLookup.prototype.updateLocations = function() {
  var self = this;
  var svg = self.$svg || $.get('/static/img/i-map--primary.svg').then(function(document) {
    self.$svg = $(document.querySelector('svg'));
    return self.$svg;
  });
  $.when(svg).done(self.drawLocations.bind(self));
};

/**
 * Append highlighted location images to relevant districts
 * @param {jQuery} $svg - SVG element
 */
ElectionLookup.prototype.drawLocations = function($svg) {
  this.$resultsItems.find('[data-color]').each(function(_, elm) {
    var $elm = $(elm);
    var $clone = $svg.clone();
    $clone.find('path').css('fill', $elm.data('color'));
    $elm.prepend($clone);
  });
};

ElectionLookup.prototype.getTitle = function() {
  var params = this.serialized;
  var title = params.cycle + ' candidates';
  if (params.zip) {
    title += ' in zip code ' + params.zip;
  } else {
    title += ' in ' + params.state;
    if (params.district && params.district !== '00') {
       title += ', district ' + params.district;
    }
  }
  return title;
};

function ElectionLookupPreview(selector) {
  this.$elm = $(selector);
  this.init();
}

_.extend(ElectionLookupPreview.prototype, ElectionFormMixin);

ElectionLookupPreview.prototype.init = function() {
  this.districts = 0;

  this.$form = this.$elm.find('form');
  this.$zip = this.$form.find('[name="zip"]');
  this.$state = this.$form.find('[name="state"]');
  this.$district = this.$form.find('[name="district"]').prop('disabled', true);
  this.$cycle = this.$form.find('[name="cycle"]');

  this.$zip.on('change', this.handleZipChange.bind(this));
  this.$state.on('change', this.handleStateChange.bind(this));

  this.handleStateChange();
};

var FEATURE_TYPES = {
  STATES: 1,
  DISTRICTS: 2
};
var STATE_ZOOM_THRESHOLD = 4;

var defaultOpts = {
  colorScale: colorbrewer.Set1
};

var boundsOverrides = {
  200: {coords: [64.06, -152.23], zoom: 3}
};

function ElectionLookupMap(elm, opts) {
  this.elm = elm;
  this.opts = _.extend({}, defaultOpts, opts);
  this.statePalette = getStatePalette(this.opts.colorScale);
  this.districtPalette = getDistrictPalette(this.opts.colorScale);
  this.init();
}

ElectionLookupMap.prototype.init = function() {
  this.overlay = null;
  this.districts = null;
  this.map = L.map(this.elm);
  this.map.on('viewreset', this.handleReset.bind(this));
  this.tileLayer = L.tileLayer.provider('Stamen.TonerLite');
  this.tileLayer.on('tileload', this.handleTileLoad.bind(this));
  this.tileLayer.addTo(this.map);
  if (this.opts.drawStates) {
    this.map.setView([37.8, -96], 3);
  }
};

ElectionLookupMap.prototype.drawStates = function() {
  if (this.featureType === FEATURE_TYPES.STATES) { return; }
  this.featureType = FEATURE_TYPES.STATES;
  if (this.overlay) {
    this.map.removeLayer(this.overlay);
  }
  this.districts = null;
  this.overlay = L.geoJson(stateFeatures, {
    onEachFeature: this.onEachState.bind(this)
  }).addTo(this.map);
};

ElectionLookupMap.prototype.drawDistricts = function(districts) {
  if (this.featureType === FEATURE_TYPES.DISTRICTS && !districts) { return; }
  this.featureType = FEATURE_TYPES.DISTRICTS;
  var features = districts ?
    this.filterDistricts(districts) :
    utils.districtFeatures;
  if (this.overlay) {
    this.map.removeLayer(this.overlay);
  }
  this.districts = districts;
  this.overlay = L.geoJson(features, {
    onEachFeature: this.onEachDistrict.bind(this)
  }).addTo(this.map);
  this.updateBounds(districts);
  this.drawBackgroundDistricts(districts);
};

ElectionLookupMap.prototype.updateBounds = function(districts) {
  var rule = districts && _.find(boundsOverrides, function(rule, district) {
    return districts.indexOf(parseInt(district)) !== -1;
  });
  this._viewReset = !!(rule || districts);
  if (rule) {
    this.map.setView(rule.coords, rule.zoom);
  }
  else if (districts) {
    this.map.fitBounds(this.overlay.getBounds());
  }
};

ElectionLookupMap.prototype.drawBackgroundDistricts = function(districts) {
  if (!districts) { return; }
  var states = _.chain(districts)
    .map(function(district) {
      return Math.floor(district / 100);
    })
    .unique()
    .value();
  var stateDistricts = _.filter(utils.districtFeatures.features, function(feature) {
    return states.indexOf(Math.floor(feature.id / 100)) !== -1 &&
      districts.indexOf(feature.id) === -1;
  });
  L.geoJson(stateDistricts, {
    onEachFeature: _.partial(this.onEachDistrict.bind(this), _, _, {color: '#bbbbbb'})
  }).addTo(this.overlay);
};

ElectionLookupMap.prototype.filterDistricts = function(districts) {
  return {
    type: utils.districtFeatures.type,
    features: utils.findDistricts(districts)
  };
};

ElectionLookupMap.prototype.handleStateClick = function(e) {
  if (this.opts.handleSelect) {
    var state = utils.decodeState(e.target.feature.id);
    this.opts.handleSelect(state);
  }
};

ElectionLookupMap.prototype.handleTileLoad = function(e) {
  e.tile.setAttribute('alt', 'Map tile image');
};

ElectionLookupMap.prototype.onEachState = function(feature, layer) {
  var color = this.statePalette[feature.id % this.statePalette.length];
  layer.setStyle({color: color});
  layer.on('click', this.handleStateClick.bind(this));
};

ElectionLookupMap.prototype.onEachDistrict = function(feature, layer, opts) {
  opts = opts || {};
  var decoded = utils.decodeDistrict(feature.id);
  var palette = this.districtPalette[decoded.state];
  var color = palette[decoded.district % palette.length];
  layer.setStyle({color: opts.color || color});
  layer.on('click', this.handleDistrictClick.bind(this));
};

ElectionLookupMap.prototype.handleDistrictClick = function(e) {
  this.map.removeLayer(this.overlay);
  this.drawDistricts([e.target.feature.id]);
  if (this.opts.handleSelect) {
    var district = utils.decodeDistrict(e.target.feature.id);
    this.opts.handleSelect(district.state, district.district);
  }
};

ElectionLookupMap.prototype.handleReset = function(e) {
  if (this._viewReset) {
    this._viewReset = false;
    return;
  }
  var zoom = e.target.getZoom();
  if (zoom <= STATE_ZOOM_THRESHOLD) {
    this.drawStates();
  } else if (!this.districts) {
    this.drawDistricts();
  }
};

module.exports = {
  ElectionLookup: ElectionLookup,
  ElectionLookupMap: ElectionLookupMap,
  ElectionLookupPreview: ElectionLookupPreview
};
