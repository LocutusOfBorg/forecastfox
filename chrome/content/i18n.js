var I18n, DEFAULT_LOCALE;

(function(){

var logger;
DEFAULT_LOCALE = 'en';

I18n = Class.extend({
  _key: 'locale',
  _supported: null,
  _cache: null,
  _datastore: null,

  init: function I18n_init(logging, observers, datastore) {
    logger = logging.getLogger('i18n');
    this._observers = observers;
    this._datastore = datastore;

    this._supported = this._filter(I18N_SUPPORTED);
    this._ensure_locale_exists();

    this._load(DEFAULT_LOCALE, true);
    this._load(this.locale());
    logger.debug('initialized');
  },

  /**
   * gets / sets the locale
   * @return Forecastfox's current locale
   */
  locale: function I18n_locale(code) {
    var supported = this.supported();
    if (code) {
      code = $.localize.normalize(code);
      if ((code in supported) && supported[code].active) {
        logger.info('changing locale to: ' + code);
        this._datastore.set(this._key, code);
        this._cache = code;
        this._load(code);
      }
    }
    return this._cache;
  },

  /**
   * @return array<Locale> supported by Forecastfox
   */
  supported: function I18n_supported() {
    return this._supported;
  },

  accucode: function I18n_accucode(/*optional*/locale) {
    if (!locale)
      locale = this.locale();

    var supported = this.supported();

    if (!(locale in supported))
      return null;
    if (!('accucode' in supported[locale]))
      return null;

    return supported[locale].accucode;
  },

  rtl: function I18n_rtl(/*optional*/locale) {
    if (!locale)
      locale = this.locale();

    var supported = this.supported();

    if (!(locale in supported))
      return false;
    if (!('dir' in supported[locale]))
      return false;

    return supported[locale]['dir'] == 'rtl';
  },

  localize: function I18n_localize(templator) {
    var locale = this.locale();
    logger.debug('localizing a page with ' + locale);
    templator.node('[rel*=localize]').localize('forecastfox', locale);
  },

  data: function Il8n_data(key, /*OPTIONAL*/ try_default_locale) {
    var locale = (try_default_locale ? DEFAULT_LOCALE : this.locale());

    if (!$.localize.data || !(locale in $.localize.data))
      return "";

    var value = $.localize.data[locale]['forecastfox'];
    if (key in value && value[key] && value[key] != "")
      return value[key];

    if (try_default_locale) {
      logger.error('missing i18n key: ' + key);
      return "";
    } else {
      logger.warn('i18n key missing from current locale. trying default. key: ' + key);
      return this.data(key, true);
    }
  },

  has_data: function(key) {
    // TODO copied from above.... refractor
    var keys  = key.split(/\./);
    var locale = this.locale();

    if (!$.localize.data || !(locale in $.localize.data))
      return null;

    var value = $.localize.data[locale]['forecastfox'];
    while (keys.length > 0 && value)
      value = value[keys.shift()];

    return (value && value != "");
  },

  all_data: function I18n_all_data() {
    return $.localize.data;
  },

  _load: function I18n_load(code, suppress_notification) {
    if (code in $.localize.data) {
      this._observers.notify('locale-ready', {locale: code});
      return;
    }

    logger.debug('loading locale ' + code);
    var self = this;
    var options = {
      pathPrefix: ['content', 'locale'].join('/'),
      language: code,
      callback: function (pkg, lang, data) {
        logger.debug('locale ' + code + ' was loaded');
        if (!suppress_notification)
          self._observers.notify('locale-ready', {locale: code});
      }
    };

    $.localize.load('forecastfox', options);
  },

  _filter: function I18n__filter(d) {
    var filtered = {};
    $.each(d, function (key, val) {
      if (val.active) filtered[key] = val;
    });
    return filtered;
  },

  _ensure_locale_exists: function I18n__ensure() {
    var code = this._datastore.get(this._key);
    var supported = this.supported();

    if (!code)
      code = $.localize.browser;
    if (!(code in supported) || !supported[code].active)
      code = code.split('-')[0];
    if (!(code in supported) || !supported[code].active)
      code = DEFAULT_LOCALE;

    this._datastore.set(this._key, code);
    this._cache = code;
  }
});

})();
