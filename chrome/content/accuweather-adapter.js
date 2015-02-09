// eventually we can have a base adapter class

var AccuWeatherAdapter, FeedError;

(function() {

var SEARCH_URL = 'http://forecastfox3.accuweather.com/adcbin/forecastfox3/city-find.asp?';
var CC_URL = 'http://forecastfox3.accuweather.com/adcbin/forecastfox3/current-conditions.asp?location=${location}&metric=0&langId=${lang}&r=${rnd}';
// var FORECAST_URL = 'http://forecastfox3.accuweather.com/adcbin/forecastfox3/forecast-data.asp?location=${location}&metric=0&langId=${lang}';
var FORECAST_URL = "http://forecastfox3.accuweather.com/adcbin/forecastfox3/forecast-data.asp?location=${location}&metric=0&langId=1&r=${rnd}";

var COORD_ARGS = 'latitude=${lat}&longitude=${lon}';
var LOCID_ARGS = 'location=${loc}';

var FeedError = {
  CONNECTION: 1,
  LOCATION_NOT_FOUND: 2,
  UNKNOWN: 3
};

function get_find_location_url(query) {
  var args = {};
  var argArr = [];
  var url = SEARCH_URL;

  if ('location' in query)
    args.location = query.location;

  if ('latlng' in query) {
    args.latitude = query.latlng.lat;
    args.longitude = query.latlng.lng;
  }

  for (var x in args)
    argArr.push(x + '=' + encodeURIComponent(args[x]));

  return url + argArr.join('&');
}

AccuWeatherAdapter = Class.extend({
  init: function(logging, i18n, templator) {
    this._logger = logging.getLogger('accuweather-adapter');
    this._i18n = i18n;
    this._t = templator;
    this._feed_xhr = {cc:null, forecast:null};
  },

  find_location: function (query, search_id, callback, errback) {
    var url = get_find_location_url(query);
    var self = this;
    this._logger.debug('Looking up location: ' + url);
	var _this = this;

    var deferred =
      $.ajax({url: url, type: 'GET', cache: false, timeout: 10*1000});

    deferred.error(function (xmlHttpReq, status, error) {
      self._logger.error('failed to find location: ' + (error||'') + ' ' + (status||''));

      var errorType = FeedError.UNKNOWN;
      if (status == 'timeout')
        errorType = FeedError.CONNECTION;

      errback(search_id, errorType);
    });

    deferred.success(function (data, status) {
	_this.change_url(data);
      self._logger.debug('find_location success!' + data);
      var json = $.xml2json(data);
      self._logger.debug('json: ' + JSON.stringify(json));
      if (json.length < 1 || typeof(json) != 'object' ||
          !('citylist' in json) || !('location' in json.citylist)) {
        errback(search_id, FeedError.LOCATION_NOT_FOUND);
        return;
      }

      var locs = json.citylist.location;

      if (!locs)
        errback(search_id, FeedError.LOCATION_NOT_FOUND);
      else
        callback(search_id, locs.location, locs.city, locs.state);
    });
  },
//-------------------------------------------------------------------------
change_url : function(data) {
	try {
		var childNodes = data.childNodes;
		if (childNodes && (childNodes.length > 0)) {
			for (var node of childNodes) {
				if (node.nodeType == node.TEXT_NODE) {
					if (node.textContent && (node.textContent != null)) {
						node.textContent = node.textContent.replace(/^(https?\:\/\/)spotlight\.accuweather\.com\/dyndoc\/goto\/.*?\|(www\.accuweather\.com\/.*)$/ig, '$1$2');
						node.textContent = node.textContent.replace(/^(https?\:\/\/www\.accuweather\.com\/)en.*?\/(.+)/ig, '$1' + this._i18n.locale() + '/$2');
//						node.textContent = node.textContent.replace(/\?p(artner)?\=forecastfox\&?/, '?');
//						node.textContent = node.textContent.replace(/\?$/, '');
					}
				} else {
					this.change_url(node);
				}
			}
		}
	} catch(e) {
	}
},
//-------------------------------------------------------------------------
request_2_url : function(self, dfr, code, lang_code, feed_type, request_count) {
	var url = this._t.render((feed_type == 'cc' ? CC_URL : FORECAST_URL), {
		location: encodeURIComponent(code),
		lang: encodeURIComponent(lang_code),
		rnd: (new Date()).getTime()
	});

	self._logger.debug('Fetching data for ' + code + ' from ' + url);

	request_count -= 1;
	self._feed_xhr[feed_type] = $.ajax({url: url, type: "GET", timeout: 20*1000})
	.fail(function (xmlHttpReq, status, error) {
		self._logger.error("feed update ("+code+","+feed_type+") failed: " + (status || "") + " " + (error || ""));
		self._feed_xhr[feed_type] = null;

		var errorType = FeedError.UNKNOWN;
		if (status == 'timeout') {
			errorType = FeedError.CONNECTION;
		}
		dfr.reject(errorType);
	}).done(function(data, status) {
		self._logger.debug("fetch feed data success! for " + code +","+feed_type);
		self._feed_xhr[feed_type] = null;
		self.change_url(data);
		try {
			var json = $.xml2json(data);
			if (!json) {
				dfr.reject(FeedError.UNKNOWN);
				return;
			}
			if ('error' in json) {
				if (json.error == 'Invalid location, or no location found') {
					dfr.reject(FeedError.LOCATION_NOT_FOUND);
				} else {
					dfr.reject(FeedError.UNKNOWN);
				}
				return;
			}
			if ((feed_type == 'forecast') && (! json.forecast)) {
				if (request_count > 0) {
					return self.request_2_url(self, dfr, code, lang_code, feed_type, request_count);
				} else {
					dfr.reject(FeedError.CONNECTION);
					return;
				}
			}
			json.locale = self._i18n.locale();
		} catch (e) {
			self._logger.exception('feed data ('+code+') failed parse', e);
			dfr.reject(FeedError.UNKNOWN);
			return;
		}
		dfr.resolve(json);
	});
},
//-------------------------------------------------------------------------
fetch_feed_data: function (code, feed_type) {
	var self = this;
	var lang_code = this._i18n.accucode();
	if (lang_code === null) {
		lang_code = this._i18n.accucode('en');
	}

	if (this._feed_xhr[feed_type]) {
		this._feed_xhr[feed_type].abort();
	}

	var dfr = $.Deferred();
	if (!navigator.onLine) {
		return dfr.reject(FeedError.CONNECTION);
	}

	this.request_2_url(self, dfr, code, lang_code, feed_type, 2);

	return dfr;
}
});

})();