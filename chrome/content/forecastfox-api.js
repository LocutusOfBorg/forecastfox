function forecastfox_api() {
  var bgp = Forecastfox.services();
  var observers = bgp.observers;
  var locations = bgp.locations;
  var logger = bgp.logging.getLogger("api");

  var EventEndpoint = Class.extend({
    init: function(topic, relay_data) {
      var self = this;
      this.topic = topic;
      this._callbacks = [];
      this._callback = function(topic, data) {
        self._observe(topic, (relay_data ? data : undefined));
      };
      observers.add(topic, this._callback);
    },

    _observe: function(data) {
      this._callbacks.forEach(function(callback) {
        try {
          setTimeout(function() { callback.apply(null, [data]); }, 0);
        } catch (e) {
          logger.exception("ERROR: " + e + "\n");
        }
      });
    },

    addEventListener: function(callback) {
      this._callbacks.push(callback);
    },

    removeEventListener: function(callback) {
      this._callbacks = this._callbacks.filter(function(o) { return o != callback; });
    }
  });

  var events = {
    updateStart: new EventEndpoint('feed-updating', false),
    dataReady: new EventEndpoint('feed-ready', false),
    updateError: new EventEndpoint('feed-error', true)
  };

  var data = {
    all: function() { return locations.processed_data(); },
    cc: function() { return locations.processed_data().cc; },
    radar: function() { return locations.processed_data().radar; },
    forecast: function(dayIndex, isDay) {
      return locations.processed_data().forecast[dayIndex][isDay ? 'day':'night'];
    },
    swa: function() {
      return locations.processed_data().swa;
    },
    location: function() {
      return locations.processed_data().location;
    }
  };

  var images = {
    small: function(index) { return themes.smallImage(index); },
    large: function(index) { return themes.largeImage(index); }
  };

  return {
    events: events,
    data: data,
    images: images
  };
}