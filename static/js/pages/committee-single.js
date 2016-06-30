'use strict';

/* global document, context */

var $ = require('jquery');
var _ = require('underscore');

var events = require('fec-style/js/events');

var maps = require('../modules/maps');
var tables = require('../modules/tables');
var filings = require('../modules/filings');
var helpers = require('../modules/helpers');
var columnHelpers = require('../modules/column-helpers');
var columns = require('../modules/columns');

var tableOpts = {
  dom: tables.simpleDOM,
  pagingType: 'simple',
  lengthChange: false,
  pageLength: 10,
  hideEmpty: true
};

var sizeColumns = [
  {
    data: 'size',
    width: '50%',
    className: 'all',
    render: function(data, type, row, meta) {
      return columnHelpers.sizeInfo[data].label;
    }
  },
  {
    data: 'total',
    width: '50%',
    className: 'all',
    orderSequence: ['desc', 'asc'],
    render: columnHelpers.buildTotalLink(['receipts'], function(data, type, row, meta) {
      return columnHelpers.getSizeParams(row.size);
    })
  }
];

var committeeColumns = [
  {
    data: 'committee_name',
    className: 'all',
    orderable: false,
    render: function(data, type, row, meta) {
      return columnHelpers.buildEntityLink(
        data,
        helpers.buildAppUrl(['committee', row.committee_id]),
        'committee'
      );
    }
  },
  {
    data: 'total',
    className: 'all',
    orderable: false,
    orderSequence: ['desc', 'asc'],
    render: columnHelpers.buildTotalLink(['disbursements'], function(data, type, row, meta) {
      return {
        committee_id: row.committee_id,
        recipient_name: row.recipient_id
      };
    })
  }
];

var stateColumns = [
  {
    data: 'state_full',
    width: '50%',
    className: 'all',
    render: function(data, type, row, meta) {
      var span = document.createElement('span');
      span.textContent = data;
      span.setAttribute('data-state', data);
      span.setAttribute('data-row', meta.row);
      return span.outerHTML;
    }
  },
  {
    data: 'total',
    width: '50%',
    className: 'all',
    orderSequence: ['desc', 'asc'],
    render: columnHelpers.buildTotalLink(['receipts'], function(data, type, row, meta) {
      return {
        contributor_state: row.state,
        is_individual: 'true'
      };
    })
  },
];

var employerColumns = [
  {data: 'employer', className: 'all', orderable: false, defaultContent: 'NOT REPORTED'},
  {
    data: 'total',
    className: 'all',
    orderable: false,
    orderSequence: ['desc', 'asc'],
    render: columnHelpers.buildTotalLink(['receipts'], function(data, type, row, meta) {
      if (row.employer) {
        return {
          contributor_employer: row.employer,
          is_individual: 'true'
        };
      } else {
        return null;
      }
    })
  }
];

var occupationColumns = [
  {data: 'occupation', className: 'all', orderable: false, defaultContent: 'NOT REPORTED'},
  {
    data: 'total',
    className: 'all',
    orderable: false,
    orderSequence: ['desc', 'asc'],
    render: columnHelpers.buildTotalLink(['receipts'], function(data, type, row, meta) {
      if (row.occupation) {
        return {
          contributor_occupation: row.occupation,
          is_individual: 'true'
        };
      } else {
        return null;
      }
    })
  }
];

var filingsColumns = columnHelpers.getColumns(
  columns.filings,
  [
    'pdf_url', 'amendment_indicator', 'receipt_date', 'coverage_end_date',
    'total_receipts', 'total_disbursements', 'total_independent_expenditures',
    'modal_trigger'
  ]
);

var disbursementPurposeColumns = [
  {data: 'purpose', className: 'all', orderable: false},
  {
    data: 'total',
    className: 'all',
    orderable: false,
    orderSequence: ['desc', 'asc'],
    render: columnHelpers.buildTotalLink(['disbursements'], function(data, type, row, meta) {
      return {disbursement_purpose_categories: row.purpose.toLowerCase()};
    })
  }
];

var disbursementRecipientColumns = [
  {data: 'recipient_name', className: 'all', orderable: false},
  {
    data: 'total',
    className: 'all',
    orderable: false,
    orderSequence: ['desc', 'asc'],
    render: columnHelpers.buildTotalLink(['disbursements'], function(data, type, row, meta) {
      return {recipient_name: row.recipient_name};
    })
  }
];

var disbursementRecipientIDColumns = [
  {
    data: 'recipient_name',
    className: 'all',
    orderable: false,
    render: function(data, type, row, meta) {
      return columnHelpers.buildEntityLink(
        data,
        helpers.buildAppUrl(['committee', row.recipient_id]),
        'committee'
      );
    }
  },
  {
    data: 'total',
    className: 'all',
    orderable: false,
    orderSequence: ['desc', 'asc'],
    render: columnHelpers.buildTotalLink(['disbursements'], function(data, type, row, meta) {
      return {recipient_name: row.recipient_id};
    })
  }
];

var expendituresColumns = [
  {
    data: 'total',
    className: 'all',
    orderable: true,
    orderSequence: ['desc', 'asc'],
    render: columnHelpers.buildTotalLink(['independent-expenditures'], function(data, type, row, meta) {
      return {
        support_oppose_indicator: row.support_oppose_indicator,
        candidate_id: row.candidate_id,
        // is_notice: false,
      };
    })
  },
  columns.supportOpposeColumn,
  columns.candidateColumn({data: 'candidate', className: 'all'})
];

var electioneeringColumns = [
  {
    data: 'total',
    className: 'all',
    orderable: true,
    orderSequence: ['desc', 'asc'],
    render: columnHelpers.buildTotalLink(['electioneering-communications'], function(data, type, row, meta) {
      return {
        support_oppose_indicator: row.support_oppose_indicator,
        candidate_id: row.candidate_id,
      };
    })
  },
  columns.candidateColumn({data: 'candidate', className: 'all'})
];

var communicationCostColumns = [
  {
    data: 'total',
    className: 'all',
    orderable: true,
    orderSequence: ['desc', 'asc'],
    render: columnHelpers.buildTotalLink(['communication-costs'], function(data, type, row, meta) {
      return {
        support_oppose_indicator: row.support_oppose_indicator,
        candidate_id: row.candidate_id,
      };
    })
  },
  columns.supportOpposeColumn,
  columns.candidateColumn({data: 'candidate', className: 'all'})
];

function buildStateUrl($elm) {
  return helpers.buildUrl(
    ['committee', $elm.data('committee-id'), 'schedules', 'schedule_a', 'by_state'],
    {cycle: $elm.data('cycle'), per_page: 99}
  );
}

function highlightRowAndState($map, $table, state, scroll) {
  var $scrollBody = $table.closest('.dataTables_scrollBody');
  var $row = $scrollBody.find('span[data-state="' + state + '"]');

  if ($row.length > 0) {
    maps.highlightState($('.state-map'), state);
    $scrollBody.find('.row-active').removeClass('row-active');
    $row.parents('tr').addClass('row-active');
    if (scroll) {
      $scrollBody.animate({
        scrollTop: $row.closest('tr').height() * parseInt($row.attr('data-row'))
      }, 500);
    }
  }

}

var aggregateCallbacks = {
  afterRender: tables.barsAfterRender.bind(undefined, undefined),
};

$(document).ready(function() {
  // Set up data tables
  $('.data-table').each(function(index, table) {
    var $table = $(table);
    var committeeId = $table.attr('data-committee');
    var cycle = $table.attr('data-cycle');
    var query = {cycle: cycle};
    var path;
    switch ($table.attr('data-type')) {
    case 'committee-contributor':
      path = ['schedules', 'schedule_b', 'by_recipient_id'];
      tables.DataTable.defer($table, {
        path: path,
        query: _.extend({recipient_id: committeeId}, query),
        columns: committeeColumns,
        callbacks: aggregateCallbacks,
        dom: tables.simpleDOM,
        order: [[1, 'desc']],
        pagingType: 'simple',
        lengthChange: false,
        pageLength: 10,
        hideEmpty: true,
        hideEmptyOpts: {
          dataType: 'disbursements received from other committees',
          name: context.name,
          timePeriod: context.timePeriod
        }
      });
      break;
    case 'contribution-size':
      path = ['committee', committeeId, 'schedules', 'schedule_a', 'by_size'];
      tables.DataTable.defer($table, {
        path: path,
        query: query,
        columns: sizeColumns,
        callbacks: aggregateCallbacks,
        dom: 't',
        order: [[1, 'desc']],
        pagingType: 'simple',
        lengthChange: false,
        pageLength: 10,
        hideEmpty: true,
        hideEmptyOpts: {
          dataType: 'individual contributions',
          name: context.name,
          timePeriod: context.timePeriod
        }
      });
      break;
    case 'receipts-by-state':
      path = ['committee', committeeId, 'schedules', 'schedule_a', 'by_state'];
      query = _.extend(query, {per_page: 99});
      tables.DataTable.defer($table, {
        path: path,
        query: query,
        columns: stateColumns,
        callbacks: aggregateCallbacks,
        dom: 't',
        order: [[1, 'desc']],
        paging: false,
        scrollY: 400,
        scrollCollapse: true
      });
      events.on('state.map', function(params) {
        var $map = $('.state-map');
        highlightRowAndState($map, $table, params.state, true);
      });
      $table.on('click', 'tr', function() {
        events.emit('state.table', {
          state: $(this).find('span[data-state]').attr('data-state')
        });
      });
      break;
    case 'receipts-by-employer':
      path = ['committee', committeeId, 'schedules', 'schedule_a', 'by_employer'];
      tables.DataTable.defer(
        $table,
        _.extend({}, tableOpts, {
          path: path,
          query: query,
          columns: employerColumns,
          callbacks: aggregateCallbacks,
          order: [[1, 'desc']],
          hideEmptyOpts: {
            dataType: 'individual contributions',
            name: context.name,
            timePeriod: context.timePeriod
          },
        })
      );
      break;
    case 'receipts-by-occupation':
      path = ['committee', committeeId, 'schedules', 'schedule_a', 'by_occupation'];
      tables.DataTable.defer(
        $table,
        _.extend({}, tableOpts, {
          path: path,
          query: query,
          columns: occupationColumns,
          callbacks: aggregateCallbacks,
          order: [[1, 'desc']],
          hideEmptyOpts: {
            dataType: 'individual contributions',
            name: context.name,
            timePeriod: context.timePeriod
          },
        })
      );
      break;
    case 'filing':
      path = ['committee', committeeId, 'filings'];
      tables.DataTable.defer($table, {
        path: path,
        query: query,
        columns: filingsColumns,
        rowCallback: filings.renderRow,
        dom: '<"panel__main"t><"results-info"frip>',
        pagingType: 'simple',
        // Order by receipt date descending
        order: [[2, 'desc']],
        useFilters: true,
        hideEmpty: true,
        hideEmptyOpts: {
          dataType: 'filings',
          name: context.name,
          timePeriod: context.timePeriod
        },
        callbacks: {
          afterRender: filings.renderModal
        }
      });
      break;
    case 'disbursements-by-purpose':
      path = ['committee', committeeId, 'schedules', 'schedule_b', 'by_purpose'];
      tables.DataTable.defer(
        $table,
        _.extend({}, tableOpts, {
          path: path,
          query: query,
          columns: disbursementPurposeColumns,
          callbacks: aggregateCallbacks,
          order: [[1, 'desc']],
          hideEmptyOpts: {
            dataType: 'disbursements',
            name: context.name,
            timePeriod: context.timePeriod
          },
        })
      );
      break;
    case 'disbursements-by-recipient':
      path = ['committee', committeeId, 'schedules', 'schedule_b', 'by_recipient'];
      tables.DataTable.defer(
        $table,
        _.extend({}, tableOpts, {
          path: path,
          query: query,
          columns: disbursementRecipientColumns,
          callbacks: aggregateCallbacks,
          order: [[1, 'desc']],
          hideEmptyOpts: {
            dataType: 'disbursements',
            name: context.name,
            timePeriod: context.timePeriod
          },
        })
      );
      break;
    case 'disbursements-by-recipient-id':
      path = ['committee', committeeId, 'schedules', 'schedule_b', 'by_recipient_id'];
      tables.DataTable.defer(
        $table,
        _.extend({}, tableOpts, {
          path: path,
          query: query,
          columns: disbursementRecipientIDColumns,
          callbacks: aggregateCallbacks,
          order: [[1, 'desc']],
          hideEmptyOpts: {
            dataType: 'disbursements to committees',
            name: context.name,
            timePeriod: context.timePeriod
          },
        })
      );
      break;
    case 'independent-expenditure-committee':
      path = ['committee', committeeId, 'schedules', 'schedule_e', 'by_candidate'];
      tables.DataTable.defer($table, {
        path: path,
        query: query,
        columns: expendituresColumns,
        order: [[0, 'desc']],
        dom: tables.simpleDOM,
        pagingType: 'simple',
        hideEmpty: true,
        hideEmptyOpts: {
          dataType: 'independent expenditures',
          name: context.name,
          timePeriod: context.timePeriod
        },
      });
      break;
    case 'electioneering-committee':
      path = ['committee', committeeId, 'electioneering', 'by_candidate'];
      tables.DataTable.defer($table, {
        path: path,
        query: query,
        columns: electioneeringColumns,
        order: [[0, 'desc']],
        dom: tables.simpleDOM,
        pagingType: 'simple',
        hideEmpty: true,
        hideEmptyOpts: {
          dataType: 'electioneering communications',
          name: context.name,
          timePeriod: context.timePeriod
        },
      });
      break;
    case 'communication-cost-committee':
      path = ['committee', committeeId, 'communication_costs', 'by_candidate'];
      tables.DataTable.defer($table, {
        path: path,
        query: query,
        columns: communicationCostColumns,
        order: [[0, 'desc']],
        dom: tables.simpleDOM,
        pagingType: 'simple',
        hideEmpty: true,
        hideEmptyOpts: {
          dataType: 'communication costs',
          name: context.name,
          timePeriod: context.timePeriod
        },
      });
      break;
    }
  });

  // Set up state map
  var $map = $('.state-map');
  var url = buildStateUrl($map);
  $.getJSON(url).done(function(data) {
    maps.stateMap($map, data, 400, 300, null, null, true, true);
  });
  events.on('state.table', function(params) {
    highlightRowAndState($map, $('.data-table'), params.state, false);
  });
  $map.on('click', 'path[data-state]', function() {
    var state = $(this).attr('data-state');
    events.emit('state.map', {state: state});
  });
});
