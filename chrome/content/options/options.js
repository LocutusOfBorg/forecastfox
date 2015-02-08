
// options.js exposes these names
var get_options;
var set_options;
var show_saved_message;

(function() { // prevent other namespace pollution
  var URL_REGEX = /^https?:\/\/.+$/;
/*
UI-to-backend interfacing code. call get_options() to get the list of
currently set preferences. call set_options(obj) to change them.

the properties object returned by get_options, and expected by set_options,
has this structure (illustrated by example):

set_options({
    unit_system: "metric",
    custom_units: {
        temperature: "c",
        wind: "mph",
        time: "h12",
        pressure: "inhg",
        visibility: "mi",
        precipitation: "mm"
    },
    data_options: {
        humidity: true,
        precipitation: false,
        pressure: true,
        uv: true,
        visibility: false,
        wind: true
    },
    forecasted_days: 9
});

menu structures can be set as well, leaving
other options untouched. for example:

set_options({
    unit_system: "metric",
    custom_units: {
    pressure: "mmhg"
}
});

get_options() always returns a full properties object
that looks like the first example.
   */
  var previous_options = {};

  get_options = function() {

    function get_opt_by_id(option_group_selector) {
      var selected = $(option_group_selector+" .option.selected");
      if ($(option_group_selector+' .option').hasClass('multi')) {
        selected.sort(function(a,b) { return $(a).attr('sindex') - $(b).attr('sindex'); });
        return $.map(selected, function(e) { return $(e).attr('id'); });
      } else
        return $(option_group_selector+" .option.selected").attr("id");
    }
    function get_opt_by_boolean(option_group_selector) {
      return $(option_group_selector+" .option.selected").hasClass("yes");
    }

    var unitsystem = get_opt_by_id(".unit_system");

    units = {};
    $.each(units_categories, function() {
      if (this != "distance-lng" && this != "distance-shrt") {
        units[this] = get_opt_by_id("#units ."+this);
      } else {
        if (!units.distance)
          units.distance = {};
        if (this == "distance-lng") {
          units.distance.lng = get_opt_by_id("#units ."+this);
        } else if (this == "distance-shrt") {
          units.distance.shrt = get_opt_by_id("#units ."+this);
        }
      }
    });

    logger.debug('get UNITS: ' + JSON.stringify(units));

    display = {};
    $.each(weather_data_categories, function() {
      display[this] = get_opt_by_boolean("#data_booleans ."+this);
    });

    var days = 7;//parseInt(get_opt_by_id(".option_group.days").replace("days", ""));
    var show_english_locations = get_opt_by_boolean(".show_english_locations");

    days = parseInt(get_opt_by_id('.days').replace('days', ''));
    var icons = get_opt_by_id('.icon_pack');
    if (icons)
      icons = icons.replace('icons-', '');
    else
      icons = previous_options.theme.icon_pack;
    var show_cc = get_opt_by_boolean('.show_cc');

    var show_radar = get_opt_by_id('.show_radar').replace('radar-', '');
    var radar_url = $('#radar_custom-url').val();
    if (!radar_url.match(URL_REGEX))
      radar_url = 'http://' + radar_url;
    var show_radar_custom = {
      url: radar_url,
      width: Number($('#radar_custom-width').val()),
      height: Number($('#radar_custom-height').val())
    };

    var show_swa = get_opt_by_boolean('.show_swa');
    var show_hourly = get_opt_by_boolean('.show_hourly');
    var show_day5 = get_opt_by_boolean('.show_day5');
    var rotate = $('.rotate_locations input[type=checkbox]').attr('checked');
    var rotate_interval = Number($('.rotate_locations input[type=text]').val());
    var show_days_or_nights = get_opt_by_id('.show_days_or_nights').replace('daynight-', '');
    if (rotate_interval == 0 || isNaN(rotate_interval)) rotate_interval = 1;
    var show_separators = get_opt_by_boolean('.show_separators');
    var label_display = parseInt(get_opt_by_id('.label_display').replace('labels', ''));
    var location_name = $('.display_location input[type=checkbox]').attr('checked');


    return {
      "unitsystem": unitsystem,
      "units": units,
      "display": display,
      "show_english_locations": show_english_locations,
      "defaults": false,
      "rotate": {
        "enabled": rotate,
        "interval": rotate_interval
      },
      "theme": {
        "icon_pack": icons,
        "separators": show_separators
      },
      "toolbar": {
        "days": days,
        "cc": show_cc,
        "hourly": show_hourly,
        "day5": show_day5,
        "days_or_nights": show_days_or_nights,
        "location_name": location_name,
        "radar": show_radar,
        "radar_custom": show_radar_custom,
        "swa": show_swa,
        "display": label_display,
        "position": ((previous_options.toolbar||{}).position),
        "parent": ((previous_options.toolbar||{}).parent||'status-bar')
      }
    };
  };

  function set_opt_by_id(option_group_selector, selected_option_id) {
    var options = $(option_group_selector+' .option').removeClass('selected');
    if (selected_option_id instanceof Array) {
      options.attr('sindex', '').children('.sindex').remove();
      for (var x = 0, len = selected_option_id.length; x < len; x++) {
        options.filter('#'+selected_option_id[x])
               .addClass('selected')
               .attr('sindex', x+1)
               .append('<span class="sindex">'+(x+1)+'</span>');
      }
    } else {
      options.removeClass('selected');
      options.filter('#'+selected_option_id).addClass('selected');
    }
  }
  function set_opt_by_boolean(option_group_selector, bool) {
    var yesno = bool ? "yes" : "no";
    $(option_group_selector+" .option").toggleClass('selected', false);
    $(option_group_selector+" .option."+yesno).toggleClass('selected', true);
  }

  set_options = function(options) {
    if (!options) options = previous_options;
    previous_options = options;


    if ('version' in options) {
      var href = window.location.href;
      var matches = href.match(/^http:\/\/www\.getforecastfox\.com\/customize\/([#]{0,1}(.*))$/i);
      if (matches && matches.length >= 2) {
        var page_version = matches[1].replace('/', '');
        var our_version = options['version'];
        if (page_version != our_version) {
          window.location.href += '../' + our_version + '/';
        }
      }
    }


    if("unitsystem" in options)
      set_opt_by_id(".unit_system", options.unitsystem);

    if ("rotate" in options) {
      $('.rotate_locations input[type=checkbox]').attr('checked', options.rotate.enabled);
      $('.rotate_locations input[type=text]').val(options.rotate.interval);
    }

    if ("units" in options) {
      logger.debug('set UNITS: ' + JSON.stringify(options.units));

      $.each(units_categories, function() {
        var name = this;
        if (name != "distance-lng" && name != "distance-shrt") {
          if (name in options.units) {
            set_opt_by_id("#units ." + name, options.units[this]);
          }
        } else {
          if (name == "distance-lng" && "distance" in options.units && "lng" in options.units.distance) {
            set_opt_by_id("#units ." + name, options.units.distance.lng);
          }
          if (name == "distance-shrt" && "distance" in options.units && "shrt" in options.units.distance) {
            set_opt_by_id("#units ." + name, options.units.distance.shrt);
          }
        }
      });
    }

    if ("display" in options) {
      $.each(weather_data_categories, function() {
        if (this in options.display)
          set_opt_by_boolean("#data_booleans ." + this, options.display[this]);
      });
    }

    if ("toolbar" in options) {
      set_opt_by_id(".days", "days" + options.toolbar.days);
      set_opt_by_boolean(".show_cc", options.toolbar.cc);
      set_opt_by_boolean(".show_swa", options.toolbar.swa);
      set_opt_by_id(".show_radar", 'radar-' + options.toolbar.radar);
      $('#radar_custom-url').val(options.toolbar.radar_custom.url);

      if (options.toolbar.radar_custom.width)
        $('#radar_custom-width').val(options.toolbar.radar_custom.width);
      else
        $('#radar_custom-width').val(null);
      if (options.toolbar.radar_custom.height)
        $('#radar_custom-height').val(options.toolbar.radar_custom.height);
      else
        $('#radar_custom-height').val(null);

      if (options.toolbar.radar == "custom")
        $('.show_radar_custom').show();
      else
        $('.show_radar_custom').hide();


      set_opt_by_boolean(".show_hourly", options.toolbar.hourly);
      set_opt_by_boolean(".show_day5", options.toolbar.day5);
      set_opt_by_id(".label_display", "labels" + options.toolbar.display);
      set_opt_by_id(".show_days_or_nights", "daynight-" + options.toolbar.days_or_nights);
      $('.display_location input[type=checkbox]').attr('checked', options.toolbar.location_name);
    }

    if ("theme" in options) {
      set_opt_by_id(".icon_pack", "icons-" + options.theme.icon_pack);
      set_opt_by_boolean(".show_separators", options.theme.separators);
    }

    if ("show_english_locations" in options)
      set_opt_by_boolean(".show_english_locations", options["show_english_locations"]);

    // show or hide the custom unit selector
    if ("unitsystem" in options && options.unitsystem == "custom")
      $(".custom_units").toggleClass('hidden', false);
    else
      $(".custom_units").toggleClass('hidden', true);

    if ('firefoxmigration' in options && options.firefoxmigration) {
      $('#migration-callout').toggleClass('hidden', false);
    } else
      $('#migration-callout').toggleClass('hidden', true);

    options_initialized = true;
  };

  var units_categories = ["temperature", "speed", "time", "pressure", "distance-lng", "distance-shrt"];
  var weather_data_categories = ["humidity", "precipitation", "pressure", "uv", "visibility", "wind", "quality", "moon"];

  var timeout;

  show_saved_message = function() {
    if (timeout)
      clearTimeout(timeout);
    $('#saved-callout').removeClass('hidden');
    timeout = setTimeout(function() {
        $('#saved-callout').addClass('hidden');
    }, 1000);
  };

  var icon_template = '<li class="option ${hidden}" id="icons-${id}">' +
                      '<div class="image ${icon}"/><div>${label}</div></li>';

  function initialize_icons() {
    var list_url = 'http://www.getforecastfox.com/icons/all';
    var container = $('#icon_pack_container');

    function init_html_packs() {
      radio_group(".icon_pack .option");
      if (previous_options && previous_options.theme)
        set_opt_by_id(".icon_pack", "icons-" + previous_options.theme.icon_pack);
    }

    $.get(list_url, function(data) {
      var json = (typeof data == "string") ? JSON.parse(data) : data;
      var last_height = container.height(),
             selected = (previous_options && previous_options.theme) ?
                             previous_options.theme.icon_pack : '',
                  max = (selected == 1) ? 7 : 6;

      // move the selected pack to the front of the list
      for (var x = 0, len = json.length; x < len; x++) {
        if (json[x].id == selected) {
          json = json.splice(x, 1).concat(json);
          break;
        }
      }

      for (var x = 0, len = json.length; x < len; x++) {
        var icon_pack = json[x];
        container.append($.template(icon_template).apply({
          label: icon_pack.name,
          id: icon_pack.id,
          icon: 'ff-pack-preview-' + icon_pack.id,
          hidden: (x < max) ? '' : 'hidden'
        }));
      }

      init_html_packs();
    });

    $('#theme .more').click(function() {
      container.children('.option').removeClass('hidden');
      $(this).hide();
      init_html_packs();
      return false;
    });
  }


  $(function() {
    // gives correct radio-type behavior to every logical radio group: units groups and yes/no questions
    radio_group("#units .unit_system .option");
    $.each(units_categories, function() {
      var units_selector = "#units ."+this+" .option"; // e.g. "#units .humidity .option"
      radio_multi_group(units_selector); // make units option into a group.
    });
    $.each(weather_data_categories, function() {
      var include_selector = "#data_booleans ."+this+" .option"; // e.g. "#data_booleans .humidity .option"
      radio_group(include_selector); // make yes/no include? option into a group
    });
    // lastly, the num# forcast days radio group
    radio_group(".days .option"); // note: .A.B != .A .B -- .A.B means "elements with CSS class A and B"
    radio_group('.label_display .option');

    //$("#options").tabs();
    $(".ui-tabs-nav").removeClass("ui-corner-all"); // see custom_theme_notes.txt for more info

    radio_group('.show_english_locations .option');
    radio_group('.show_cc .option');
    radio_group('.show_swa .option');
    radio_group('.show_radar .option');
    radio_group('.show_hourly .option');
    radio_group('.show_day5 .option');
    radio_group('.show_separators .option');
    radio_group('.show_days_or_nights .option');
    radio_group('.rotate_locations .option');

    // hook up the listeners
    observers.add('ui-get-options-results', function(p) {
      set_options(p);
      initialize_icons();
    });

    observers.add('preference-update', set_options);

    // hookup updating the options
    $('.option:not(.location)').live('click', function() {
      dispatcher.set_options(get_options());
    });

    $('#migration-callout a').click(function() {
      observers.notify('ui-set-options-request', { firefoxmigration: false });
      $('#migration-callout').toggleClass('hidden', true);
      return false;
    });

    $('.rotate_locations input[type=text]').live('change', function() {
      dispatcher.set_options(get_options());
    });

    $('.show_radar_custom input[type=text]').live('change', function() {
      dispatcher.set_options(get_options());
    });

    $('#drag-hint').tooltip({
      delay: 30,
      bodyHandler: function() {
        return $('#drag-hint-tooltip').html();
      },
      extraClass: 'callout border-callout',
      left: -30,
      top: 15
    });
  });
})();
