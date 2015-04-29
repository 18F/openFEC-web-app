import os.path
import requests
from urllib.parse import urlencode

from openfecwebapp.config import api_location, api_key


def _call_api(path, filters):
    if api_key:
        filters['api_key'] = api_key
    print("api_location: {} + path: {}".format(api_location, path))
    url = os.path.join(api_location, path)
    print(url)
    results = requests.get(url, params=filters)

    if results.status_code == requests.codes.ok:
        return results.json()
    else:
        return {}

def load_search_results(query):
    filters = {'per_page': '5'}

    if query:
        filters['q'] = query

    return {
        'candidates': load_single_type_summary('candidates', filters),
        'committees': load_single_type_summary('committees', filters)
    }

def load_single_type_summary(data_type, filters):
    return _call_api(data_type, filters)

def load_single_type(data_type, c_id, filters):
    return _call_api(os.path.join(data_type, c_id), filters)

def load_nested_type(parent_type, c_id, nested_type):
    url = os.path.join(parent_type, c_id, nested_type)
    filters = {'year': '*'}

    return _call_api(url, filters)

def load_cmte_financials(committee_id):
    r_url = '/committee/' + committee_id + '/reports'
    limited_r_url = limit_by_amount(r_url, 4)
    t_url = '/committee/' + committee_id + '/totals'
    reports = _call_api(limited_r_url, {})
    totals = _call_api(t_url, {})
    cmte_financials = {}
    cmte_financials['reports'] = reports['results']
    cmte_financials['totals'] = totals['results']
    return cmte_financials

def install_cache():
    import requests_cache
    requests_cache.install_cache()

def limit_by_amount(curr_url, amount):
    query = urlencode({'page': 1, 'per_page': amount})
    return '{0}?{1}'.format(curr_url, query)
