// This is our custom localize code based on the jquery.localize plugin.

(function($) {

  /**
   * Method used to localize a page once a package has been loaded into the data.
   * You must make sure that the language and package have been loaded before
   * calling this method.
   *
   * @param   pkg            The package used to localize the page.
   * @param   lang           The language to update the page with.
   */
  $.localize = function(pkg, lang) {
    var $wrappedSet = this;

    function valueForKey(key, data){
      if (key in data && data[key] && data[key] != "")
        return data[key];
      else
        return "";
    }

    var keys, value;
    $wrappedSet.each(function(){
      elem = $(this);
      key = elem.attr("rel").match(/localize\[(.*?)\]/)[1];
      value = valueForKey(key, $.localize.data[lang][pkg]);

      if (value === null || value == "")
        value = valueForKey(key, $.localize.data['en'][pkg]);
      if (value === null) return;

      if (elem.attr("tagName") == "INPUT")
        elem.val(value);
      else
        elem.html(value);
    });
  }

  $.fn.localize = $.localize;

  /**
   * Object that stores localized data once a package has been loaded.
   */
  $.localize.data = {}

  /**
   *  Ensure language code is in the format aa-AA.
   *
   *  @param  lang           The language to ensure.
   */
  $.localize.normalize = function(lang) {
    if (!lang) lang = 'en';
    lang = lang.replace(/_/, "-").toLowerCase();
    if (lang.length > 3) {
      lang = lang.substring(0, 3) + lang.substring(3).toUpperCase();
    }
    return lang;
  }

  /**
   * Default language of the browser.
   */
  $.localize.browser = $.localize.normalize(navigator.language
    ? navigator.language       // Mozilla
    : navigator.userLanguage   // IE
  );

  /**
   * Method used to load a package into the localize storage object.
   *
   * @param   pkg            The package to load.
   * @param   options        [OPTIONAL] options used in loading the package.
   */
  $.localize.load = function(pkg, /*OPTIONAL*/options) {
    options = options || {};
    var intermediate = {};
    var saveSettings = {async: $.ajaxSettings.async, timeout: $.ajaxSettings.timeout};
    $.ajaxSetup({async: true, timeout: (options && options.timeout ? options.timeout : 500)});

    function loadLanguage(pkg, lang, level) {
      level = level || 1;
      var file;
      if (options && options.loadBase && level == 1) {
        intermediate = {};
        file = pkg + ".json";
        json(file, pkg, lang, level);
      }
      else if (level == 1) {
        intermediate = {};
        loadLanguage(pkg, lang, 2);
      }
      else if (level == 2 && lang.length >= 2) {
        file = pkg + "-" + lang.substring(0, 2) + ".json";
        json(file, pkg, lang, level);
      }
      else if (level == 3 && lang.length >= 5) {
        file = pkg + "-" + lang.substring(0, 5) + ".json";
        json(file, pkg, lang, level);
      }
    }

    function callback(pkg, lang, data) {
      if (!(lang in $.localize.data)) $.localize.data[lang] = {};
      $.localize.data[lang][pkg] = data;
      if (options.callback) options.callback(pkg, lang, data);
    }

    function json(file, pkg, lang, level) {
      if (options.pathPrefix) file = options.pathPrefix + "/" + file;
      file = Forecastfox.url(file);
      var req = new XMLHttpRequest();
      req.open("GET", file, false);
      req.overrideMimeType("application/json");
      var d = "{}"
      try {
        req.send(null);
        d = req.responseText;
      } catch (e) {}
      var scratch = $('#scratch_space');
      if (scratch.length > 0) {
        scratch.html(d);
        d = scratch.html();
      }
      d = JSON.parse(d);
      $.extend(intermediate, d);
      callback(pkg, lang, intermediate);
      loadLanguage(pkg, lang, level + 1);
    }

    var lang = $.localize.normalize(options && options.language ? options.language : $.localize.browser);
    if (options.skipLanguage && options.skipLanguage == lang) return;
    loadLanguage(pkg, lang, 1);
    $.ajaxSetup(saveSettings);
  }
})(jQuery);
