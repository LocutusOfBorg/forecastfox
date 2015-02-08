function init_firefox_migrator() {
  var logger = logging.getLogger('location-migrator');
  var migration_count = 0;
  var icon_pack_map = {
    'default': 1,
    'wicon': 2,
    'ffshiny': 3,
    'CaBrA': 4,
    'CaBrAv2': 5,
    'classic': 6,
    'sdock': 7,
    'nampo': 8,
    'Claire': 9,
    'Claire Mega': 10,
    'Classic Winstripe': 11,
    'dashboard_noback': 12,
    'dashboard_back': 13,
    'Economy': 14,
    'OldBBC': 15,
    'Union TM': 16,
    'Abstract': 17
  };

  function migrate_old_locations() {
    logger.debug('attempting to migrate old location codes');

    var old_locations = get_old_location_codes();
    var selected_profile = get_old_pref('profile.current', 'Char');
    if (selected_profile === null) selected_profile = 'default';
    for (var x = 0; x < old_locations.length; x++) {
      var profile = old_locations[x].profile,
             code = strip_trailing_pipe(old_locations[x].location);

      migrate_location(code, profile == selected_profile);
    }
  }

  function migrate_old_preferences(preferences) {
    if (!get_old_profile_document()) {
      logger.debug('not migrating from firefox');
      return;
    }

    logger.debug('attempting to migrate old Forecastfox preferences');

    var toolbar = preferences.preference('toolbar'),
          theme = preferences.preference('theme'),
          value = null;

    // 1. current conditions on toolbar?
    if (get_old_pref('cc.panel.enabled', 'Bool') === false) {
      logger.debug('migrating cc enabled pref');
      toolbar.cc = false;
    }


    if (get_old_pref('hbh.panel.enabled', 'Bool') === false) {
      logger.debug('disabling hbh panel');
      toolbar.hourly = false;
    }

    if (get_old_pref('fiveday.panel.enabled', 'Bool') === false) {
      logger.debug('disabling 5day panel');
      toolbar.day5 = false;
    }

    if (get_old_pref('units.current', 'Char') == '1') {
      logger.debug('switching units to metric');
      preferences.preference('unitsystem', 'metric');
    }

    if (value = get_old_pref('icons.current', 'Char')) {
      logger.debug('switching icons to: ' + value);
      if (value in icon_pack_map)
        theme.icon_pack = icon_pack_map[value];
      else
        logger.warn('unkown icon pack');
    }

    // 6. how many forecasted days should we show?
    if ((value = get_old_pref('dayf.panel.days', 'Int')) !== null) {
      logger.debug('migrating the number of forecast days');
      toolbar.days = Math.min(4, value+1);
    }

    if ((value = get_old_pref('dayf.panel.mode', 'Int')) !== null) {
      var mode = [ "days", "nights", "days-nights" ];
      if (value >= 0 && value <= 2)
        toolbar.days_or_nights = mode[value];
    }

    // 4. show text labels on toolbar?
    var count = 0;

    if ((value = get_old_pref('cc.panel.display', 'Int')) === null)
      if (toolbar.cc) count++;

    if ((value = get_old_pref('dayt.panel.display', 'Int')) === null)
      if (toolbar.days >= 1) count++;

    if ((value = get_old_pref('dayf.panel.display', 'Int')) === null)
      if (toolbar.days > 1) count += toolbar.days * ( toolbar.days_or_nights == 'days-nights' ? 2 : 1);

    toolbar.display = Math.min(9, count);

    // 5. where should we put the toolbar?
    if ((value = get_old_pref('general.bar', 'Char')))
      toolbar.parent = value;

    if ((value = get_old_pref('general.position', 'Int')) !== null)
      toolbar.position = value;


    var rotate = {};

    if ((value = get_old_pref('profile.switch.enabled', 'Bool')) !== null)
      rotate.enabled = value;

    if ((value = get_old_pref('profile.switch.delay', 'Int')) !== null)
      rotate.interval = value;


    // save the new prefs
    preferences.preference('toolbar', toolbar);
    preferences.preference('theme', theme);
    preferences.preference('rotate', rotate);

    // if they've had Forecastfox for Firefox installed before, we should
    // set the migration flag so the options screen can use that.
    if (get_old_pref('migrated', 'Char')) {
      preferences.preference('firefoxmigration', true);
    }
  };

  function migrate_location(code, isDefault) {
    migration_count++;
    logger.debug('attempting to migrate code: ' + code + ' count: ' + migration_count);
    adapter.find_location({location: code}, Math.random(),
      function(search_id, new_code, city_name, country) {
        var name = city_name + ', ' + country;
        logger.debug('found code ' + new_code + ' (' + name + ') for ' + code);
        var saved = locations.saved();
        var new_loc = {'name': name, 'code': new_code};
        saved.push(new_loc);
        locations.saved(saved);
        if (isDefault) locations.selected(new_loc);
        are_locations_done();
      },
      function(search_id) {
        logger.warn('could not migrate ' + code);
        are_locations_done();
      }
    );
  }

  function are_locations_done() {
    if (--migration_count === 0) {
      try {
        ui_dispatcher.ui_get_locations_results();
      } catch (e) { dump(e.toString() + '\n'); }
    }
  }

  function strip_trailing_pipe(code) {
    if (code[code.length-1] == '|') return code.substring(0, code.length-1);
    return code;
  }

  // These remaining functions access data from the old Forecastfox installations

  function get_old_pref(pref, type) {
    var prefs = Components.classes['@mozilla.org/preferences-service;1'].
                  getService(Components.interfaces.nsIPrefService);
    prefs = prefs.getBranch('forecastfox.');

    // if the user hasn't touched it, ignore that value
    if (!prefs.prefHasUserValue(pref)) return null;

    // otherwise return it
    if (type == 'Bool') return prefs.getBoolPref(pref);
    if (type == 'Char') return prefs.getCharPref(pref);
    if (type == 'Int') return prefs.getIntPref(pref);
    return null;
  }

  function get_old_location_codes() {
    var doc = get_old_profile_document();
    if (!doc) return [];

    var locPrefs = $('pref[name="general.locid"]', doc);
    var locations = [];
    for (var x = 0; x < locPrefs.length; x++) {
      var locPref = locPrefs[x];
      locations.push({'profile': locPref.parentNode.getAttribute('id'),
                      'location': locPref.getAttribute('value'),
                      'migrated': false });
    };
    return locations;
  };

  function get_old_profile_document() {
    //get directory service
    var dirSvc = Components.classes["@mozilla.org/file/directory_service;1"].
                 getService(Components.interfaces.nsIProperties);

    //get base directory
    var dir = dirSvc.get('ProfD', Components.interfaces.nsIFile);

    //loop through path array
    dir.append('forecastfox');
    dir.append('profiles.xml');

    if (!dir.exists()) return false;
    var contents = read_file(dir);
    var parser = new DOMParser();
    var doc = parser.parseFromString(contents, 'text/xml');
    return doc;
  };

  function read_file(file) {
    try {
      var data     = new String();
      var fiStream = Components.classes['@mozilla.org/network/file-input-stream;1']
                                .createInstance(Components.interfaces.nsIFileInputStream);
      var siStream = Components.classes['@mozilla.org/scriptableinputstream;1']
                                .createInstance(Components.interfaces.nsIScriptableInputStream);
      fiStream.init(file, 1, 0, false);
      siStream.init(fiStream);
      data += siStream.read(-1);
      siStream.close();
      fiStream.close();
      return data;
    } catch(e) {
      dump('test');
      return false;
    }
  };

  return {
    migrate_old_preferences: migrate_old_preferences,
    migrate_old_locations: migrate_old_locations,
    get_old_pref: get_old_pref
  };
};