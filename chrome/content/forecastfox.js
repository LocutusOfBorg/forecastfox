var Forecastfox = {
  environment: 'firefox',
  _iframes: {},

  services: function Forecastfox_services() {
    if ("services" in this._iframes)
      return this._iframes["services"];

    // get the window to load the iframe in
    var win = Components.classes["@mozilla.org/appshell/appShellService;1"].
              getService(Components.interfaces.nsIAppShellService).
              hiddenDOMWindow;

    // if the iframe was previously loaded store it and callback
    var iframe = win.document.getElementById("forecastfox-services");
    if (!iframe) {

      // create the iframe
      iframe = win.document.createElement("iframe");
      iframe.setAttribute("id", "forecastfox-services");
      iframe.setAttribute("collapsed", "true");

      // load the source
      iframe.setAttribute("src", "chrome://forecastfox/content/services.html");
      win.document.documentElement.appendChild(iframe);
    }

    this._iframes["services"] = iframe.contentWindow;
    return this._iframes["services"];
  },

  url: function Forecastfox_url(path) {
    return "chrome://forecastfox/" + path;
  },

  customize: function Forecastfox_customize(/* OPTIONAL */ anchor) {
//    var version = this.services()['PREFERENCES_DEFAULTS'].version;
//    this.open('http://www.getforecastfox.com/customize/' + version + '/' + (anchor ? anchor : ''));
	this.open('chrome://forecastfox/content/options/options.html');
  },

  open: function Forecastfox_open(url, category, action, type) {
    var mediator = Components.classes["@mozilla.org/appshell/window-mediator;1"].
                      getService(Components.interfaces.nsIWindowMediator);
    var browserEnumerator = mediator.getEnumerator("navigator:browser");

    // Check each browser instance for our URL
    var found = false;
    while (!found && browserEnumerator.hasMoreElements()) {
      var browserWin = browserEnumerator.getNext();
      var tabbrowser = browserWin.gBrowser;

      // Check each tab of this browser instance
      var numTabs = tabbrowser.browsers.length;
      for (var index = 0; index < numTabs; index++) {
        var currentBrowser = tabbrowser.getBrowserAtIndex(index);
        if (url == currentBrowser.currentURI.spec) {

          // The URL is already opened. Select this tab.
          tabbrowser.selectedTab = tabbrowser.tabContainer.childNodes[index];

          // Focus *this* browser-window
          browserWin.focus();

          found = true;
          break;
        }
      }
    }

    if (!found) {
      var win = this._getTopWindow();
      var browser = win.getBrowser();
      browser.loadOneTab(url, null, null, null, false);
      win.focus();
    }
  },
  api: function() {
    return this.services().forecastfox_api();
  },

  contextMenu: function(item) {
    var bgp = this.services();

    if (item == 'community') {
      this.open('http://www.getforecastfox.com/contribute/', 'ContextMenu', 'Click', 'Community');
    } else if (item == 'homepage') {
      this.open('http://www.getforecastfox.com/', 'ContextMenu', 'Click', 'HomePage');
    } else if (item == 'accuweather') {
      this.open('http://www.accuweather.com/?partner=forecastfox', 'ContextMenu', 'Click', 'AccuWeather');
    } else if (item == 'share') {
      this.open('http://staging.getforecastfox.com/share/', 'ContextMenu', 'Click', 'Share');
    } else if (item == 'customize') {
      this.customize();
    } else if (item == 'troubleshooting') {
      this.open('chrome://forecastfox/content/troubleshooting.html', 'ContextMenu', 'Click', 'TroubleShooting');
    } else if (item == 'reload') {
      bgp.locations.update_feed(bgp.locations.selected(), true);
    } else if (item == 'newLocation') {
      this.customize('#location');
    }
  },

  _getTopWindow: function() {
    var mediator = Components.classes["@mozilla.org/appshell/window-mediator;1"].
                      getService(Components.interfaces.nsIWindowMediator);
    var win = mediator.getMostRecentWindow("navigator:browser");
    if (!win) {
      var chrome = "chrome://browser/content/browser.xul";
      var flags = "chrome=yes,all=yes,dialog=no";
      var args = Components.classes["@mozilla.org/supports-string;1"].
        createInstance(Components.interfaces.nsISupportsString);
      var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].
      getService(Components.interfaces.nsIWindowWatcher);
      win = ww.openWindow(null, chrome, "_blank", flags, args);
      win.setTimeout(function() { win.focus(); }, 0);
    }
    return win;
  },
};