// assume we have a page here

function Forecastfox_Inject_Options_Script (bgp, win) {
  var logging = bgp.logging, observers = bgp.observers;
  var logger = logging.getLogger('options-content-script');
  var $_ = new bgp.Templator(logging, win.document);
  var doc = win.document;
  var obs_service = Components.classes["@mozilla.org/observer-service;1"].
                    getService(Components.interfaces.nsIObserverService);

  ForecastfoxOverlay.toggle_drag_icon(true);
  win.addEventListener('unload', function() {
    logger.debug('window closed. cleaning up content script.');
    ForecastfoxOverlay.toggle_drag_icon(false);
    try {
      obs_service.removeObserver(relayer.outbound, observers._topic());
    } catch (e) { logger.exception(e); }
    logging.removeLogger(logger);
  }, false);

  // enable the page in noScript
  if ("@maone.net/noscript-service;1" in Components.classes) {
    var noScript = Components.classes["@maone.net/noscript-service;1"].
                   getService().wrappedJSObject;
    var browser = getBrowser().getBrowserForDocument(win.document);
    var sites = noScript.getSites(browser).filter(function(site) {
      // don't unblock google analytics... since people might get annoyed at that
      return !this.isJSEnabled(site) && site != 'http://www.google-analytics.com';
    }, noScript);
    if (sites.length > 0) {
      var notificationBox = getBrowser().getNotificationBox();
      var notification = notificationBox.getNotificationWithValue("forecastfox-noscript");
      var message = bgp.i18n.data("notification.message");
      if (notification)
        notification.label = message;
      else {
        var buttons = [{
          label:  bgp.i18n.data("notification.button.label"),
          accessKey:  bgp.i18n.data("notification.button.accesskey"),
          callback: function() {
            sites.forEach(function(site) { this.setJSEnabled(site, true); }, noScript);
            browser.reload();
          }
        }];
        const priority = notificationBox.PRIORITY_CRITICAL_MEDIUM;
        notificationBox.appendNotification(message, "forecastfox-noscript",
                                           bgp.themes.logo("16"),
                                           priority, buttons);
      }
      return;
    }
  }

  // the relayer has the event listeners for the
  //    OUTBOUND (extension ---> web page) and
  //    INBOUND (webpage --> extension)
  //  communication channels.

  var relayer = {
    outbound: {
      observe: function(subject, topic, data) {
        logger.debug('Relaying message to web page');
        try {
          var extToWeb = doc.createEvent('Event');
          extToWeb.initEvent('extension-to-web-event', true, false);

          $_.node('#extension-to-web').append('<span>' + data + '</span>');
          $_.node('#extension-to-web')[0].dispatchEvent(extToWeb);
        } catch (e) {
          logger.exception('relay failed', e);
        }
      },

      /* ::::: nsISupports ::::: */
      QueryInterface: function Observers_QI(iid) {
        if (iid.equals(Components.interfaces.nsISupports) ||
            iid.equals(Components.interfaces.nsISupportsWeakReference) ||
            iid.equals(Components.interfaces.nsIObserver))
          return this;
        throw Components.results.NS_ERROR_NO_INTERFACE;
      }
    },
    inbound: function() {
      var messages = $_.node('#web-to-extension span').remove().map(function() {
        return $_._$(this).html();
      });

      for (var x = 0; x < messages.length; x++) {
        var msg = messages[x];
        logger.debug('relaying msg to extension');

        // make sure its valid JSON
        try {
          msg = bgp.JSON.stringify(bgp.JSON.parse(msg));
          obs_service.notifyObservers(observers, observers._topic(), msg);
        } catch (e) {
          logger.error('attempted to relay invalid message: ' + msg);
        }
      }
    }
  };

  // install the OUTBOUND observer link
  obs_service.addObserver(relayer.outbound, observers._topic(), false);

  // install the INBOUND (webpage ----> extension) channel
  $_.node('#web-to-extension').bind('web-to-extension-event', relayer.inbound);

  // process inbound messages from page that we may have missed
  relayer.inbound();

  function addClass(node, clazz) {
    var classes = node.className.split(' ');
    classes.push(clazz);
    node.className = classes.join(' ');
  }

  function removeClass(node, clazz) {
    var classes = node.className.split(' ');
    classes = classes.filter(function(o) { return o != clazz; });
    node.className = classes.join(' ');
  }

  var flash_timers = []
  var drag_hint_hover = false;

  function ff_flash_drag(count) {
    //dump('ff_flash_drag \n');
    var panel = document.getElementById('forecastfox-drag-target');

    if (!panel) return;
    if (!drag_hint_hover && count >= 7) {
      removeClass(panel, 'highlight');
      return;
    }

    for (var x = 0; x < flash_timers.length; x++) {
      clearTimeout(flash_timers[x])
      flash_timers = [];
    }

    var addRemoveClass = (count % 2 == 1) ?  removeClass : addClass;
    flash_timers.push(setTimeout(function() {
        addRemoveClass(panel, 'highlight');
        ff_flash_drag(drag_hint_hover ? (count+1)%2 : ++count)
      }, 500)
    );
  }

  $_.node('#drag-hint').hover(function() {
    drag_hint_hover = true;
    ff_flash_drag(0);
  }, function() {
    drag_hint_hover = false;
  });

  // redirect the options page if we're on the wrong version
  var prefs = ForecastfoxOverlay.services().preferences,
       href = win.location.href
    matches = href.match(/^http:\/\/www\.getforecastfox\.com\/customize\/([#]{0,1}(.*))$/i);
  if (matches && matches.length >= 2) {
    var page_version = matches[1].replace('/', ''),
         our_version = prefs.preference('version');
    if (page_version != our_version) {
      win.location.href += '../' + our_version + '/';
    }
  }

  logger.debug('initialized');
}
