var Locations;

(function () {

var UPDATE_DURATION = {
  forecast: 15 * 60 * 1000,
  cc: 15 * 60 * 1000
};
var KEY = 'locations.';
var logger;

var imageTools = Components.classes["@mozilla.org/image/tools;1"].
                   getService(Components.interfaces.imgITools);
var cacheSvc = imageTools.getImgCacheForDocument(document);
var ioSvc = Components.classes['@mozilla.org/network/io-service;1'].
                 createInstance(Components.interfaces.nsIIOService);

function expire_cache(url) {
  var uri = ioSvc.newURI(url, null, null);
  try {
    cacheSvc.removeEntry(uri);
  } catch (e) {}
}


Locations = Class.extend({
  // TODO(jstritar): use require?
  // Use require?
  init: function Locations_init(observers, preferences, adapter, processor, datastore) {
    // TODO move this out once logs are refractored
    logger = logging.getLogger('locations');
    this._preferences = preferences;
    this._observers = observers;
    this._adapter = adapter;
    this._processor = processor;
    this._datastore = datastore;
    this._error_count = 1;
    this._rotation_timer = -1;
    this._rotation_interval = -1;
    this._rotation_enabled = -1;
    this._rotation_paused = false;

    this.setup_default_locations();

    var location = this.selected();
    if (validate(location)) this.update_feed(location);

    var self = this;
    this._observers.add('locale-ready', function() {
      logger.info('Locale has changed.... update feed!');
      self.update_feed(self.selected(), true);
    });

    this._observers.add('preference-update', function() {
      var location = self.selected();
      self.update_feed(location);

      var rotate = self._preferences.preference('rotate');
      if ((rotate.enabled != self._rotation_enabled) ||
          (rotate.interval != self._rotation_interval))
        self.start_rotating();
    });

    self.start_rotating();

    logger.debug('initialized');

    $(function() {
      document.body.addEventListener('online', function() {
        self.update_feed(self.selected());
      }, false);
    });
  },

  next: function() {
    var selected = this.selected();
    var saved = this.saved();

    for (var x = 0; x < saved.length; x++) {
      if (selected.code == saved[x].code) {
        return (x == saved.length-1) ? saved[0] : saved[x+1];
      }
    }
    logger.error('locations.next() did not find the next location');
    return null;
  },

  setup_default_locations: function() {
    if (!this.selected() && (this.saved().length == 0)) {
      logger.debug('setting the default location to NYC');
      var nyc = {"name": "New York, NY", "code": "cityId:349727"};
      this._storage('saved', [nyc]);
      this._storage('selected', nyc);
    }

    if (!this._preferences.preference('locationmigration')) {
      var self = this;
      var upgrade_closure = function() {
        if (self._has_migrate_listener) {
          document.body.removeEventListener('online', upgrade_closure, false);
          self._has_migrate_listener = false;
        }

        firefox_migrator.migrate_old_locations();
        self._preferences.preference('locationmigration', true);

      };

      if (navigator.onLine) {
        upgrade_closure();
      } else {
        this._has_migrate_listener = true;
        document.body.addEventListener('online', upgrade_closure, false);
      }
    }
  },

  /*
   * gets and sets the currently selected location.
   * triggers a feed update if changing locations
   */
  selected: function Locations_selected(/*OPTIONAL*/ location) {
    var current = this._storage('selected');

    if (location) {
      if (!validate(location) || are_completely_equal(location, current))
        return current;

      logger.debug('setting selected location to: ' + JSON.stringify('location'));

      this._storage('selected', location);

      // make sure the selected location is now on the front of the saved list
      var saved = this.saved(move_to_front(this.saved(), location));

      this.update_feed(location);

      this._observers.notify('location-changed', {
        selected: location,
        saved: saved
      });

      this.start_rotating();
    } else {
      location = current;
    }

    // return the location
    return location;
  },

  /*
   * gets and sets the list of saved locations
   * if setting a list that does NOT contain the selected location, this
   * will select a new location and trigger a feed update if necessary
   */
  saved: function Locations_saved(locations) {
    // TODO clean up old data entries
    if (locations && $.isArray(locations)) {
      locations = validate_all(locations);
      locations.sort(function(a,b) { return a.name > b.name; });

      // add the selected location back if it doesn't exist
      if (locations.length == 0) locations = [this.selected()];

      logger.debug('storing saved locations: ' + JSON.stringify(locations));
      var old_saved = this._storage('saved');
      this._storage('saved', locations);

      if (!contains(locations, this.selected()) && locations.length > 0)
        this.selected(locations[0]);

      // remove data for the locations that were removed
      for (var x = 0, len = old_saved.length; x < len; x++) {
        if (!contains(locations, old_saved[x]))
          this._remove_data(old_saved[x].code);
      }

      this._observers.notify('location-changed', {
        selected: this.selected(),
        saved: locations
      });
    } else {
      locations = this._storage('saved');
    }

    return (locations ? locations : []);
  },

  /* gets the time, in milliseconds, until the location's data expires  */
  time_to_expire: function (location, part /* 'cc' or 'forecast' */) {
    var code = location.code;
    var lastUpdate = this.last_update_time(location, part);
    var data = this.original_data(part, location);
    if (!lastUpdate || !data ||
        !('locale' in data) || data.locale != i18n.locale())
      lastUpdate = 0;

    // the time in milliseconds since the last update
    var duration = Date.now() - lastUpdate;

    logger.debug('DURATION: ' + duration);
    // if the feed is older than UPDATE_DURATION - 1 minute, perform update
    if (duration >= (UPDATE_DURATION[part] - 60*1000)) {
      logger.debug('location ' + code + ' ' + part + ' is expired, duration = 0');
      return 0;
    }

    // if the feed's time is in the future, perform update
    if (duration + 60*1000 < 0) {
      logger.debug('location ' + code + ' ' + part + ' updated in future, duration = 0');
      return 0;
    }

    // return the actual duration
    var nextTime = UPDATE_DURATION[part] - duration;
    logger.debug('feed '+code+' '+part+' duration is '+(nextTime/1000/60)+' min');
    return nextTime;
  },

  is_error: function() {
    // _error_count is at 1 is there are no errors... yes a little odd
    return (this._error_count > 1);
  },

  /*
   * schedules a feed update for the specified location. set isError to true
   * if we are scheduling an update due to previous error condition
   */
  schedule_update: function Locations_schedule_update(location, isError) {
    var self = this;

    // update error count
    var timeToUpdate = Math.min(this.time_to_expire(location, 'cc'),
                                this.time_to_expire(location, 'forecast'));

    if (isError) {
      timeToUpdate = Math.min(self._error_count, 8) * 60 * 1000;
      this._error_count *= 2;
    } else {
      this._error_count = 1;
    }

    logger.debug(
      'update ('+location.code+') scheduled for '+timeToUpdate/(60*1000)+' min'
    );

    clearTimeout(this._timer);

    this._timer = setTimeout(
      function() { self.update_feed(location);},
      timeToUpdate + 1000    // add 1 sec to be safe
    );
  },

  /* gets and sets the original data retrieve by the feed */
  original_data: function (part, /* optional */ location, /* optional */ data) {
    if (!location) location = this.selected();
    return this._storage(location.code + '.original.' + part, data);
  },

  /* gets and sets the processed (based on user settings) data from feed */
  processed_data: function (/*optional*/ location, /* optional */ data) {
    if (!location) location = this.selected();
    if (data) {
      // doing this will let us display the UTF-8 characters in the status bar
      // TODO why does this work in the "processed data" section, but not in
      //      the original data section?
      var scratch = $('#scratch_space');
      if (scratch.length > 0) {
        scratch.html(JSON.stringify(data));
        data = JSON.parse(scratch.html());
        scratch.empty();
      }
    }
    return this._storage(location.code + '.processed', data);
  },

  /* gets and sets the time at which the data for location was retrieved */
  last_update_time: function (location, part, /* optional */ time) {
    return this._storage([location.code, part, 'time'].join('.'), time);
  },

  _remove_all_data: function Locations_remove_all_data() {
    logger.debug('removing all location data');
    var recent = this.saved();
    for (var x = 0, len = recent.length; x < len; x++) {
      this._remove_data(recent[x].code);
    };
  },

  /* removes all the feed data for the specified code */
  _remove_data: function Locations_remove_data(code) {
    logger.debug('removing feed data for ' + code);
    this._remove(code + '.original');
    this._remove(code + '.processed');
    this._remove(code + '.cc.time');
    this._remove(code + '.forecast.time');
    this._remove(code + '.time');
  },

  start_rotating: function() {
    logger.debug("Starting to rotate profiles");
    var rotate = this._preferences.preference('rotate'),
      interval = Math.max(0.25, rotate.interval),
          self = this;

    this._rotation_interval = rotate.interval;
    this._rotation_enabled = rotate.enabled;

    // don't rotate if it hasn't changed or if its invalid
    if (!rotate.enabled || isNaN(interval) || interval <= 0) {
      clearTimeout(this._rotation_timer);
      logger.debug('[rotate] not rotating locations');
      return;
    }

    logger.debug('[rotate] starting to rotate locations every ' + interval + ' minutes');
    clearTimeout(this._rotation_timer);
    this._rotation_timer = setTimeout(function() {
      try {
        if (!self._rotation_paused)
          self.selected(self.next());
      } catch (e) { logger.error(e); }
    }, interval * (60 * 1000));
  },

  pause_rotating: function() {
    //TODO resume after X minutes in case resume isn't called
    logger.debug("paused rotating");
    var self = this;
    this._rotation_paused = true;
    this._rotation_paused_timer = setTimeout(function() {
      logger.debug('rotation pause timed out. resuming');
      self.resume_rotating();
    }, 5 * 60 * 1000 /* 5 minutes */);
  },

  resume_rotating: function() {
    logger.debug("resumed rotating");
    this._rotation_paused = false;
    clearTimeout(this._rotation_paused_timer);
    this.start_rotating();
  },

  /* removes the specified key from the locations datastore */
  _remove: function (key) {
    this._datastore.remove(KEY + key);
  },

  /* gets (and optionally sets) data in the locations datastore */
  _storage: function (key, /*optional*/ data) {
    if (data !== undefined)
      this._datastore.set(KEY + key, data, true);
    return this._datastore.get(KEY + key, true);
  },

  /* the main function for updating a location */
  update_feed: function (location, force) {
    logger.debug('updating feed for ' + location.code);
    var code = location.code;
    var name = location.name;
    var self = this;

    // clear old timers
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }

    if (this._updates_disabled) {
      logger.debug('updates disabled');
      return;
    }

    $.when(this.update_part(location, 'cc', force),
           this.update_part(location, 'forecast', force)).done(function() {
      logger.debug('locations main callback');

      var data = {
        cc: self.original_data('cc', location),
        forecast: self.original_data('forecast', location)
      };

      try {
        var processed = self._processor.process_data(data, location);
        self.processed_data(location, processed);
        self.update_caches(processed);

        self._observers.notify('feed-ready', code);
        self.schedule_update(location, false);
      } catch (e) {
        logger.error('data processing failed. invalid. removing data', e);
        logger.error(e);
        self.last_update_time(location, 'cc', 1);
        self.last_update_time(location, 'forecast', 1);
        self.schedule_update(location, true);
      }
    }).fail(function(error_code) {
      logger.error('locations update failed');
      self._observers.notify('feed-error', error_code);
      self.schedule_update(location, true);
    });
  },

  update_part: function(location, part, force) {
    var ttl = this.time_to_expire(location, part);
    var self = this;
    if (!force && ttl > 0 && this.original_data(part, location))
      return $.Deferred().resolve();

    logger.debug('updating ' + part);
    this._observers.notify('feed-updating', location);

    return this._adapter.fetch_feed_data(location.code, part)
        .done(function(data) {
          logger.debug(part + ' data received for ' + location.code);
          data.locale = i18n.locale();
          self.original_data(part, location, data);
          self.last_update_time(location, part, Date.now());
      });
  },

  update_caches: function(data) {

    expire_cache(data.radar.images.regional.large);
    expire_cache(data.radar.images.regional.medium);
    expire_cache(data.radar.images.regional.small);
    expire_cache(this._preferences.preference('toolbar')['radar_custom'].url);

  }
});

/* checks if two locations are equal (names AND codes are checked) */
function are_completely_equal (loc1, loc2) {
  return ((loc1.code == loc2.code) && (loc1.name == loc2.name));
}

/* moves the specified location to the front of the list */
function move_to_front (list, location) {
  if (!list.some(function(l) { return l.code == location.code; } ))
    return [ location ].concat(list);

  // l is in there, but we don't know if it has a different name
  if (!list.some(function(l) { return are_completely_equal(l, location); })) {
    return [ location ].concat(
      list.filter(function(l) {return !(l.code == location.code);})
    );
  }

  return list;
}

function unique (list) {
  var new_list = [];
  list.forEach(function(loc) {
    if (contains(new_list, loc)) return;
      new_list.push(loc);
  });
  return new_list;
}

/* checks if a list of locations contains the specified location */
function contains (list, location) {
  return list.some(function(l) { return l.code == location.code; });
}

/* validates a list of locations */
function validate_all (list) {
  return unique(list.filter(function(l) { return validate(l); }));
}

/* validates a location */
function validate (location) {
  if (!location || typeof(location) != 'object' || !('code' in location)) {
    logger.error('location failed validation: ' +
                 JSON.stringify(location));
    return false;
  }

  return true;
}

})();