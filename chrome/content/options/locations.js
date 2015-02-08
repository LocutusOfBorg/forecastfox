
/* API for location UI<->plugin integration

the page assumes a global object 'locations' that encapsulates 5 functions.

-- 1. get current location. this asks the plugin for the user's currently displayed location.
note that a user _always_ has a displayed location (this function must always return a
location). upon first installation, for example, the plugin should pick a default location
(perhaps based on IP.)

the format of a location is a pair [id, displayString], where the id is whatever the plugin
uses internally to identify locations (this is opaque to the UI), and displayString is what
users see. for example, a return value might look like: ['loc-234-MA', 'Boston, MA']

locations.get_location = function() {...};  // returns [id, displayString]


-- 2. set current location. this changes the location FF is currently displaying. it tells the
plugin to do two things: change the currently saved location, and add/move the old location to
the top of the previous locations list. (it'll add if the location isn't in the list, move if
it is.)

locations.set_location = function(code, displayString) {...} // returns: undefined


-- 3. search for locations. this takes an arbitrary query string and a callback. it invokes the
callback asynchronously with either a list of matching cities or the string 'error'. the elements of
the list are id-displayString pairs, and it should be sorted by likelihood of what the user wants
(for example a search for "rome" should return "Rome, Italy" first, "Rome, OR" later.) It should
pass the callback an empty array if no results were found. Only pass 'error' to the callback for an
unexpected failure, such as a timeout or 500 internal server error.

// invokes callback passing one argument of the form: 'error' or [[id, displayString], ... ]
locations.get_search_results = function(query, callback) {...};


-- 4. get previous locations. gets the user's list of previously viewed locations, in the form
of [id, displayString] pairs. the list it returns should be sorted by recency, with most recent
first. it should return an empty array if no results were found.

locations.get_previous_locations = function() {...}; // returns [[id, displayString], ... ]


-- 5. remove previous location. takes a location id and, if the corresponding location
is present in the user's previous locations list, removes it. Returns true if a location was removed, false otherwise. If the removed location is the current location, the current
location is changed to the first element in previous locations.

locations.remove_previous_location = function(id) {...};  // returns boolean
*/
var map, loc_count = 0, geocodes = [], init_previous_locations,
  map_initialize;

$(function() {

    var SEARCH_URL = 'http://forecastfox.accuweather.com/widget/forecastfoxjson/location-seek-json.asp?';

    // wrapping the search bars with an empty form
    // lets me use jquery's convenient $('form').submit(...)
    var form = $('.location_form'),
       fmain = $('#locations > .location_form'),
        fmap = $('#boxes .location_form'),
        bars = $('.search_bar');
    var search_results = $('#search_results');
    var search_error = $('.search_error');
    var previous_locations = $('#previous_locations');
    var loc_count = 0;
    var last_search = false;
    var show_english_locations = false;
    // location info cache
    var locs;

    setTimeout(load_google_maps, 1000);

    function load_google_maps() {
      var i18n_2 = new I18n(logging, observers, datastore);
      var script = document.createElement("script");
      script.type = "text/javascript";

	var script_url = 'http://maps.google.com/maps/api/js?sensor=false&callback=map_initialize&language=';
	var lang = (show_english_locations) ? 'en' : i18n_2.locale();

      script.src = script_url + lang;
      document.body.appendChild(script);
    }

    map_initialize = function() {
      var map_options = {
        zoom: 2,
        center: new google.maps.LatLng(0.0,0.0),
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        mapTypeControl: false
      };

      map = new google.maps.Map(document.getElementById('map_canvas'), map_options);
    }

    var loc_template =
      '<span class="loccontainer">'+
        '<input type="text" class="location-rename hidden" value="${name}" />' +
        '<span class="option location" id="prev-${id}">${name}</span>' +
        '<span class="links">' +
          '<div class="remove" rel="localize[options.remove]" id="remove-${id}">${remove}</div>' +
          '<div class="rename" rel="localize[options.rename]" id="rename-${id}">${rename}</div>' +
          '<div class="save hidden" rel="localize[options.save]" id="save-${id}">${save}</div>' +
        '</span>' +
      '</span>';

    // adds current previous locations
    init_previous_locations = function(new_locs) {
      // locs is the cached variable
      if (new_locs) locs = new_locs;
      if (!locs) return;
      var saved_locations = locs.saved;
      var selected_location = locs.selected;
      $('#previous_locations .loccontainer').remove();
      $(saved_locations).each(function() {
        var id = id_escape(this.code);
        var name = this.name;

        $('#previous_locations_list').append(
          $.template(loc_template).apply({
            id: id,
            name: name,
            remove: i18n.data('options.remove'),
            rename: i18n.data('options.rename'),
            save: i18n.data('options.save')
          })
        );
      });
      radio_group('#previous_locations .location');

      // hide previous locations if there's only one
      // previous location (the current location).
      if($('#previous_locations .location').size() > 1)
        show_previous();
      else
        hide_previous();

      // set location logic
      $('#previous_locations .location').click(function() {
        var id = id_unescape($(this).attr('id').replace(/^prev-/, ''));
        var displayString = $(this).text();
        set_location(id,displayString);
      });

      // select current location
      select_location(selected_location.code, selected_location.name);

      // remove logic
      $('.remove').unbind('click').click(function() {
        var id = id_unescape($(this).attr('id').replace(/^remove-/, ''));
        dispatcher.remove_previous_location(id);
      });

      $('.rename').unbind('click').click(function() {
        var id = id_unescape($(this).attr('id').replace(/^rename-/, ''));
        var input = $(this).parent().siblings('.location-rename');
        var option = $(this).parent().siblings('.option');

        option.toggleClass('hidden', true);
        input.attr('size', Math.max(25,option.text().length)).toggleClass('hidden', false);
        $(this).toggleClass('hidden', true);
        $(this).siblings('.save').toggleClass('hidden', false);

        input.focus();
      });

      $('.save').unbind('click').click(function() {
        save_rename($(this).parents('.loccontainer'));
      });

      $('.loccontainer .location-rename').unbind('change').change(function () {
        save_rename($(this).parents('.loccontainer'));
      });
    };

    function save_rename(loccontainer) {
      var option = loccontainer.children('.option');
      var name = loccontainer.children('.location-rename').val();
      var id = id_unescape(option.attr('id').replace(/^prev-/, ''));
      set_location(id, name);
    }

    // wraps around locations.set_location, adds ui events
    function select_location(id, displayString) {
      $('#prev-'+id_escape(id)).addClass('selected');
      $('#header-location').html(templator.render(i18n.data("options.current"),
          { 'location-name': '<strong>'+displayString+'</strong>' }
       ));
    }
    function set_location(id, displayString) {
      select_location(id, displayString);
      hide_search();
      dispatcher.set_location(id, displayString);
    }

    // TODO: add jqui transitions to these
    function show_search() {
        //search_results.show();
    }
    function hide_search() {
        // we always display the google maps interface now
        //search_error.hide();
        //search_results.hide();
    }

    function show_previous() {
      //$('.previous').show();
    }
    function hide_previous() {
      //$('.previous').hide();
    }

    function reset(bar) {
      bar.toggleClass('defaults', false).attr('value', '');
    }

    function clear(bar) {
      bar.toggleClass('defaults', true);
      bar.attr('value', i18n.data('options.search.instructions'));
    }

    hide_search();

    function id_escape(id) { return escape(id).replace(/%/g, "-_-_-"); }
    function id_unescape(id) { return unescape(id.replace(/-_-_-/g, "%")); }

    bars.focus(function() {
      if ($(this).hasClass('defaults')) reset($(this));
    });

    bars.blur(function () {
      if(!$.trim($(this).val())) clear($(this));
    });

    //$('.cancel').click(function() {
    //  hide_search();
    //  reset();
   // });

    /*$('.geolocate').click(function() {
      console.log("geolocating");
      Forecastfox.geolocation.getCurrentPosition(
        function(position) {
          console.log(position);
        }
//        function(positionError) {
//          console.log("ERROR!");
//        },
//        {enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
      );
    });
    */
// this section is dedicated to the location search features
  loc_count = 0;


  var Geocode = Class.extend({
    init: function(geocode) {
      this._name = null;
      this._code = null;
      this._geocode = geocode;
      this._reverse_geocode = null;
      this._address = null;
      this._id = 'loc-result-' + (loc_count++);

      this._extract_address();
    },

    /* returns the name as it will appear throughout Forecastfox. null if not ready */
    name: function(n) {
      if (n !== undefined) {
        this._name = n;
        // TODO update data / rendering?
      }
      return this._name;
    },

    /* returns the code AccuWeather uses for this location. null if not ready */
    code: function(c) {
      if (c !== undefined) {
        this._code = c;
        // TODO update data / rendering?
      }
      return this._code;
    },

    marker: function() { return this._marker; },

    infowindow: function() { return this._infowindow; },

    render: function() {
      var latlng = this.latlng();

      this.marker = new google.maps.Marker({
        'map': map,
        'position': latlng,
        'title': this.name()
      });

      var scratch = $('#scratch_space');
      scratch.html(templator.render('#info_template', {
        id: this.id(), name: this.name()
      }, true));

      this.infowindow = new google.maps.InfoWindow({
        'content': $('#' + this.id())[0]
      });

      this._install_listeners();
    },

    _install_listeners: function() {
      var self = this;
      this._infowindow_click =
        google.maps.event.addListener(this.marker, 'click', function() {
          close_all_infowindows();
          self.open();
      });

      this._infowindow_domready =
        // TODO move into the click event
        google.maps.event.addListener(this.infowindow, 'domready', function() {
          self._locate_on_accuweather();
          $('#' + self.id() + ' button').click(function() {
            self.select_location();
            setTimeout(hide_dialogues, 1000);
            return false;
          });

          $('#' + self.id() + ' .zoom').click(function() {
          	map.fitBounds(self.viewport());
          	close_all_infowindows();
            return false;
          });

          $('#' + self.id() + ' .tryagain').click(function() {
            self._locate_on_accuweather();
            return false;
          });
      });
    },

    latlng: function() { return this._geocode.geometry.location; },

    viewport: function() { return this._geocode.geometry.viewport; },

    id: function() { return this._id; },

    open: function() { this.infowindow.open(map, this.marker); },
    close: function() { this.infowindow.close(); },

    remove: function() {
      this.close();
      this.marker.setMap(null);
    },

    toString: function() { return JSON.stringify(this._geocode); },

    select_location: function() {
      logger.debug(JSON.stringify(this.backing()));
      var backing = this.backing();
      dispatcher.set_location(backing.code, backing.name, backing.latlng);
      $('#' + this.id() + ' .checkmark').removeClass('vhidden');
    },

    backing: function() {
      return {
        name: this._name,
        code: this._code,
        latlng: { lat: this.latlng().lat(), lng: this.latlng().lng() }
      };
    },

    lookup_name: function() {
      // first start with the formatted address field;
      this._name = this._address.formatted_address;
    },

    _extract_address: function() {
      this._address = {};
      var geocode = this;
      $.each(this._geocode.address_components, function() {
        var comp = this;
        $.each(this.types, function() {
          geocode._address[this] = comp.short_name;
        });
      });
      this._address.formatted_address = this._geocode.formatted_address;
    },

    /** auto_select=true if we should select location on success */
    _locate_on_accuweather: function(bypass_map) {
      var address = this._address,
              url = SEARCH_URL,
             resp = this._geocode,
          geocode = this,
             self = this,
            query = {
              latlng: { lat: resp.geometry.location.lat(),
                        lng: resp.geometry.location.lng() },
              search_id: this.id()
            };

      if ('country' in address && address.country == 'US' && 'postal_code' in address)
        query = { location: address.postal_code, search_id: this.id() };

      if (bypass_map) {
        this._lookup_success = function() {
          //fmain.children('.spinner').hide();
          self.select_location();
        }

        this._lookup_error = function() {
          var msg = i18n.data('options.search.accuerror');
          $('#location > .gmap-error').text(msg).show()
          fmain.children('.spinner').hide()
        }

        fmain.children('.spinner').show();
      }

      dispatcher.get_location_search_results(query);

      $('#' + this.id() + ' .throbber').toggleClass('vhidden', false);
    },

    _lookup_error: function() {
      var id = '#' + this.id();
      $(id + ' .throbber').toggleClass('vhidden', true);
      $(id + ' .geocode_error').toggleClass('vhidden', false);
    },

    _lookup_success: function() {
      var id = '#' + this.id();
      $(id + ' button').attr('disabled', false);
      $(id + ' .throbber').toggleClass('vhidden', true);
      $(id + ' .geocode_error').toggleClass('vhidden', true);
    }
  });

  function remove_all_markers() {
    $.each(geocodes, function() { this.remove(); });
  }

  function close_all_infowindows() {
    $.each(geocodes, function() { this.infowindow.close(); });
  }

  function get_geocode_options(/*OPTIONAL*/ search_query) {
    var query = search_query;
    // save the search for if we need to resubmit
    last_search = query;
    var opts = { address: query, language: i18n.locale() };
    if (show_english_locations)
      opts.language = 'en';
    return opts;
  }

  observers.add('ui-location-search-results', function(results) {
    var search_id = results.search_id;
    var status = results.status;
    var geocode;
    for (var x = 0; x < geocodes.length; x++) {
      if (geocodes[x].id() == search_id)
        geocode = geocodes[x];
    }

    if (!geocode) return;

    if (status == 'error') {
      geocode._lookup_error();
    } else if (status == 'success') {
      geocode.code(results.code);
      geocode._lookup_success();
    }

  });

  observers.add('ui-get-locations-results', function(results) {
    init_previous_locations(results);
  });

  observers.add('preference-update', function (preferences) {
    if ('locations' in preferences)
      init_previous_locations(preferences.locations);
    if ('show_english_locations' in preferences) {
      var new_english_pref = preferences['show_english_locations'];
      if (new_english_pref != show_english_locations) {
      	// here we preform a new search if they change the lang pref
        show_english_locations = new_english_pref;
        //if (last_search) do_geocode_search(last_search);
      }
    }
  });

  observers.add('ui-get-options-results', function(preferences) {
    if ('show_english_locations' in preferences)
      show_english_locations = preferences['show_english_locations'];
  });

  function do_geocode_search(f) {
    try {
      remove_all_markers();
      var search_query = $.trim(f.children('.search_bar').val());
      if (search_query == '' || f.children('input').hasClass('defaults')) {
        show_map();
        return;
      }
      // this is the search function!
      var geocoder = new google.maps.Geocoder();
      f.children('.spinner').show();
      geocoder.geocode(get_geocode_options(search_query), function(geocode_responses, status) {
        f.children('.spinner').hide();
        if (status == google.maps.GeocoderStatus.OK) {
          if (geocode_responses.length > 1)
            show_map();

          $('.gmap-error').toggleClass('hidden', true);
          close_all_infowindows();
          geocodes = [];
          var bounds = null;
          $.each(geocode_responses, function() {
            var geocode = new Geocode(this);
            var vp = geocode.viewport();
            if (!bounds)
              bounds = new google.maps.LatLngBounds(vp.getSouthWest(),
                                                    vp.getNorthEast());
            bounds.extend(geocode.latlng());
            geocode.lookup_name();
            geocode.render();
            geocodes.push(geocode);
          });
          map.fitBounds(bounds);
          if (geocodes.length == 1) {
            if ($('#mask').css('display') == 'none')
              geocodes[0]._locate_on_accuweather(true);
            else {
              geocodes[0].open();
              map.setZoom(map.getZoom() - 6);
            }
          }
        } else if (status == google.maps.GeocoderStatus.ZERO_RESULTS) {
          f.siblings('.gmap-error').text(i18n.data('options.search.nolocs'));
          f.siblings('.gmap-error').toggleClass('hidden', false);
        } else {
          f.siblings('.gmap-error').text(i18n.data('options.search.error'));
          f.siblings('.gmap-error').toggleClass('hidden', false);
        }
      });
    } catch (e) { logger.debug('ERROR: ' + e); }
  }

  form.submit(function() {
    do_geocode_search($(this));
    return false;
  });

  $('.location_form .search_button').click(function() {
    do_geocode_search($(this).parent('form'));
  });

  function show_map() {
    var winHeight = $(window).height();
    var winWidth = $(window).width();

    var mapHeight = winHeight * .70;
    $('#boxes #map_canvas').height(mapHeight);
    $('#boxes .window').height(mapHeight + 50);

    var maskHeight = $(document).height();
    var maskWidth = $(window).width();

    var id = '#search_dialogue';

    $('#mask').css({'width': maskWidth, 'height':maskHeight});
    $('#mask').show();

    $(id).css('top', winHeight/2-$(id).outerHeight()/2);
    $(id).css('left', winWidth/2-$(id).outerWidth()/2);

    $(id).show();

    google.maps.event.trigger(map, 'resize');
    if (geocodes.length == 0) {
      map.setZoom(2);
      map.setCenter(new google.maps.LatLng(0.0,0.0));
    }
  }

  //if mask is clicked
  function hide_dialogues() {
    $('#mask').hide();
    $('.window').hide();
    clear($('.window .search_bar'));
  }
  $('#mask').click(function () {
    hide_dialogues();
  });

  $('.window .close').click(function() {
    hide_dialogues();
    return false;
  });
});

