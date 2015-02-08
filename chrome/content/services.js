var initialized = false;

//setup the core backend services
var logging = new Logging(LoggingLevels.NOTSET, undefined);
var logger = logging.getLogger("background-page");

try {

var observers = new Observers(logging, OBSERVERS_CHANNEL, true);
var datastore = new DataStore(logging);


var firefox_migrator = init_firefox_migrator();
var MAX_FORECASTED_DAYS = 6;



var templator = new Templator(logging, document);
var i18n = new I18n(logging, observers, datastore);

// setup the services that depend on the core services
var adapter = new AccuWeatherAdapter(logging, i18n, templator);
var preferences = new Preferences(logging, observers, datastore);
var converter = new Converter(logging, preferences, i18n, templator);
var processor = new AccuWeatherProcessor(logging, i18n, templator, converter);
var locations = new Locations(observers, preferences, adapter, processor, datastore);

var positioner = new Positioner(logging, preferences);

var ui_dispatcher = new UIDispatcher();

i18n.localize(templator);

// setup the front-end services
var themes = new Themes(logging, preferences, datastore);

var features = {};
features['drag-target'] = new DragTarget(logging, preferences, i18n, themes);
features['error'] = new ErrorReporter(logging, preferences, i18n, themes);
features['progress'] = new ProgressIndicator(logging, preferences, i18n, themes);
features['swa'] = new SWA(logging, preferences, i18n, themes);
features['radar'] = new Radar(logging, preferences, i18n, themes);
features['hourly'] = new HourlyLink(logging, preferences, i18n, themes);
features['day5'] = new Day5Link(logging, preferences, i18n, themes);
features['cc'] = new CurrentConditions(logging, preferences, i18n, themes);
for (var x=0; x<=MAX_FORECASTED_DAYS; x++) {
  features["forecast-" + x + "-day"] = new Forecast(x, "day", logging, preferences, i18n, themes);
  features["forecast-" + x + "-night"] = new Forecast(x, "night", logging, preferences, i18n, themes);
}

//listen for locale ready
observers.add("locale-ready", function() { i18n.localize(templator); });
observers.add("feed-ready", function() { update_feature_data(); });
observers.add("preference-update", function() { update_feature_data(); });
observers.add("locale-ready", function() { update_feature_data(); });

function update_feature_data() {
  var data = locations.processed_data();
  if (!data) return;
  for (var key in features) features[key].data(data);
}

function restore_all_defaults(are_you_sure) {
  if (are_you_sure) {
    datastore.clear();
    locations.setup_default_locations();
    preferences.preferences(PREFERENCES_DEFAULTS);
    locations.update_feed(locations.selected());
    i18n.locale(DEFAULT_LOCALE);
  }
}

//update_feature_data()
// notify that initialization is complete
initialized = true;
logger.debug("initialized");
observers.notify("background-page-ready", {});

// hookup an unload listener
window.addEventListener('unload', function() {
  logger.debug('window closed. cleaning up service script.');
  observers.shutdown();
  logging.shutdown();

  features = null;
  action = null;
  themes = null;
  ui_dispatcher = null;
  positioner = null;
  locations = null;
  processor = null;
  converter = null;
  adapter = null;
  templator = null;
  i18n = null;
  preferences = null;

  initialized = false;
}, false);

} catch (e) {
  logger.exception('exception starting services', e);
}