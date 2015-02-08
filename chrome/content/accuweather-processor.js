/*******************************************************************************
 * The Weather Data Provider manages getting the data from the feed and
 * converting it to a vendor neutral format. The service is responsible for
 * always providing up-to-date data (as specified by the data source being used).
 * The service returns data that already adheres to the user's location,
 * units preferences and locale.
 ******************************************************************************/

 /**
  * prof -- profile
  * ufdb -- ufdb coordinates
  * city -- city of location
  * state -- state of location
  * dnam -- location display name
  * lat -- latitude
  * lon - longitude
  * tm -- time of last update
  * dls -- daylight savings true/false
  * gmt -- offset
  * barr -- decimal current pressure
  * bard -- description of pressure change
  * tmp -- current temperature
  * flk -- realfeel
  * hmid -- humidiity
  * sunr -- sunrise
  * suns -- sunset
  * t -- forecast summary
  * windgust -- wind gust
  * winds -- wind sepeed
  * windt -- wind direction
  * vis -- visibility
  * precip -- amount of precipitation
  * uvi -- uv index
  * uvt -- uv text description
  * moon -- phase of moon
  * moont -- description of moon phase
  * moond -- date of moon phase
  * moonr -- time of moon rise
  * moons -- time of moonset
  * tree -- tree pollen amount
  * weed -- weed pollen amount
  * grass -- grass pollen amount
  * mold -- mold amount
  * airq -- air quality
  * airt -- air quality type
  *
  */

var AccuWeatherProcessor = Class.extend({

  init: function(logging, i18n, templator, converter) {
    this._logger = logging.getLogger("wdp");
    this._i18n = i18n;
    this._templator = templator;
    this._converter = converter;
    this._logger.debug("initialized");
  },

  process_data: function(data, location) {
    var f = [];
    // TODO(jstritar): This should be based on the data available in the feed.
    for (var x = 0; x <= MAX_FORECASTED_DAYS; x++) {
      f.push({
        "day": this._forecast(x, true, data, location),
        "night": this._forecast(x, false, data, location)
      });
    }



    return {
      "cc" : this._cc(data, location),
      "swa" : this._swa(data, location),
      "radar" : this._radar(data, location),
      //"planets" : this._planets(data),
      //"quality" : this._quality(data),
      "forecast" : f,
      "location" : this._location(data, location)
    };
  },

  /**
   * Retrieves the current conditions
   * @return a CurrentCondition as specified by CC_MOCK_DATA above.
   */
  _cc: function(data, location) {
    var c = this._converter;
    var cc = data.cc.current;
    var obsDate = data.cc.local.date;

    return this._sanitize({
      "date": null, // TODO localized format
      "date_locale": (new Date(obsDate)).toLocaleDateString(),
      "day": this._i18n.data("features.cc.header"),  // TODO
      "short_day": this._i18n.data("features.cc.header"),
      "time": c.time(cc.observationtime),
      "time_raw": cc.observationtime,
      "text": {
        "shrt": c.description(cc.weathertext),
        "lng": c.description(cc.weathertext)
      },
      "icon": Number(cc.weathericon),
      "temperature": c.temperature(cc.temperature),
      "temperature-part": c.temperature(cc.temperature),
      "realfeel": templator.render(this._i18n.data("features.feelslike"),
                                   { "realfeel": c.temperature(cc.realfeel, '/') }),
      "realfeel-part": templator.render(this._i18n.data("features.feelslike"),
                                   { "realfeel": c.temperature(cc.realfeel, '/') }),
      "humidity": c.percent(cc.humidity),
      "wind": {
        "speed": c.wind(cc.windspeed),
        "gusts": c.wind(cc.windgusts),
        "direction": cc.winddirection
      },
      "visibility": c.distance(cc.visibility, true),
      "precipitation": {
        "all": c.distance(cc.precip)
      },
      // TODO "airquality": this._quality(data),
      "uv": {
        "index": cc.uvindex.index,
        "text": cc.uvindex.text
      },
      "pressure": {
        "value": c.pressure(cc.pressure.text),
        "trend": cc.pressure.state.toLowerCase()
      },
      "dewpoint": c.temperature(cc.dewpoint, '/'),
      "cloudcover": c.percent(cc.cloudcover),
      "links": {
        "cc": c.link(null), // TODO
        "quicklook": c.link(cc.url),
        "hourly": c.link(data.forecast.forecast.hbh),
        "day5": c.link(data.forecast.forecast.url5Day),
        "day15": "N/A"//c.link(data.forecast.url15day)
      }
    });
  },

  _radar: function(data, location) {
    var r = data.cc.images;
    var c = this._converter;

    return this._sanitize({
      "images": {
        "local": { "small": "N/A", "large": "N/A" }, // TODO
        "regional": {
          "small": r.radar.replace(/640[xX]480/, '234x175'), "medium": r.radar.replace(/640[xX]480/, '400x300'),
          "large": r.radar }
      },
      "links": {
        "local": { "small": c.link("N/A"), "animated": c.link("N/A") },
        "regional": { "static": "N/A", "animated": c.link(r.radarLink) }
      }
    });
  },

  _swa: function(data, location) {
    var swa = data.cc.watchWarningAdvisory || {};
    var c = this._converter;
    return this._sanitize({
      "isActive": ((swa["numActive"]||"0") == "0" ? false : true),
      "county": swa.county,
      "zone": swa.zone,
      "link": c.link(swa.url),
      "alerts": (function(a) {return (a.constructor != Array) ? [a] : a;})
                  ((swa["events"]||{})["event"]||[]) //TODO
    });
  },

  _quality: function(data, location) { //TODO
    var c = this._converter;
    var ap = data.airandpollen;
    return this._sanitize({
      "tree": ap.tree,
      "weed": ap.weed,
      "grass": ap.grass,
      "mold": ap.mold,
      "air": ap.airquality
    });
  },

  /**
   * Retrieves a Forecast for the specified day.
   * @param day_index the index of the day. 0 == today/tonight, 1 == tomorrow...
   * @param isDay boolean true for day forecast, false for night forecast
   */
  _forecast: function(day_index, isDay, data, location) {
    var c = this._converter;
    var f = data.forecast.forecast;
    var day = f.day[day_index];
    var part = isDay ? day.daytime : day.nighttime;

    var dow = day.dayName, rl_high, rl_low;
    var full_days = { "1" : "sunday", "2": "monday", "3": "tuesday", "4": "wednesday", "5": "thursday", "6": "friday", "7": "saturday" };
    var short_days = { "1" : "sun", "2": "mon", "3": "tue", "4": "wed", "5": "thu", "6": "fri", "7": "sat" };

    if (day_index == 0) {
      dow = this._i18n.data("features.forecast.today");
    } else if (day_index == 1) {
      dow = this._i18n.data("features.forecast.tomorrow");
    } else {
	try {
		var dow_temp = this._i18n.data("days." + full_days[day.dayCode]);
		if (dow_temp && (dow_temp != '')) {
			dow = dow_temp;
		}
	} catch(e) {};
    }

    if (!isDay) {
      if (day_index == 0) {
        dow = this._i18n.data("features.forecast.tonight");
      } else if (day_index == 1 && this._i18n.has_data('features.forecast.tomorrownight')) {
        dow = this._i18n.data('features.forecast.tomorrownight');
      } else {
        dow = templator.render(
            this._i18n.data("features.forecast.night"), {"day": dow});
      }
    }

    // get moon
    var i18n = this._i18n;

    var phasenum = Number(day.nighttime.moonPhaseNum);
    var phase = "N/A";
    var phases = ['new', 'waxing_crescent', 'first_quarter', 'waxing_gibbous', 'full', 'waning_gibbous', 'last_quarter', 'waning_crescent'];

    if (phasenum >= 0 && phasenum <= phases.length)
      phase = i18n.data('data.moon_phases.' + phases[phasenum]);

    return this._sanitize({
      "date": day.obsDate,
      "date_locale": (new Date(day.obsDate)).toLocaleDateString(),
      "day": dow, //TODO
      "dow": day.dayCode,
      "short_day": this._i18n.data("days." + short_days[day.dayCode]),//TODO lookup
      // special code used to figure out what day to show
      "_time": data.cc.current.observationtime,
      "part": (isDay ? "Day" : "Night"),                // part of the day "Day" or "Night"
      "icon": Number(part.weathericon),
      "text": {
        "shrt": c.description(part.shortText),
        "lng": c.description(part.longText)
      },
      "temperature": {
        "high": c.temperature(day.daytime.hightemperature, '/'),
        "low": c.temperature(day.daytime.lowtemperature, '/'),
        "part": c.temperature(isDay ? day.daytime.hightemperature : day.daytime.lowtemperature)
      },
      "realfeel": {
        "high": templator.render(this._i18n.data("features.feelslike"),
            { realfeel: (rl_high = c.temperature(day.daytime.realFeelHigh, '/'))}),
        "low": templator.render(this._i18n.data("features.feelslike"),
            { realfeel: (rl_low = c.temperature(day.daytime.realFeelLow, '/'))}),
        "part": templator.render(this._i18n.data("features.feelslike"),
            { realfeel: isDay ? rl_high : rl_low })
      },
      "precip": {
        "rain": c.distance(part.rain),
        "snow": c.distance(part.snow),
        "liquid": c.distance(part.liq),
        "ice": c.distance(part.ice),
        "potstorm": c.percent(part.thunderstormProb),
        "pop": "N/A"
      },
      "sun": {
        "rise": c.time(day.sunrise),
        "rise_raw": day.sunrise,
        "set": c.time(day.sunset),
        "set_raw": day.sunset
      },
      "moon": {
        "phase": phase, // TODO why isn't this converted in the feed
        "rise": "N/A",
        "set": "N/A"
      },
      "uv": {
        "max": ("maxUV" in part) ? part.maxUV : "0",
        "min": "N/A",
        "text": ("maxUV" in part) ? part.maxUV : "0"// TODO text part.maxuv
      },
      "links": {
        "details": c.link(day.url),
        "historical": c.link("N/A"),
        "astronomy": c.link("N/A"),
        "hourly": (isDay ? day.urlhbhday : day.urlhbhnight)
      },
      "wind": {
        "speed": c.wind(part.windSpeed),
        "gusts": c.wind(part.windGust),  // TODO this doesn't match CC windgust(s)
        "direction": part.windDirectionText
      },
      "location": this._location(data, location)
    });
  },

  _location: function(data, location) {
    var d = (data === undefined) ? this._getData() : data;
    if (!d) return "N/A";
    if (!data) return data.location; //TODO what does this line do?
    var c = this._converter;
    var p = data.cc.local;

    return this._sanitize({
      //"ufdb": p.ufdb,
      "name": location.name,
      "latitude": c.coordinate(p.lat),
      "longitude": c.coordinate(p.lon),
      "local_time": c.time(p.time),
      "city": p.city,
      "adminArea": p.adminArea,
      "country": p.country
    });
  },

  _planets: function(data) {
    //TODO deprecated
    var d = (data === undefined) ? this._getData() : data;
    if (!d) return "N/A";
    if (!data) return data.planets;
    var c = this._converter;
    var p = data.planets;

    // TODO why does the planets.sun.rise differ from cc.sunrise
    return this._sanitize({
      "sun": {
        "rise": c.time(p.sun.rise),
        "set": c.time(p.sun.set)
      },
      "moon": {
        "rise": c.time(p.moon.rise),
        "set": c.time(p.moon.set)
      },
      "mercury": {
        "rise": c.time(p.mercury.rise),
        "set": c.time(p.mercury.set)
      },
      "venus": {
        "rise": c.time(p.venus.rise),
        "set": c.time(p.venus.set)
      },
      "mars": {
        "rise": c.time(p.mars.rise),
        "set": c.time(p.mars.set)
      },
      "jupiter": {
        "rise": c.time(p.jupiter.rise),
        "set": c.time(p.jupiter.set)
      },
      "saturn": {
        "rise": c.time(p.saturn.rise),
        "set": c.time(p.saturn.set)
      },
      "uranus": {
        "rise": c.time(p.uranus.rise),
        "set": c.time(p.uranus.set)
      },
      "neptune": {
        "rise": c.time(p.neptune.rise),
        "set": c.time(p.neptune.set)
      },
      "pluto": {
        "rise": c.time(p.pluto.rise),
        "set": c.time(p.pluto.set)
      }
    });
  },

  _sanitize: function(object) {
    for (var prop in object) {
      if (typeof(object[prop]) == 'object')
        object[prop] = this._sanitize(object[prop]);
      else if (object[prop] === undefined)
        object[prop] = "N/A";
    }
    return object;
  }
});
