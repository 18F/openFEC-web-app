import math
import calendar
import datetime
import threading

import cachetools
import cachecontrol

from openfecwebapp import constants


def current_cycle():
    year = datetime.datetime.now().year
    return year + year % 2

class LRUCache(cachecontrol.cache.BaseCache):
    """A thread-safe least recently updated cache adapted to work with
    Cache-Control.
    """
    def __init__(self, maxsize):
        self.lock = threading.Lock()
        self.data = cachetools.LRUCache(maxsize)

    def get(self, key):
        return self.data.get(key, None)

    def set(self, key, value):
        with self.lock:
            self.data[key] = value

    def delete(self, key):
        with self.lock:
            self.data.clear()

class ReverseProxied(object):
    """Wrap the application in this middleware and configure the
    front-end server to add these headers, to let you quietly bind
    this to a URL other than / and to an HTTP scheme that is
    different than what is used locally.

    From http://flask.pocoo.org/snippets/35/.

    In nginx:
    location /myprefix {
        proxy_pass http://192.168.0.1:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Scheme $scheme;
        proxy_set_header X-Script-Name /myprefix;
    }

    :param app: the WSGI application
    """
    def __init__(self, app):
        self.app = app

    def __call__(self, environ, start_response):
        script_name = environ.get('HTTP_X_SCRIPT_NAME', '')
        if script_name:
            environ['SCRIPT_NAME'] = script_name
            path_info = environ['PATH_INFO']
            if path_info.startswith(script_name):
                environ['PATH_INFO'] = path_info[len(script_name):]

        scheme = environ.get('HTTP_X_SCHEME', '')
        if scheme:
            environ['wsgi.url_scheme'] = scheme
        return self.app(environ, start_response)


def date_ranges():
    """Build date ranges for current day, month, quarter, and year.
    """
    today = datetime.date.today()
    quarter = math.floor((today.month - 1) / 3)
    cycle = current_cycle()
    return {
        'month': (
            today.replace(day=1),
            today.replace(day=calendar.monthrange(today.year, today.month)[1]),
        ),
        'quarter': (
            today.replace(day=1, month=quarter * 3 + 1),
            today.replace(
                day=calendar.monthrange(today.year, quarter * 3 + 3)[1],
                month=quarter * 3 + 3,
            ),
        ),
        'year': (
            today.replace(day=1, month=1),
            today.replace(
                day=calendar.monthrange(today.year, 12)[1],
                month=12,
            ),
        ),
        'cycle': (
            datetime.date(
                year=cycle - 1,
                month=1,
                day=1,
            ),
            datetime.date(
                year=cycle,
                month=12,
                day=calendar.monthrange(cycle, 12)[1],
            ),
        ),
    }

def get_cycles(max_cycle=None):
    max = max_cycle if max_cycle else current_cycle()
    return range(max, constants.START_YEAR, -2)

def election_title(cycle, office, state=None, district=None):
    base = ' '.join([str(cycle), 'Election', 'United States', office.capitalize()])
    parts = [base]
    if state:
        parts.append(constants.states[state.upper()])
    if district:
        parts.append('District {0}'.format(district))
    return ' - '.join(parts)

def page_info(pagination):
    """Generate a string showing number of results out of how many
    based on a pagination object from an API response
    """
    page = pagination['page']
    per_page = pagination['per_page']
    count = '{:,}'.format(pagination['count'])
    range_start = per_page * (page - 1) + 1
    range_end = (page - 1) * 10 + per_page
    return '{range_start}-{range_end} of {count}'.format(range_start=range_start, range_end=range_end, count=count)

def financial_summary_processor(totals, formatter):
    """ Process totals data by getting the label and hierarchy level for each value
    """
    processed = []
    for i in formatter:
        if i in totals:
            line = (totals[i], formatter[i])
            processed.append(line)
    return processed

def process_raising_data(totals):
    """
    Processes raising totals by mapping to the RAISING_FORMATTER constant
    Occassionally, the API schema is slightly out of sync with what we want to display,
    so there's logic here to remove or rename items depending on the form we're showing
    """

    # If there's repayments_loans_made_by_candidate, it's an F3P .
    # In this case, loan_repayments_made is a subtotal and shouldn't be linked to
    # For F3, loan_repayments_made is just a single line and should be a link
    # So this renames it for proper formatting of F3P
    if 'loan_repayments_made' in totals and 'repayments_loans_made_by_candidate' in totals:
        totals['total_loan_repayments_made'] = totals['loan_repayments_made']
        del totals['loan_repayments_made']

    # If there's shared_fed_operating_expenditures, it's an F3X filer.
    # In this case, operating_expenditures is a subtotal and shouldn't be linked
    # So this renames it and deletes the original reference for F3X
    if 'operating_expenditures' in totals and 'shared_fed_operating_expenditures' in totals:
        totals['total_operating_expenditures'] = totals['operating_expenditures']
        del totals['operating_expenditures']

    # There's some fields only available on F3P but that are included in the responses for F3.
    # So this checks for them and then deletes
    if 'offsets_to_legal_accounting' in totals and 'all_other_loans' in totals:
        del totals['offsets_to_legal_accounting']
        del totals['offsets_to_fundraising_expenditures']
        del totals['total_offsets_to_operating_expenditures']
        del totals['federal_funds']

    # Presidential committees show total offsets AND offsets to operating expenditures
    # We want to nest the latter under the former as a third-level item,
    # but because other committees use offsets_to_operating expenditures at the second level,
    # we store that as a new value and remove the old one
    if 'total_offsets_to_operating_expenditures' in totals and 'offsets_to_legal_accounting' in totals:
        totals['subtotal_offsets_to_operating_expenditures'] = totals['offsets_to_operating_expenditures']
        del totals['offsets_to_operating_expenditures']

    return financial_summary_processor(totals, constants.RAISING_FORMATTER)

def process_spending_data(totals):
    # Remove items from combined candidate disbursements for F3
    if 'fundraising_disbursements' in totals and 'loan_repayments' in totals:
        del totals['fundraising_disbursements']
        del totals['exempt_legal_accounting_disbursement']

    return financial_summary_processor(totals, constants.SPENDING_FORMATTER)

def process_cash_data(totals):
    return financial_summary_processor(totals, constants.CASH_FORMATTER)

def process_ie_data(totals):
    return financial_summary_processor(totals, constants.IE_FORMATTER)


def get_senate_cycles(senate_class):
    next_election = constants.NEXT_SENATE_ELECTIONS[str(senate_class)]
    return range(next_election, constants.START_YEAR, -6)

def get_state_senate_cycles(state):
    senate_cycles = []
    for senate_class in ['1', '2', '3', 'special']:
        if state.upper() in constants.SENATE_CLASSES[str(senate_class)]:
            senate_cycles += get_senate_cycles(senate_class)
    return senate_cycles

def two_days_ago():
    """Find the date two days ago"""
    two_days_ago = datetime.datetime.today() - datetime.timedelta(days=2)
    return two_days_ago.strftime('%m/%d/%y')
