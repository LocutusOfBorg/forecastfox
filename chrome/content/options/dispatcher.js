
var dispatcher = {};

$(function() {

  dispatcher.get_locations = function(callback) {
    observers.notify('ui-get-locations-request', {});
  };

  dispatcher.set_location = function(code, name, latlng) {
    observers.notify('ui-set-location-request', {
      code: code,
      name: name,
      latlng: latlng
    });
    show_saved_message();
  };

  dispatcher.get_location_search_results = function(query, callback) {
    observers.notify('ui-location-search-request', query);
  };

  dispatcher.remove_previous_location = function(code, callback) {
    observers.notify('ui-remove-location-request', code);
    show_saved_message();
  };

  dispatcher.set_options = function(properties) {
    observers.notify('ui-set-options-request', properties);
    show_saved_message();
  };

  dispatcher.get_options = function() {
    observers.notify('ui-get-options-request', {});
  };

  dispatcher.get_locale = function() {
    observers.notify('ui-get-locale-request', {});
  };

  dispatcher.set_locale = function(locale) {
    observers.notify('ui-set-locale-request', locale);
    show_saved_message();
  };

  dispatcher.localize = function() {

  };
});
