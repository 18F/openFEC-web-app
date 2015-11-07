'use strict';

/* global window */

var chai = require('chai');
var sinon = require('sinon');
var sinonChai = require('sinon-chai');
var expect = chai.expect;
chai.use(sinonChai);

var $ = require('jquery');
var URI = require('URIjs');
var _ = require('underscore');

require('../setup')();

_.extend(window, {
  context: {
    districts: {
      NJ: {state: 'New Jersey', districts: 12},
      VA: {state: 'Virginia', districts: 11}
    }
  }
});

var lookup = require('../../../static/js/modules/election-lookup');

describe('election lookup', function() {
  before(function() {
    this.$fixture = $('<div id="fixtures"></div>');
    $('body').append(this.$fixture);
  });

  before(function() {
    sinon.stub(lookup.ElectionLookupMap.prototype, 'init');
    sinon.stub(lookup.ElectionLookupMap.prototype, 'drawDistricts');
  });

  beforeEach(function() {
    this.$fixture.empty().append(
      '<div id="election-lookup">' +
        '<form>' +
          '<input name="cycle" value="2016" />' +
          '<input name="zip" />' +
          '<input name="state" />' +
          '<input name="district" />' +
        '</form>' +
        '<div class="results">' +
          '<div class="js-results-items"></div>' +
        '</div>' +
        '<div class="election-map"></div>' +
      '</div>'
    );
    window.history.pushState({}, null, '/');
    this.el = new lookup.ElectionLookup('#election-lookup');
  });

  it('should memorize its selector', function() {
    expect(this.el.$elm.is($('#election-lookup'))).to.be.true;
  });

  it('should memorize its inputs', function() {
    expect(this.el.$zip.is($('#election-lookup [name="zip"]'))).to.be.true;
    expect(this.el.$state.is($('#election-lookup [name="state"]'))).to.be.true;
    expect(this.el.$district.is($('#election-lookup [name="district"]'))).to.be.true;
  });

  it('should disable the district select when state is not set', function() {
    this.el.$state.val('').change();
    expect(this.el.$district.prop('disabled')).to.equal(true);
  });

  it('should disable the district select when state is set and the state does not have districts', function() {
    this.el.$state.val('AS').change();
    expect(this.el.$district.prop('disabled')).to.equal(true);
  });

  it('should enable the district select when state is set and the state has districts', function() {
    this.el.$state.val('VA').change();
    expect(this.el.$district.prop('disabled')).to.equal(false);
  });

  it('should serialize zip codes', function() {
    this.el.$zip.val('22902');
    expect(this.el.serialize()).to.deep.equal({cycle: '2016', zip: '22902'});
  });

  it('should serialize state and district inputs', function() {
    this.el.$state.val('VA').change();
    this.el.$district.val('01');
    expect(this.el.serialize()).to.deep.equal({cycle: '2016', state: 'VA', district: '01'});
  });

  it('should draw search results', function() {
    var results = [
      {cycle: 2016, office: 'P', state: 'US'},
      {cycle: 2016, office: 'S', state: 'NJ'},
      {cycle: 2016, office: 'H', state: 'NJ', district: '09'}
    ];
    this.el.serialized = {cycle: '2016', state: 'NJ', district: '09'};
    this.el.draw(results);
    var $rendered = this.el.$resultsItems.find('.result');
    var titles = $rendered.map(function(idx, elm) {
      return $(elm).find('h3').text().trim();
    }).get();
    expect(titles).to.deep.equal(['US President', 'NJ Senate', 'NJ House District 09']);
  });

  it('should show no results warning on no results by zip', function() {
    this.el.serialized = {cycle: '2016', zip: '19041'};
    this.el.draw([]);
    expect(this.el.$resultsItems.text()).to.contain("We can't find any results for this ZIP code");
    expect(this.el.$resultsTitle.text()).to.equal('');
  });

  it('should show no results warning on no results by state', function() {
    this.el.serialized = {cycle: '2016', state: 'VI'};
    this.el.draw([]);
    expect(this.el.$resultsItems.text()).to.contain("We can't find any results for this location");
    expect(this.el.$resultsTitle.text()).to.equal('');
  });

  describe('fetching ajax', function() {
    beforeEach(function() {
      this.response = {
        results: [
          {cycle: 2016, office: 'P', state: 'US'},
          {cycle: 2016, office: 'S', state: 'NJ'},
          {cycle: 2016, office: 'H', state: 'NJ', district: '09'}
        ]
      };
      this.deferred = $.Deferred();
      sinon.stub($, 'ajax').returns(this.deferred);
      this.deferred.resolve(this.response);
    });

    afterEach(function() {
      $.ajax.restore();
    });

    it('should fetch search results', function() {
      sinon.stub(this.el, 'draw');
      this.el.$zip.val('19041');
      this.el.search();
      expect($.ajax).to.have.been.called;
      var call = $.ajax.getCall(0);
      var uri = URI(call.args[0].url);
      expect(uri.path()).to.equal('/v1/elections/search/');
      expect(URI.parseQuery(uri.search())).to.deep.equal({api_key: '12345', cycle: '2016', zip: '19041'});
      expect(URI.parseQuery(window.location.search)).to.deep.equal({cycle: '2016', zip: '19041'});
      expect(this.el.draw).to.have.been.calledWith(this.response.results);
    });

    it('should update form and search on popstate', function() {
      sinon.stub(this.el, 'draw');
      window.history.pushState({}, null, '?cycle=2016&zip=19041');
      this.el.handlePopState();
      expect(this.el.$zip.val()).to.equal('19041');
      expect($.ajax).to.have.been.called;
      var call = $.ajax.getCall(0);
      var uri = URI(call.args[0].url);
      expect(uri.path()).to.equal('/v1/elections/search/');
      expect(URI.parseQuery(uri.search())).to.deep.equal({api_key: '12345', cycle: '2016', zip: '19041'});
    });

    it('should skip search if missing params', function() {
      sinon.stub(this.el, 'draw');
      this.el.search();
      expect($.ajax).not.to.have.been.called;
      expect(this.el.draw).not.to.have.been.called;
    });
  });
});
