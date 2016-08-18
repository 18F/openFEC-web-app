'use strict';

/* global window, document, ANALYTICS, BASE_PATH, CMS_URL */

var $ = require('jquery');
var Sticky = require('component-sticky');
var Accordion = require('aria-accordion').Accordion;
var Glossary = require('glossary-panel');
var A11yDialog = require('a11y-dialog');

// Hack: Append jQuery to `window` for use by legacy libraries
window.$ = window.jQuery = $;

var terms = require('fec-style/js/terms');
var dropdown = require('fec-style/js/dropdowns');
var siteNav = require('fec-style/js/site-nav');
var skipNav = require('fec-style/js/skip-nav');
var feedback = require('fec-style/js/feedback');
var typeahead = require('fec-style/js/typeahead');
var analytics = require('fec-style/js/analytics');
var stickyBar = require('fec-style/js/sticky-bar');
var toc = require('fec-style/js/toc');

// @if SENTRY_PUBLIC_DSN
require('raven-js').config('/* @echo SENTRY_PUBLIC_DSN */').install();
// @endif

// Include vendor scripts
require('./vendor/tablist').init();

var charts = require('./modules/charts');
var Search = require('./modules/search');
var toggle = require('./modules/toggle');
var helpers = require('./modules/helpers');
var download = require('./modules/download');
var CycleSelect = require('./modules/cycle-select').CycleSelect;

$(document).ready(function() {
  charts.init();

  $('.js-dropdown').each(function() {
    new dropdown.Dropdown(this);
  });

  $('.js-site-nav').each(function() {
    new siteNav.SiteNav(this, {
      cmsUrl: CMS_URL,
      webAppUrl: BASE_PATH
    });
  });

  new skipNav.Skipnav('.skip-nav', 'main');

  // Initialize stick side elements
  $('.js-sticky-side').each(function() {
    var container = $(this).data('sticky-container');
    var opts = {
      within: document.getElementById(container)
    };
    new Sticky(this, opts);
  });

  // Initialize sticky bar elements
  $('.js-sticky-bar').each(function() {
    new stickyBar.StickyBar(this);
  });

  // Initialize glossary
  new Glossary(terms, {}, {
    termClass: 'glossary__term accordion__button',
    definitionClass: 'glossary__definition accordion__content'
  });

  // Initialize typeaheads
  new typeahead.Typeahead(
    '.js-search-input',
    $('.js-search-type').val(),
    BASE_PATH
  );

  // Initialize feedback
  new feedback.Feedback(helpers.buildAppUrl(['issue']));

  // Initialize new accordions
  $('.js-accordion').each(function(){
    var contentPrefix = $(this).data('content-prefix') || 'accordion';
    var openFirst = $(this).data('open-first');
    var selectors = {
      body: '.js-accordion',
      trigger: '.js-accordion-trigger'
    };
    var opts = {
      contentPrefix: contentPrefix,
      openFirst: openFirst
    };
    new Accordion(selectors, opts);
  });

  // Initialize search
  $('.js-search').each(function() {
    new Search($(this));
  });

  // Initialize table of contents
  $('.js-toc').each(function() {
    new toc.TOC(this);
  });

  $('.js-modal').each(function() {
    new A11yDialog(this);
    this.addEventListener('dialog:show', function(e) {
      $('body').css('overflow', 'hidden');
    });
    this.addEventListener('dialog:hide', function(e) {
      $('body').css('overflow', 'scroll');
    });
  });

  // TODO: Restore
  // @if DEBUG
  // var perf = require('./modules/performance');
  // perf.bar();
  // @endif

  if (ANALYTICS) {
    analytics.init();
    analytics.pageView();
  }

  // Initialize cycle selects
  $('.js-cycle').each(function(idx, elm) {
    CycleSelect.build($(elm));
  });

  toggle.init();
  download.hydrate();
});
