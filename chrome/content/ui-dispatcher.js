var UIDispatcher = Class.extend({
  init: function() {
    var logger = logging.getLogger('ui-dispatcher'),
          self = this;

    var search_callback = function (search_id, code) {
      observers.notify('ui-location-search-results', {
        status: 'success',
        code: code,
        search_id: search_id
      });
    };

    var search_errback = function (search_id) {
      observers.notify('ui-location-search-results', {
        status: 'error',
        search_id: search_id
      });
    };

    // location search
    observers.add('ui-location-search-request', function(msg) {
      var query = null;
      if ('latlng' in msg) query = { latlng: msg.latlng };
      if ('location' in msg) query = { location: msg.location };
      if (query)
        adapter.find_location(query, msg.search_id, search_callback, search_errback);
    });

    // get options
    observers.add('ui-get-options-request', function(msg) {
      observers.notify('ui-get-options-results', preferences.preferences());
    });

    // set options
    observers.add('ui-set-options-request', function(msg) {
      preferences.preferences(msg);
//      observers.notify('ui-get-options-results', preferences.preferences(msg));
    });

    observers.add('ui-get-locale-request', function(msg) {
      observers.notify('ui-get-locale-results', {
        selected: i18n.locale(),
        supported: i18n.supported(),
        data: i18n.all_data()
      });
    });

    observers.add('ui-set-locale-request', function(msg) {
      i18n.locale(msg);
    });

    observers.add('locale-ready', function (msg) {
      observers.notify('ui-get-locale-results', {
        selected: i18n.locale(),
        supported: i18n.supported(),
        data: i18n.all_data()
      });
    });

    // get and set locations
    observers.add('ui-get-locations-request', function(msg) {
      self.ui_get_locations_results();
    });

    observers.add('ui-set-locations-request', function(msg) {
      self.ui_get_locations_results(msg.selected, msg.saved);
    });

    observers.add('ui-set-location-request', function(msg) {
      self.ui_get_locations_results(msg/*selected*/);
    });

    observers.add('location-changed', function(msg) {
      observers.notify('ui-get-locations-results', {
        selected: msg.selected,
        saved: msg.saved
      });
    });

    observers.add('ui-remove-location-request', function(msg) {
      var prev = locations.saved(), idx = -1, id = msg;
      for (var i = 0; i < prev.length; i++) {
        if (prev[i].code == id) idx = i;
      }

      if (idx != -1) {
        prev.splice(idx, 1);
        locations.saved(prev);
      }

      self.ui_get_locations_results();
    });

    observers.add('ui-restore-defaults-request', function() {
      restore_all_defaults(true);
      observers.notify('ui-restore-defaults-results', {});
    });

    observers.add('ui-options-close', function() {
      themes.install_current_pack();
    });

    logger.debug('initialized');
  },

  ui_get_locations_results: function(selected, saved) {
    observers.notify('ui-get-locations-results', {
      selected: locations.selected(selected),
      saved: locations.saved(saved)
    });
  }
});
