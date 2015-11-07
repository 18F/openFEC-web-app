var istanbul = require('browserify-istanbul');

module.exports = function(config) {
  config.set({
    frameworks: ['browserify', 'phantomjs-shim', 'mocha', 'chai-sinon'],

    files: [
      'tests/unit/**/*.js',
      'static/js/pages/**/*.js',
      'static/js/modules/**/*.js'
    ],

    preprocessors: {
      'tests/unit/**/*.js': ['browserify'],
      'static/js/pages/**/*.js': ['browserify'],
      'static/js/modules/**/*.js': ['browserify']
    },

    browserify: {
      debug: true,
      transform: [
        'hbsfy',
        istanbul({
          ignore: [
            'tests/unit/**/*',
            '**/templates/**'
          ]
        })
      ]
    },

    coverageReporter: {
      subdir: '.',
      reporters: [
        {type: 'html'},
        {type: 'text'},
        {type: 'json', file: 'coverage.json'}
      ]
    },

    reporters: ['progress', 'coverage'],
    browsers: ['Chrome'],
    port: 9876
  });
};
