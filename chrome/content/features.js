/*******************************************************************************
 * Objects used by the front-end to take the backing data and render a feature.
 * A feature controls the display of a specific block of backing data.
 *  Each feature to display should subclass the feature object.
 *
 *
 * @see /content/logging.js
 * @see /content/preferences.js
 * @see /content/observers.js
 * @see /content/templator.js
 * @see /content/weather-data-provider.js
 * @see /content/external/class.js
 * @see /content/external/jquery-1.3.2.js
 * @version 1.0
 ******************************************************************************/
const XUL_NS_URI = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

var Feature = Class.extend({
  _id: null,  // subclass this as needed
  _logger: null,
  _preferences: null,
  _i18n: null,
  _themes: null,
  disabled: false,

  /**
   * Initialize the feature.
   *
   * @param   logging        The logging service.
   * @param   preferences    The preferences service.
   * @param   i18n           The i18n service.
   * @param   wdb            The weather data provider service.
   * @param   themes         The themes service.
   */
  init: function Feature_init(logging, preferences, i18n, themes) {
    this._logger = logging.getLogger(this._id);
    this._preferences = preferences;
    this._i18n = i18n;
    this._themes = themes;
    this._logger.debug(this._id + " initialized");
  },

  /**
   * Get the preferences for the current feature.
   */
  preferences: function Feature_preferences() {
    return this._preferences.preferences();
  },

  /**
   * Get the backing data needed for the feature.  This method should be
   * subclassed and the subclass should call whatever method on
   * the weather data provider it needs to retrieve the data.
   */
  data: function Feature_data() {
    return {};
  },

  /**
   * Render the message layout.  If this isn't subclassed then we just return an
   * empty string.
   *
   * @param   templator      The templator to use.
   * @param   template       The template to render.
   * @return                 The rendered html.
   */
  message: function Feature_message(templator, template) {
    this._logger.debug("rendering " + this._id + " message");
    return "";
  },

  /**
   * Render the menu layout.  If this isn't subclassed then we just return an
   * empty string.
   *
   * @param   templator      The templator to use.
   * @param   template       The template to render.
   * @return                 The rendered html.
   */
  menu: function Feature_menu(templator, template) {
    this._logger.debug("rendering " + this._id + " menu");
    return "";
  },

  /**
   * Render the details layout.  If this isn't subclassed then we just return an
   * empty string.
   *
   * @param   templator      The templator to use.
   * @param   template       The template to render.
   * @return                 The rendered html.
   */
  details: function Feature_details(template) {
    this._logger.debug("rendering " + this._id + " details");
    return "";
  },

  /**
   * Render the toolbar layout.  If this isn't subclassed then we just return an
   * empty string.
   *
   * @param   templator      The templator to use.
   * @param   template       The template to render.
   * @return                 The rendered html.
   */
  toolbar: function Feature_toolbar(template) {
    this._logger.debug("rendering " + this._id + " toolbar");
    return;
  },

  _create_panel: function(templator, template, data) {
    this._logger.debug('Creating panel for ' + this._id);
    var panel = templator._document.createElement(template);
    if ('image' in data)
      panel.setAttribute('image', data.image);
    if ('defaultimage' in data)
      panel.setAttribute('imageerr', 'this.onerror = null; this.src = "' + data.defaultimage + '"');
    if ('label' in data)
      panel.setAttribute('label', data.label);
    if ('link' in data)
      panel.setAttribute('link', data.link.replace('&amp;', '&'));
    panel.setAttribute('id', data.id);
    panel.feature = this;
    if ('tooltiptext' in data)
      panel.setAttribute('tooltiptext', data.tooltiptext);
    else
      panel.setAttribute('tooltip', 'forecastfox-tooltip-' + this._id);
    if ('display' in data)
      panel.className = data.display;
    if ('part' in data)
      panel.setAttribute('part', data.part);
    return panel;
  }
});


/**
 * The current conditions feature.
 */
var CurrentConditions = Feature.extend({
  _id: "cc",

  data: function CurrentConditions_data(data) {
    if (data) {
      var d = data.cc;
      d.radar = data.radar;
      d.sunrise_raw = data.forecast[0].day.sun.rise_raw;
      d.sunset_raw = data.forecast[0].day.sun.set_raw;
      d.location = data.location;
      this._data = d;
    }

    return JSON.parse(JSON.stringify(this._data));
  },

  is_night: function CurrentConditions_is_night() {
    var data = this.data(),
      to_num = function (a) { return a[0] + a[1] / 60; },
         now = to_num($.map(data.time_raw.split(':'), Number)),
        rise = to_num($.map(data.sunrise_raw.split(':'), Number)),
         set = to_num($.map(data.sunset_raw.split(':'), Number));

    this._logger.debug('now: ' + now + ' set: ' + set + ' rise: ' + rise);
    return (now < rise || now > set);
  },

  general: function CurrentConditions_general(templator, template) {
    this._logger.debug("rendering " + this._id + " general");
    var data = this.data();
    data['temperature-class'] = '';

    if (data['temperature-part'].length == 2) {
      data['temperature-class'] += ' ff-two';
    } else if (data['temperature-part'].length == 3) {
      data['temperature-class'] += ' ff-three';
    }

    data['temperature-part'] = data['temperature-part'].join('/');

    data.id = this._id;
    data.forecast = 'ff-hidden';
    data.cc = '';
    //TODO get rid of this if statement
    
    data.links = data.time;
    
    data.right = 'ff-day-header';
    data.small_image = this._themes.smallImage(data.icon);
    data.small_image_default = this._themes.smallImage(data.icon, true);
    data.large_image = this._themes.largeImage(data.icon);
    data.large_image_default = this._themes.largeImage(data.icon, true);
    return templator.render(template, data);
  },

  details: function CurrentConditions_details(templator, template) {
    this._logger.debug("rendering " + this._id + " details");

    var html = "", prefs = this.preferences(), backing = this.data(),
      trends = {'steady': '&mdash;', 'decreasing': '&darr;', 'rising': '&uarr;'};

    if (backing.pressure.trend in trends)
      backing.pressure.trend = trends[backing.pressure.trend];

    var parts = [['features.winds', '${wind-direction} ${wind-speed}', 'wind'],
                 ['features.humidity', '${humidity}', 'humidity'],
                 ['features.pressure', '${pressure-value} (<b>${pressure-trend}</b>)', 'pressure'],
                 ['features.uvindex', '${uv-text} (${uv-index})', 'uv'],

                 ['features.precipitation', '${precipitation-all}', 'precipitation'],

                 ['features.visibility', '${visibility}', 'visibility']/*,
                 ['features.airquality', '${airquality-air}', 'quality']*/];

    for (var x = 0; x < parts.length; x++) {
      // check if the user has specified that they'd like to see this
      if (!prefs.display[parts[x][2]]) continue;

      var data = {
        label: this._i18n.data(parts[x][0]),
        value: templator.render(parts[x][1], backing)
      };

      html += templator.render(template, data);
    }
    return html;
  },

  toolbar: function CurrentConditions_toolbar(templator, template) {
    this._logger.debug("rendering " + this._id + " toolbar");
    var backing = this.data();
    var prefs = this.preferences();
    if (!prefs.toolbar.cc || !backing) return "";

    backing.temperature = backing.temperature.join('/');

    if (prefs.toolbar.location_name) backing.short_day = backing.location.name;

    // render it and return
    var data = {
      "id": "forecastfox-" + this._id,
      "image": this._themes.smallImage(backing.icon),
      "defaultimage": this._themes.smallImage(backing.icon, true),
      "link": backing.links.quicklook,
      "label": templator.render(this._i18n.data("features.cc.toolbar"), backing)
    };

    return this._create_panel(templator, template, data);
  }
});

/**
 * The forecast feature.
 */
var Forecast = Feature.extend({
  _day: null,
  _part: null,
  _data: null,
  TIME_DAY: 15,

  init: function Forecast_init(day, part, logging, preferences, i18n, themes) {
    this._id = ["forecast",day,part].join("-");
    this._super(logging, preferences, i18n, themes);
    this._day = day;
    this._part = part;
    this._validate();
  },

  data: function Forecast_data(data) {
    if (data) {
      if (!(this._day in data.forecast)) {
        this.disabled = true;
        return {};
      }
      this.disabled = false;
      this._data = data.forecast[this._day][this._part];
      if (!this._data.enable)
        this._data.enable = {};
      if (this._data.links.hourly == "N/A")
        this._data.enable.hourly = "ff-hidden";
    }

    return JSON.parse(JSON.stringify(this._data));
  },

  general: function Forecast_general(templator, template, shouldHide) {
    this._logger.debug("rendering " + this._id + " general");
    var data = this.data();

    // not enabled so return empty
    if ((this._part == "night") && shouldHide)
      return "";

    data['temperature-class'] = (this._part == 'day') ? 'ff-high' : 'ff-low';

    if (data.temperature.part.length == 2) {
      data['temperature-class'] += ' ff-two';
    } else if (data.temperature.part.length == 3) {
      data['temperature-class'] += ' ff-three';
    }

    data.temperature.part = data.temperature.part.join('/');

    data.id = this._id;
    data.forecast = '';
    data.cc = 'ff-hidden';
    data.small_image = this._themes.smallImage(data.icon);
    data.small_image_default = this._themes.smallImage(data.icon, true);
    data.large_image = this._themes.largeImage(data.icon);
    data.large_image_default = this._themes.largeImage(data.icon, true);
    return templator.render(template, data);
  },

  details: function Forecast_details(templator, template) {
    this._logger.debug("rendering " + this._id + " details");
    var parts = {
       day:
        [['features.maxuv', '${uv-max-text} (${uv-max-index})', 'uv'],
         ['features.winds', '${wind-direction} ${wind-speed}', 'wind'],
         ['features.precipitation', '${precip-liquid}', 'precipitation'],
         ['features.sunrise', '${sun-rise}']],
       night:
        [['features.winds', '${wind-direction} ${wind-speed}', 'wind'],
         ['features.precipitation', '${precip-liquid}', 'precipitation'],
         ['features.sunset', '${sun-set}'],
         ['features.moon', '${moon-phase}', 'moon']]

    };

    var html = "", p = parts[this._part], prefs = this.preferences();
    var backing = this.data();

    for (var x = 0; x < p.length; x++) {
      // check if the user has specified that they'd like to see this
      if (p[x].length > 2 && !prefs.display[p[x][2]]) continue;

      var data = {
        label: this._i18n.data(p[x][0]),
        value: templator.render(p[x][1], backing)
      };

      html += templator.render(template, data);
    }
    return html;
  },

  toolbar: function Forecast_toolbar(templator, template, offset) {
    this._logger.debug("rendering " + this._id + " toolbar");
    var      backing = this.data(),
               prefs = this.preferences(),
      days_or_nights = prefs.toolbar.days_or_nights,
                 dow = Number(backing['dow']) - 1;

    if (!backing) return "";

    var index = (this._day) * 2 + ((this._part == 'night') ? 1 : 0);
    var end = prefs.toolbar.days * 2 + offset;
    //this._logger.debug('BEFORE: index: ' + index + ' end ' + end + ' offset: ' + offset);
    if (index < offset) return '';
    if (index >= end) return '';
    if (!days_or_nights.match(this._part)) return '';

    backing.temperature.part = backing.temperature.part.join('/');
    //this._logger.debug('AFTER: index: ' + index + ' end ' + end + ' offset: ' + offset);
    // render it and return
    var data = {
      "id": this._id,
      "image": this._themes.smallImage(backing.icon),
      "defaultimage": this._themes.smallImage(backing.icon, true),
      "link": backing.links.details,
      "label": templator.render(this._i18n.data("features.forecast.toolbar"), backing),
      "part": this._part
    };

    if (days_or_nights == 'days-nights' && this._part == 'night')
      data.label = backing.temperature.part;

    return this._create_panel(templator, template, data);
  },

  _validate: function Forecast__validate() {
    if (this._part != "day" && this._part != "night")
      this._logger.error("INVALID FORECAST. Valid part: day, night, Current: " + this._part);
  }

});

/**
 * The swa feature.
 */
var SWA = Feature.extend({
  _id: "swa",
  _data: null,

  data: function SWA_data(data) {
    if (data) {
      this._data = data.swa;
      this._data.location = data.location;
    }
    return this._data;
  },

  toolbar: function SWA_toolbar(templator, template) {
    var backing = this.data();
    var prefs = this.preferences();

    if (!prefs.toolbar.swa || !backing || !backing.isActive) return "";

    var data = {
      id: 'forecastfox-' + this._id,
      image: this._themes.smallImage('swa', true),
      display: 'image',
      link: backing.link
    };

    return this._create_panel(templator, template, data);
  },

  general: function SWA_general(templator, template) {
    var data = this.data();
    data.id = this._id;
    data['class'] = 'ff-swa';
    var html = '';
    for (var x = 0; x < data.alerts.length; x++) {
      data.text = data.alerts[x].text;
      html += templator.render(template, data);
    };
    return html;
  },

  details: function SWA_general(templator, template) { return template; },

  message: function SWA_message(templator, template) {
    this._logger.debug("rendering " + this._id + " message");
    var backing = this.data();
    var messages = [];
		for (var x = 0; x < backing.alerts.length; x++) {
  		var swa = backing.alerts[x];
      messages.push(swa.text);
		}
    if (!backing.isActive)
      return "";

    // render it and return
    var data = {
      "class": 'ff-swa',
      "link": backing.link,
      "text": templator.render(
				 this._i18n.data('features.swa'), {message: messages.join(',')}),
      "type": 'swa'
    };
    return templator.render(template, data);
  }
});

var Radar = Feature.extend({
  _id: 'radar',
  _data: null,

  data: function Radar_data(data) {
    if (data) this._data = data.cc;
    return this._data;
  },

  toolbar: function Radar_toolbar(templator, template) {
    var backing = this.data();
    var prefs = this.preferences();
    var radar = prefs.toolbar.radar;

    if (radar == 'none' || !backing) return "";

    var data = {
      id: 'forecastfox-' + this._id,
      image: this._themes.smallImage('radar', true),
      link: backing.radar.links.regional.animated,
      display: 'image'
    };

    return this._create_panel(templator, template, data);
  },

  general: function Radar_general(templator, template) {
    var data = this.data();
    var toolbar = this.preferences().toolbar;
    var radar = toolbar.radar;
    data.id = this._id;
    if (['small', 'medium', 'large'].some(
          function(o) { return o == radar; })) {
      data.size = 'ff-' + radar;
      data.src = data.radar.images.regional[radar];
      data.link = data.radar.links.regional.animated;
      data.style = "";
    } else if (radar == "custom") {
      var w = toolbar.radar_custom.width;
      var h = toolbar.radar_custom.height;
      data.size = '';
      data.src = toolbar.radar_custom.url;
      data.link = data.radar.links.regional.animated;
      if (w != 0 && h != 0)
        data.style = 'width="' + w + 'px" height="' + h + 'px"';
      else
        data.style = '';
    }
    return templator.render(template, data);
  },

  details: function Radar_general(templator, template) { return template; }
});

var Day5Link = Feature.extend({
  _id: 'day5',
  data: function Day5Link_data(data) {
    if (data) this._data = data.cc;
    return this._data;
  },
  toolbar: function Day5Link_toolbar(templator, template) {
    var backing = this.data();
    var prefs = this.preferences();

    if (!prefs.toolbar.day5 || !backing) return "";

    var data = {
      id: 'forecastfox-' + this._id,
      image: this._themes.smallImage('5day', true),
      link: backing.links.day5,
      tooltiptext: this._i18n.data('features.day5click'),
      display: 'image'
    };

    return this._create_panel(templator, template, data);
  }
});

var HourlyLink = Feature.extend({
  _id: 'hourly',
  data: function HourlyLink_data(data) {
    if (data) this._data = data.cc;
    return this._data;
  },
  toolbar: function HourlyLink_toolbar(templator, template) {
    var backing = this.data();
    var prefs = this.preferences();

    if (!prefs.toolbar.hourly || !backing) return "";

    var data = {
      id: 'forecastfox-' + this._id,
      image: this._themes.smallImage('hourly', true),
      link: backing.links.hourly,
      tooltiptext: this._i18n.data('features.hourlyclick'),
      display: 'image'
    };

    return this._create_panel(templator, template, data);
  }
});

var ErrorReporter = Feature.extend({
  _id: 'error',

  toolbar: function ErrorReporter_toolbar(templator, template, error_active) {
    if (!error_active) return "";

    var data = {
      id: 'forecastfox-' + this._id,
      label: this._i18n.data('features.errors.connection'),
      display: 'text-image',
      image: 'chrome://global/skin/icons/error-16.png',
      tooltiptext: this._i18n.data('features.errors.connection_tooltip')
    };

    return this._create_panel(templator, template, data);
  }
});

var ProgressIndicator = Feature.extend({
  _id: 'progress',

  toolbar: function (templator, template, location) {
    if (!location) return "";
    var data = {
      id: 'forecastfox-' + this._id,
      display: 'image',
      image: 'chrome://global/skin/icons/loading_16.png',
      tooltiptext: templator.render(this._i18n.data('features.progress'), {
        'location-name': location.name
      })
    };

    return this._create_panel(templator, template, data);
  }
});

var DragTarget = Feature.extend({
  _id: 'drag-target',

  toolbar: function (templator, template) {
    var data = {
      id: 'forecastfox-' + this._id,
      display: 'image',
      image: 'chrome://forecastfox/skin/images/drag.png',
      tooltiptext: templator.render(this._i18n.data('features.dragdrop.tooltip'))
    };

    return this._create_panel(templator, template, data);
  }
});
