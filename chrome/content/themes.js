var Themes;
(function() {

var themes_key_prefix = 'themes.';
var logger;

var DEFAULT_PACK_ID = 1;
var PACK_REFRESH_RATE = 2 * 60 * 60 * 1000;
var PACK_START_TIME = 5 * 60 * 1000;
var data_prefix = 'data:image/png;base64,';
var top_level = ['id', 'name', 'small', 'large'];
var excluded_icons = [9,10,27,28];
var icon_max = 44;
var additional = ['5day', 'globe', 'hourly', 'radar', 'swa'];

function isValidPack() {
     return true;
}

function getPackUrl(packId) {
  return 'http://icons.getforecastfox.com/unpacked/pack-' + packId + '.json';
}

Themes = Class.extend({
  _logger: null,
  _datastore: null,

  init: function Locations_init(logging, preferences, datastore) {
    var self = this;
    logger = this._logger = logging.getLogger("themes");
    this._preferences = preferences;
    this._datastore = datastore;

    // check for icon pack in 5 minutes, then in every 2 hours.
    window.setTimeout(function() {self.install_current_pack();}, PACK_START_TIME);
    window.setInterval(function() {self.install_current_pack();}, PACK_REFRESH_RATE);

    this._logger.debug("initialized");
  },

  selected: function (/*OPTIONAL*/ iconPackId) {
    var theme = this._preferences.preference('theme');
    if (iconPackId !== undefined) {
      theme.icon_pack = iconPackId;
      this._preferences.preference('theme', theme);
    }
    return theme.icon_pack;
  },

  smallImage: function Themes_smallImage(index, use_default) {
    this._logger.debug("getting small image for " + index );
    var selected = this.selected();
    if (use_default || selected == DEFAULT_PACK_ID)
      return Forecastfox.url("skin/default/small/" + index + ".png");

    var url = this._get([selected, 'small', index]);
    if (url) {
      this._logger.debug(url.substring(0,40));
      return url;
    }
    url = 'http://icons.getforecastfox.com/unpacked/' + selected + '/small/' + index + '.png';
    this._logger.debug(this._logger.debug(url));
    return url;
  },

  largeImage: function Themes_largeImage(index, use_default) {
    var selected = this.selected();
    if (use_default || selected == DEFAULT_PACK_ID)
      return Forecastfox.url("skin/default/large/" + index + ".png");

    var url = this._get([selected, 'large', index]);
    if (url) {
      this._logger.debug(url.substring(0,40));
      return url;
    }
    url = 'http://icons.getforecastfox.com/unpacked/' + selected + '/large/' + index + '.png';
    this._logger.debug(this._logger.debug(url));
    return url;
  },

  logo: function Themes_logo(size) {
    this._logger.debug("getting logo for " + size );
    return Forecastfox.url("skin/images/logo" + size + ".png");
  },

  install_current_pack: function() {
    var id = this.selected();
    if (this._get([id, 'name']) || id == DEFAULT_PACK_ID) {
      logger.debug('pack ' + id + ' already installed');
      return;
    }

    logger.debug('installing pack ' + id);
    this._fetch_pack(id);
  },

  _fetch_pack: function Themes__fetch_pack(packId) {
    if (packId == DEFAULT_PACK_ID) {
      logger.warn('tried to install the default icon pack');
      return;
    }

    logger.debug('fetching pack ' + packId);
    var self = this;
    var deferred = $.ajax({
      url: getPackUrl(packId),
      type: 'GET',
      cache: false,
      dataType: 'json',
      timeout: 60*1000
    });

    deferred.success(function (data, status) {
      if (!isValidPack(data)) {
        logger.error('invalid pack');
        return;
      }

      self._storePack(data);
    });

    deferred.fail(function(xhr, status, error) {
      logger.error('could not fetch icon pack ' + packId);
      logger.error(status);
      logger.error(error);
    });
  },

  _storePack: function (data) {
    var id = data.id;

    this._store([id, 'name'], data.name);
    this._store([id, 'version'], data.version);
    this._store([id, 'preview'], data.preview);

    for (var x = 1; x <= icon_max; x++)
      this._storeIcon(id, x, data);

    for (x = 0; x < additional.length; x++)
      this._storeIcon(id, additional[x], data);

    logger.debug('stored pack ' + id);
  },

  _storeIcon: function(id, icon, data) {
    if (excluded_icons.some(function(a){ return icon == a; }))
      return;

    if ('small' in data && icon in data.small)
      this._store([id, 'small', icon], data_prefix + data.small[icon]);
    else
      logger.warn('small icon ' + icon + ' not found');

    if ('large' in data && icon in data.large)
      this._store([id, 'large', icon], data_prefix + data.large[icon]);
    else
      logger.warn('large icon ' + icon + ' not found');
  },

  _store: function(key, data) {
    this._datastore.set([themes_key_prefix]
                        .concat(key).join('.'), data, true);
  },

  _get: function(key) {
    return this._datastore.get([themes_key_prefix]
                               .concat(key).join('.'), true);
  }
});
})();
