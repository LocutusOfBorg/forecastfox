/*******************************************************************************
 * The preference object manages Forecastfox user preferences. Preferences are
 * defined Firefox style, as key-value pairs where the key is a "." delimited
 * heirarchy of names.
 *
 * Clients may listen for updated preferences on the "preference-update" topic
 * via the observer service (PREFERENCES_UPDATE_TOPIC event). For this event,
 * the data is a map of key-value pairs for all the changed preferences.
 *
 * @see /content/logging.js
 * @see /content/observers.js
 * @see /content/datastore.js
 * @see /content/external/jquery-1.3.2.js
 * @see /content/external/class.js
 * @version 1.0
 ******************************************************************************/
const PREFERENCES_UPDATE_TOPIC = "preference-update";
var RADAR_EXAMPLE_URL =
  "http://sirocco.accuweather.com/nx_mosaic_400x300_public/sir/inmasirCT_.gif";
const PREFERENCES_DEFAULTS = {
  "version": "17",
  "defaults": true,
  "showoptions": true,
  "firefoxmigration": false,    // displays welcome message in customization
  "locationmigration": false,   // TODO combine these after we can do . notation
  "show_english_locations": false,
  "unitsystem": "american",
  "spring_inserted": false,       // on Firefox, we insert flexible space 1 time to the top right.
  "rotate": {
    "enabled": false,
    "interval": 1
  },
  "theme": {
    "icon_pack": 1,
    "separators": ($.client.os != 'Mac')
   },
  "units": {
    "temperature": ["f"],
    "speed": ["mph"],
    "time": ["h12"],
    "pressure": ["inhg"],
    "distance": { "shrt": ["inches"], "lng": ["mi"] }
  },
  "display": {
    "humidity": true,

    "precipitation": false,


    "pressure": true,
    "uv": false,
    "visibility": false,
    "wind": true,
    "quality": false,
    "moon": false
  },
  "toolbar": {
    "days": 2,
    "location_name": false,
    "days_or_nights": "days",
    "cc": true,


    "radar": "medium",

    "radar_custom": {
      "url": RADAR_EXAMPLE_URL,
      "width": null,
      "height": null
    },
    "day5": true,
    "hourly": true,
    "swa": true,
    "parent": 'DEFAULT',
    "position": "last",
    "display": 9,  // "text-image" or "image"

    "force_addonbar_visible": 0,

  }
};

const PREFERENCES_UPGRADE = {
  _count: 20,

  "1.5.0": function(service) {
    return "1.5.1";
  },

  "1.5.2": function(service) {
    return this["1.5.1"](service);
  },

  "1.5.1": function(service) {
    var selected = service.preference("location");
    var saved = service._datastore.get("locations.saved", true);
    var defaults = PREFERENCES_DEFAULTS["locations"];
    var locations = service.preference("locations");

    if (!locations || !("selected" in locations) || !("saved" in locations)) {
      // migrate locations
      var obj = {};
      if (selected) {
        obj["selected"] = selected;
      } else if ("selected" in locations) {
        obj["selected"] = locations.selected;
      } else
        obj["selected"] = defaults.selected;

      if (saved && $.isArray(saved)) {
        obj["saved"] = saved;
      } else if (("saved" in locations) && ($.isArray(locations.saved))) {
        obj["saved"] = locations.saved;
      } else
        obj["saved"] = defaults.saved;

      service.preference("locations", obj);
    }

    service.remove("location");
    service._datastore.remove("locations.saved");

    // migrate units
    var units = service.preference("units");
    if ("long" in units.distance) {
      units.distance.lng = units.distance["long"];
      delete units.distance["long"];
    }
    if ("short" in units.distance) {
      units.distance.shrt = units.distance["short"];
      delete units.distance["short"];
    }
    service.preference("units", units);

    // don't show the options for this migration
    service.preference("showoptions", false);
    return "2";
  },


  // for our test version
  "2.0": function(service) {
    return this["1.5.1"](service);
  },

  "2": function(service) {
    var defaults = PREFERENCES_DEFAULTS;
    service.preference('show_english_locations', defaults.show_english_locations);
    service.preference('showoptions', true);
    service.preference('toolbar', defaults.toolbar);
    service.preference('theme', defaults.theme);

    if (service.preference('days'))
      service.remove('days');

    
    var locations = service.preference('locations');
    if (locations && 'selected' in locations) {
      service._datastore.set('locations.selected', locations.selected, true);
    }
    if (locations && 'saved' in locations) {
      service._datastore.set('locations.saved', locations.saved, true);
    }

    service.remove('locations');
    
    return "3";
  },

  "3": function(service) {
    
    var ds = service._datastore;
    var saved = ds.get('locations.saved', true);
    for (var x = 0; x < saved.length; x++) {
      var prefix = 'locations.' + saved[x].code;
      ds.remove(prefix + '.original');
      ds.remove(prefix + '.processed');
      ds.remove(prefix + '.cc.time');
      ds.remove(prefix + '.forecast.time');
      ds.remove(prefix + '.time');
    }

    ds.remove('locations.saved');
    ds.remove('locations.selected');
    

    var toolbar = service.preference('toolbar');
    toolbar.radar = true;
    service.preference('toolbar', toolbar);
    service.preference('showoptions', true);
    return "4";
  },

  "4": function(service) {
    var toolbar = service.preference('toolbar');
    toolbar.display = (toolbar.display == 'text-image') ? 5 : 0;
    toolbar.separators = true;
    service.preference('toolbar', toolbar);
    return "5";
  },

  "5": function(service) {
    var toolbar = service.preference('toolbar');
    toolbar.parent = toolbar.position;
    toolbar.position = 'last';
    service.preference('toolbar', toolbar);
    service.preference('locationmigration', false);
    return "6";
  },
  "6": function(service) {
    service.preference('installed', (new Date()).valueOf());
    return "7";
  },
  "7": function(service) {
    var toolbar = service.preference('toolbar');
    
    toolbar.radar = (toolbar.radar ? 'large' : 'none');
    
    
    service.preference('toolbar', toolbar);
    return "8";
  },
  "8": function(service) {
    var theme = service.preference('theme');
    var toolbar = service.preference('toolbar');

    theme.icon_pack = 1;
    theme.separators = toolbar.separators;

    delete theme.icon_pack_id;
    delete toolbar.separators;

    service.preference('theme', theme);
    service.preference('toolbar', toolbar);
    return "9";
  },
  "9": function(service) { return "10"; },
  "10": function(service) {
    var installed = service.preference('installed');
    service._datastore.set('analytics-installed', installed+'');
    service.remove('installed');
    return "11";
  },
  "11": function(service) {
    var rotate = PREFERENCES_DEFAULTS['rotate'], v,
       toolbar = service.preference('toolbar');
    
    if ((v = firefox_migrator.get_old_pref('profile.switch.enabled', 'Bool')) !== null)
      rotate.enabled = v;

    if ((v = firefox_migrator.get_old_pref('profile.switch.delay', 'Int')) !== null)
      rotate.interval = v;
    

    if (rotate.enabled)
      toolbar.location_name = true;
    else
      toolbar.location_name = false;

    toolbar.days_or_nights = 'days';
    
    var mode = [ 'days', 'nights', 'days-nights' ];
    if ((v = firefox_migrator.get_old_pref('dayf.panel.mode', 'Int')) !== null) {
      if (v >= 0 && v <= 2)
        toolbar.days_or_nights = mode[v];
    }
    

    if (toolbar.display == 5) toolbar.display = 9;

    service.preference('rotate', rotate);
    service.preference('toolbar', toolbar);

    return "12";
  },

  "12": function(service) {

    // we need to remove all the processed data, since some formats changed
    
    var  ds = service._datastore,
      saved = ds.get('locations.saved', true);

    for (var x = 0, len = saved.length; x < len; x++) {
      var prefix = 'locations.' + saved[x].code;
      ds.remove(prefix + '.original');
      ds.remove(prefix + '.processed');
      ds.remove(prefix + '.cc.time');
      ds.remove(prefix + '.forecast.time');
    };

    saved.sort(function(a,b) { return a.name > b.name; });
    ds.set('locations.saved', saved, true);
    
    service.preference('spring_inserted', false);
    return "13";
  },

  "13": function(service) {
    var toolbar = service.preference('toolbar');
    if (toolbar.radar == 'small')
      toolbar.radar = 'medium';
    service.preference('toolbar', toolbar);
    return "14";
  },
  "14": function(service) {
    
    return "15";
  },
  "15": function(service) {
    var toolbar = service.preference('toolbar');
    
    if (toolbar.radar == "small")
      toolbar.radar = "medium";
    
    toolbar.radar_custom = PREFERENCES_DEFAULTS['toolbar'].radar_custom;
    service.preference('toolbar', toolbar);
    return "16";
  },
  "16": function(service) {
    service.preference('force_addonbar_visible', 0);
    return "17";
  }
};

var Preferences = Class.extend({
  _key: "preferences",
  _logger: null,
  _observers: null,
  _datastore: null,
  _cache: null,

  /**
   * Initialize the preferences service.
   *
   * @param   datastore      The datastore service
   * @param   logging        The logging service
   * @param   observers      The observer service
   * @param   preferences    [OPTIONAL] Preferences to use
   */
  init: function Preferences_init(logging, observers, datastore, /*OPTIONAL*/ preferences) {
    this._logger = logging.getLogger("preferences");
    this._observers = observers;
    this._datastore = datastore;
    this._migrating = false;
    if (preferences)
      this.preferences(preferences);

    this.migrate();
    this._cache = this._datastore.get(this._key, true);
    this._logger.debug("initialized");
  },

  migrate: function Preferences_migrate() {
    this._logger.debug("migrating preferences");

    // set the migrating flag so we don't sende out notifications
    this._migrating = true;
    var should_notify = false;

    try {
      var data = this._getAll();

      /**
       *  If there's no data, or its corrupted, revert to the defaults. The
       *  default preferences now contains the preference version in it, so
       *  we can return from here and no more migration is needed.
       */
      if (!this._validate(data)) {
        should_notify = true;
        this._logger.debug("setting the default preferences");
        this.preferences(PREFERENCES_DEFAULTS);

        // when there's no data present, see if we can get any data from FF 0.7
        if ('firefox_migrator' in window)
          firefox_migrator.migrate_old_preferences(this);
      }

      // upgrade versions
      var version = this.preference("version");

      /**
       * loop while version is not equal to the current version
       * set a counter so that we do not loop infinitely
       * if an upgrade function exists call it otherwise just set to current
       * set the version preference
       */
      var count = 0;
      while (version != PREFERENCES_DEFAULTS['version']) {
        should_notify = true;
        count++;
        this._logger.debug("upgrading preferences from version " + version +" ...");

        // if we've looped too far for some reason... abort...
        // TODO should we just reset to the defaults then?
        if (count > PREFERENCES_UPGRADE._count) {
          this._logger.error("unexpected result during migration. reverting to defaults");
          this.preferences(PREFERENCES_DEFAULTS);
          break;
        }

        // if there is a migration method for the next version number, run it
        if (version in PREFERENCES_UPGRADE)
          version = PREFERENCES_UPGRADE[version](this);

        // if not assume we are at the newest version.
        else
          version = PREFERENCES_DEFAULTS['version'];

        this._logger.debug("upgrade to version " + version + " complete");
        this.preference("version", version);
      }

      // Open the Customization page if the 'showoptions' flag is set.
      if (this.preference('showoptions')) Forecastfox.customize();
    } catch (e) {
      this._logger.exception("Migration error", e);
      this.preferences(PREFERENCES_DEFAULTS);
    } finally {

      // After migrating, clear the flag and issue an update notification.
      this._migrating = false;
      if (should_notify)
        this._observers.notify(PREFERENCES_UPDATE_TOPIC, this.preferences());
    }
  },

  /**
   * Sets or gets a particular preference.
   *
   * @param   key            The preference key to get/set
   * @param   value          [OPTIONAL] sets the given preference to the value supplied
   * @return                 the value or null if the preference does not exist
   */
  preference: function Preferences_preference(key, /*OPTIONAL*/ value) {
    var data = {};

    // value was passed in so set it
    if (value !== undefined) {
      data[key] = value;
      this._setAll(data);
    }

    // get the data in the store
    data = this._getAll();

    // return the preference or null if not set
    return (!(key in data)) ? null : data[key];
  },

  /**
   * Gets all preferences and optional sets the specified preferences.
   *
   * @param   preferences    [OPTIONAL] a key-value map of preferences
   * @return                 all the preferences as a key-value map
   */
  preferences: function Preferences_preferences(preferences) {

    // preferences passed in so set them
    if (preferences)
      this._setAll(preferences);

    // return the preferences
    return this._getAll();
  },

  /**
   * Removes the specified preference.
   *
   * @param   key            the name of the preference to remove.
   * @return                 the value of the preference, null if the preference
   *                         did not exist
   */
  remove: function Preferences_remove(key) {

    // make sure a string was passed in
    if (typeof(key) != "string")
      return null;

    // get the data
    var data = this._getAll();

    // check if the key is in the data
    if (!(key in data)) {
      this._logger.debug("removing preference that doesn't exist: " + key);
      return null;
    }

    // get the value for the key
    var value = data[key];

    // remove the value for the key
    delete data[key];

    // set the datastore and notify observers
    this._cache = data;
    this._datastore.set(this._key, data, true);

    if (!this._migrating) {
      this._observers.notify(PREFERENCES_UPDATE_TOPIC, { key: value });
      this._logger.debug("removed preference, notifying observers: " + key);
    }

    // return the value
    return value;
  },

  /**
   * Get all the key/value pairs in the store.
   *
   * @return                 The data or an empty hash
   */
  _getAll: function Preferences__getAll() {
    var data = this._datastore.get(this._key, true);
    if (!this._validate(data) && this._validate(this._cache)) {
      data = this._cache;
      this._datastore.set(this._key, data, true);
    }

    return data ? data : {};
  },

  /**
   * Set all the key/value pairs in the store.
   *
   * @param   preferences    A hash of key/value pairs to set.
   * @return                 True if set otherwise, false.
   */
  _setAll: function Preferences__setAll(preferences) {

    // a hash was not passed in
    if (!this._validate(preferences))
      return false;

    // get the current data
    var data = this._getAll();

    // loop through the keys in the hash and update data
    for (var key in preferences)
      data[key] = preferences[key];

    // set the data in the store
    this._cache = data;
    this._datastore.set(this._key, data, true);

    // notify observers ... if we're not migrating!
    if (!this._migrating) {
      this._logger.debug("preferences updated, notifying observers: " + JSON.stringify(preferences));
      this._observers.notify(PREFERENCES_UPDATE_TOPIC, preferences);
    }

    return true;
  },

  _validate: function Preferences_validate(data) {

    // a hash was not passed in
    if (typeof(data) != "object") {
      this._logger.warn("data not an object");
      return false;
    }

    var count = 0;
    for (var key in data) {
      count++;
      break;
    }

    if (count === 0) {
      this._logger.warn("no keys set in data");
      return false;
    }

    return true;
  }
});