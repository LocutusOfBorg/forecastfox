/*******************************************************************************
 * The converter service is used to take in different weather measurements
 * and conver them from one unit of measure to another.
 *
 * TODO use JQuery number formatting extension for i18n:
 *
 * @see http://plugins.jquery.com/project/numberformatter
 * @see /content/logging.js
 * @see /content/observers.js
 * @see /content/preferences.js
 * @see /content/external/class.js
 * @see /content/external/jquery-1.3.2.js
 * @version 1.0
 ******************************************************************************/
const SYSTEM_AMERICAN = {
  "temperature": ["f"],
  "speed": ["mph"],
  "time": ["h12"],
  "pressure": ["inhg"],
  "distance": { "shrt": ["inches"], "lng": ["mi"] }
};

const SYSTEM_METRIC = {
  "temperature": ["c"],
  "speed": ["kph"],
  "time": ["h12"],
  "pressure": ["mmhg"],
  "distance": { "shrt": ["cm"], "lng": ["km"] }
};
/*******************************************************************************
 * The CONVERTERS methods are based on individual unit values.
 ******************************************************************************/
// TODO separate out into (a) converter and (b) styler
const CONVERTERS = {
  "temperature": {
    _count: 4,
    /* f default */
    "c": function(value, i18n, templator) { return templator.render(i18n.data("converters.temperature.c"), {temperature: Math.round((Number(value)-32)*(5/9))}); },
    "f": function(value, i18n, templator) { return templator.render(i18n.data("converters.temperature.f"), {temperature: Math.round(Number(value))}); },
    "r": function(value, i18n, templator) { return templator.render(i18n.data("converters.temperature.r"), {temperature: Math.round(Number(value) + 459.67)}); },
    "k": function(value, i18n, templator) { return templator.render(i18n.data("converters.temperature.k"), {temperature: Math.round((Number(value)-32)*(5/9) + 273.15)}); }
  },

  "speed": {
    _count: 4,
    /* mph default */
    "mph": function(value, i18n, templator) { return templator.render(i18n.data("converters.speed.mph"), {speed: Math.round(Number(value)) }); },
    "kph": function(value, i18n, templator) { return templator.render(i18n.data("converters.speed.kph"), {speed: Math.round(Number(value) * 1.609) }); },
    "ms": function(value, i18n, templator) { return templator.render(i18n.data("converters.speed.ms"), {speed: Math.round(Number(value) * 0.447) }); },
    "bft": function(value, i18n, templator) { return templator.render(i18n.data("converters.speed.bft"), {speed: Math.round(Math.pow(value * 0.5348, 2/3)) }) },
    "knots": function(value, i18n, templator) { return templator.render(i18n.data("converters.speed.knots"), {speed: Math.round(Number(value) * 0.868976242) }); }
  },

  "time": {
    _count: 2,
    /* h12 default */
    "h12": function(value, i18n, templator) {
      var nums = value.split(":");
      var h = Number(nums[0]);
      var m = nums[1];
      if (m.length == 1) m = '0' + m;
      var p = (h < 12 || h == 24) ? "am" : "pm"; // TODO i18n
      if (h > 12) h -= 12;
      if (h == 0) h = 12;
      if (isNaN(h)) return "--:--";
      // this needs moved somewhere where do not depend on the templator and i18n variables being available
      return templator.render(i18n.data("converters.time.h12."+p), {hours: h, minutes: m});
    },
    "h24": function(value, i18n, templator) {
      var nums = value.split(":");
      var h = Number(nums[0]);
      if (h < 10) h = '0' + (''+h);
      var m = nums[1];
      if (m.length == 1) m = '0' + m;
      return templator.render(i18n.data("converters.time.h24"), {hours: h, minutes: m});
    }
  },

  "pressure": {
    _count: 5,
    /* in hg default */
    "inhg": function(value, i18n, templator) { return templator.render(i18n.data("converters.pressure.inhg"), {pressure: Number(value).toFixed(2)}); },
    "psi": function (value, i18n, templator) { return templator.render(i18n.data("converters.pressure.psi"), {pressure: (Number(value) * 0.491098).toFixed(2)}); },
    "mb": function (value, i18n, templator) { return templator.render(i18n.data("converters.pressure.mb"), {pressure: Math.round(Number(value) * 33.86)}); },
    "hpa": function (value, i18n, templator) { return templator.render(i18n.data("converters.pressure.hpa"), {pressure: Math.round(Number(value) * 33.86)}); },
    "mmhg": function (value, i18n, templator) { return templator.render(i18n.data("converters.pressure.mmhg"), {pressure: Math.round(Number(value) * 25.39709)}); }
  },

  "distance": {
    /* mi default */
    "lng": {
      _count: 3,
      "mi": function (value, i18n, templator) { return templator.render(i18n.data("converters.distance.lng.mi"), {distance: Math.round(Number(value))}); },
      "km": function (value, i18n, templator) { return templator.render(i18n.data("converters.distance.lng.km"), {distance: Math.round(Number(value) * 1.6093)}); },
      "m": function (value, i18n, templator) { return templator.render(i18n.data("converters.distance.lng.m"), {distance: Math.round(Number(value) * 1609.344)}); },
      "nm": function (value, i18n, templator) { return templator.render(i18n.data("converters.distance.lng.nm"), {distance: Math.round(Number(value) * 0.868976242)}); }
    },

    /* in default */
    "shrt": {
      _count: 3,
      "inches": function (value, i18n, templator) { return templator.render(i18n.data("converters.distance.shrt.inches"), {distance: Number(value).toFixed(2)}); },
      "cm": function (value, i18n, templator) { return templator.render(i18n.data("converters.distance.shrt.cm"), {distance: (Number(value) * 2.54).toFixed(2)}); },
      "mm": function (value, i18n, templator) { return templator.render(i18n.data("converters.distance.shrt.mm"), {distance: (Number(value) * 25.4).toFixed(2)}); }
    }
  },

  "percent": function(value, i18n, templator) {
    value = $.trim(new String(value));
    if (value[value.length-1] == "%") value = value.substring(value,value.length-1);
    return templator.render(i18n.data("converters.percent"), {percent: Math.round(Number(value))});
  },

  "coordinate": function(value, i18n, templator) { return templator.render(i18n.data("converters.coordinate"), {coordinate: Number(value).toFixed(2)}); }
};

/*******************************************************************************
 * Object used to convert units based on the user's preferences.  The methods
 * are in terms of weather domain objects, like wind and precipitation.
 ******************************************************************************/
var Converter = Class.extend({
  _systemkey: "unitsystem",
  _key: "units",
  _logger: null,
  _preferences: null,
  _i18n: null,
  _templator: null,

  /**
   * Initialize the converter service.
   *
   * @param   logging        The logging service
   * @param   preference     The preference service
   * @param   i18n           The i18n service
   * @param   templator      The templator service
   * @param   units          [OPTIONAL] units to set
   */
  init: function Converter_init(logging, preferences, i18n, templator, /*OPTIONAL*/ units) {
    this._logger = logging.getLogger("converter");
    this._preferences = preferences;
    this._i18n = i18n;
    this._templator = templator;

    // initialize the units if passed in
    if (units)
      this.units(units);

    this._logger.debug("initialized");
  },

  /**
   * Set or get the units in the service.  This will update the preference.
   * Each unit is in an array. If multiple units are  specified, then both
   * units are displayed at once. For example,
   *     temperature: ["f", "c"]
   *   will display the temperature 40 as:
   *     40 &deg;F / 4 &deg; C
   *
   * @param   units          [OPTIONAL] A JSON object representing units.
   * @returns                The current units or null if no units set.
   */
  units: function Converter_units(units) {

    // get the current units
    var system = this._preferences.preference(this._systemkey);
    var current = null;
    switch (system) {

    case "american":
      current = SYSTEM_AMERICAN;
      break;

    case "metric":
      current = SYSTEM_METRIC;
      break;

    case "custom":
    default:
      current = this._preferences.preference(this._key);
      break;
    }

    // if the units are valid then set them
    if (units && this._validate(units)) {

      // set the preference
      this._logger.debug("saving new unit preferences " + JSON.stringify(units));
      this._preferences.preference(this._key, units);
      current = units;
    }

    // return the units
    return current;
  },

  /**
   * Converts the temperature to a string that matches the user's preferences.
   *
   * @param   value          a number representing the temperature in fahrenheit
   * @returns                the temperature as a string based on the user's preference
   */
  temperature: function Converter_temperature(value, join) {
    return this._convert("temperature", value, join);
  },

  /**
   * Converts the wind to a string that matches the user's preferences.
   *
   * @param   value          a number representing the wind in mph
   * @returns                the wind speed as a string based on the user's preference
   */
  wind: function Converter_wind(value) {
    return this._convert("speed", value, ' / ');
  },

  /**
   * Converts the distance to a string that matches the user's preferences.
   *
   * @param   value          a number representing the distance in mi
   * @param   isLong         If the distance is long or short
   * @returns                the distance as a string based on the user's preference
   */
  distance: function Converter_distance(value, isLong) {
    return this._convert("distance", value, ' / ', isLong ? "lng" : "shrt");
  },

  /**
   * Converts the pressure to a string that matches the user's preferences.
   *
   * @param   value          a number representing the pressure in inhg
   * @returns                the pressure as a string based on the user's preference
   */
  pressure: function Converter_pressure(value) {
    return this._convert("pressure", value, ' / ');
  },

  /**
   * Converts the time to a string that matches the user's preferences.
   *
   * @param   value          a number representing the time in 24h
   * @returns                the time as a string based on the user's preference
   */
  time: function Converter_time(value) {
    return this._convert("time", value, ' / ');
  },

  /**
   * Converts the percent to a string that matches the user's preferences.
   *
   * @param   value          a number representing percent
   * @returns                the percent as a string based on the user's preference
   */
  percent: function Converter_percent(value) {
    return CONVERTERS.percent(value, this._i18n, this._templator);
  },

  /**
   * Converts the coordinate to a string that matches the user's preferences.
   *
   * @param   value          a number representing a coordinate
   * @returns                the coordinate as a string based on the user's preference
   */
  coordinate: function Converter_coordinate(value) {
    return CONVERTERS.coordinate(value, this._i18n, this._templator);
  },

  /**
   * Converts a link.
   *
   * @param   value          The link value
   * @returns                The link value base on the user's preference
   */
  link: function Converter_link(value) {
    // TODO This may be a good spot to track things here.
    return value;
  },

  description: function Converter_description(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  },

  /**
   * Validate the units passed in.  This will validate each key in the units.
   *
   * @param   units          The units key/value pairs.
   * @return                 True if valid, otherwise false.
   */
  _validate: function Converter__validate(units) {

    // validate each units array independently and return true if nothing fails
    try {
      this._validate_array(units, ["temperature"]);
      this._validate_array(units, ["speed"]);
      this._validate_array(units, ["time"]);
      this._validate_array(units, ["pressure"]);
      this._validate_array(units, ["distance", "lng"]);
      this._validate_array(units, ["distance", "shrt"]);
    } catch (e) {
      this._logger.exception("units failed validation " + JSON.stringify(units), e);
      return false;
    }

    // make sure other units aren't in the units
    for (var key in units) {
      if (!(key in CONVERTERS)) {
        this._logger.error("units failed validation.  unit type not valid " + key + " " + JSON.stringify(units));
        return false;
      }
    }

    // units are valid
    return true;
  },

  /**
   * Validate a unit array.
   *
   * @param   units          The units key/value pairs.
   * @param   path           An array of paths to the unit array to validate.
   * @throws  An error if any of the arrays fail.
   */
  _validate_array: function Converter__validate_array(units, path) {

    // loop through the path array and get the converter for the path
    var cv = CONVERTERS;
    var attr, x;
    for (x=0; x<path.length; x++) {

      // get the converter attribute
      attr = path[x];
      cv = cv[attr];

      // throw if the path is not in units
      if (!(attr in units)) {
        this._logger.error("units failed validation, " + attr + " not present");
        throw "missing units " + attr;
      }
      units = units[attr];
    }

    // check that the units path is an array
    if (!$.isArray(units)) {
      this._logger.error("units " + attr + " not an array");
      throw "invalid unit format, " + attr + " not an array";
    }

    // check that the units path is not greather than the converter count
    if (units.length > cv._count) {
      this._logger.error("unit preference has more units than we support " + JSON.stringify(units));
      throw "too many units";
    }

    // check that at least one unit is specified
    if (units.length == 0) {
      throw "no unit specified for " + path.toString();
    }

    // check if any unit is not in the converter
    for (x=0; x<units.length; x++) {
      if (!(units[x] in cv)) {
        this._logger.error("invalid unit for " + path.toString() + " " + units[x]);
        throw "invalid unit " + path.toString() + " " + units[x];
      }
    }
  },

  /**
   * Convert a value into the users preference.  If the units are invalid then
   * we return the unchanged value.
   *
   * @param   type           Type of unit to convert.
   * @param   value          The value to convert.
   * @param   subtype        [OPTIONAL] a subtype for conversion.
   */
  _convert: function Converter__convert(type, value, join, /*OPTIONAL*/ subtype) {
    var units = this.units();

    // get the type of value for conversion then get the converter
    units = subtype ? units[type][subtype] : units[type];
    var converter = (subtype) ? CONVERTERS[type][subtype] : CONVERTERS[type];

    // convert all the units
    var self = this;
    var values = $.map(units, function (pref) { return converter[pref](value, self._i18n, self._templator); });
    return (join) ? values.join(join) : values;
  }
});