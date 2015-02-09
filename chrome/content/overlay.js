/*******************************************************************************
 * This is the main object that will interact with the browser's chrome.  The
 * services page we depend on is loaded into an iframe on the hidden window.
 * Any script files we need to depend on directly will be loaded into there on
 * scope using the subscript loader.
 *
 * @version 1.0
 ******************************************************************************/
var ForecastfoxOverlay = {
  __proto__: Forecastfox,
  _initialized: false,
  _logger: null,
  _templator: null,
  _observers: null,
  _customization_active: false,
  _firefox_started_now: true,

  /**
   * browser window load method so we can setup the extension.
   */
  onLoad: function ForecastfoxOverlay_onLoad() {
    // if initialized do not re-enter
    if (this._initialized)
      return;

    // load the background page
    var bgp = this.services();

    // setup a callback for when the background page is ready
    var self = this;

    var callback = function() {
      if (!bgp.initialized)
        return;
      else
        clearInterval(self.bootstrap);

      // setup the logger, observers, and templator
      self._logger = bgp.logging.getLogger("overlay");
      self._templator = new bgp.Templator(bgp.logging, document);
      self._observers = new bgp.Observers(bgp.logging);

      // try to insert a spring in the menubar
      self._insert_spring();

      // call render on ourself and the action
      self.render();

      // listen to feed-ready and preference topics
      self._observers.add('feed-ready', function() { self.render(); });
      self._observers.add('feed-error', function() { self.render_error(); });
      self._observers.add('feed-updating', function(location) {
        self.render_progress(location);
      });

      document.getElementById('forecastfox-popup').addEventListener(
        'popupshowing',
        function () { self.render_context_menu(); },
        false
      );

      // setup the listener for the customization page
      getBrowser().addEventListener(
        'DOMContentLoaded',
        function(e) { self.options_listener(e); },
        false
      );

      // mark that we are initialized
      self._initialized = true;
      self._logger.debug("initialized");
    };

    // listen for the onload event
    this.bootstrap = setInterval(callback, 10);
  },

  options_listener: function(e) {
    var unsafeWin;
    var href;

    if (!(new XPCNativeWrapper(window).mUntrustedObject)) {
      unsafeWin = e.target.defaultView;
      if (unsafeWin.wrappedJSObject) {
        unsafeWin = unsafeWin.wrappedJSObject;
      }

      href = e.target.location.href;
    } else {
      unsafeWin = new XPCNativeWrapper(
                   new XPCNativeWrapper(e, 'target').target,
                   'defaultView').defaultView;
      href = new XPCNativeWrapper(
              new XPCNativeWrapper(unsafeWin, 'location').location,
               'href').href;
    }


    // if they've loaded the customization page, inject the customization window
    if ((/^http:\/\/www\.getforecastfox\.com\/customize\/([#]{0,1}(.*))$/i).test(href) || (/^chrome\:\/\/forecastfox\/content\/options\/options\.html/i).test(href)) {
	this._logger.debug('options_listener matched href: ' + href);
	this.inject_content_script(unsafeWin);
    } else {
		return;
    }
  },

  inject_content_script: function(unsafeWin) {
    var bgp = Forecastfox.services();
    Forecastfox_Inject_Options_Script(bgp, unsafeWin);
    this._observers.notify('ui-content-script-loaded', {});
  },

  /**
   * browser window unload method so we can teardown the extension.
   */
  onUnload: function ForecastfoxOverlay_onUnload() {
    this._logger.debug('window closed. cleaning up overlay script.');
    this._observers.shutdown();
    var bgp = this.services();
    bgp.logging.removeLogger(this._logger);

    this._logger = null;
    this._templator = null;
    this._observers = null;
    this._initialized = false;
  },

  /**
   * Render the forecastfox toolbar.
   */
  render: function ForecastfoxOverlay_render() {
    this._logger.debug('rendering');
    var bgp = this.services(), doc = this._templator._document;
    var toolbar_prefs = bgp.preferences.preference('toolbar');
    var theme_prefs = bgp.preferences.preference('theme');
    var target_toolbar = toolbar_prefs.parent;
    var target_position = toolbar_prefs.position;
    var display = toolbar_prefs.display;
    bgp.positioner.update_position(window, target_toolbar, target_position, this._firefox_started_now);
    this._firefox_started_now = false;

    if (bgp.locations.is_error()) {
      this.render_error();
      return;
    }

    var key, data = bgp.locations.processed_data();
    if (!data) return;
    for (key in bgp.features) bgp.features[key].data(data);

    // clear the toolbar
    var toolbar = doc.getElementById("forecastfox-toolbar");
    while (toolbar.hasChildNodes()) toolbar.removeChild(toolbar.firstChild);

    // check if we need to offset the forecast days:
    var offset = this._calc_forecast_offset(data, toolbar_prefs);

    var display_count = 0;
    // insert each feature
    for (key in bgp.features) {
      var feature = bgp.features[key];
      if (feature.disabled) continue;
      var panel = (feature instanceof bgp.Forecast) ?
                     feature.toolbar(this._templator, 'ffpanel', offset) :
                     feature.toolbar(this._templator, 'ffpanel');

      if (panel) {
        var classes = panel.className;
        classes = classes ? classes.split(' ') : [];
        if ((feature instanceof bgp.CurrentConditions) ||
            (feature instanceof bgp.Forecast)) {
          display_count++;
          classes.push(display_count <= display ? 'text-image' : 'image');
        } else if (feature instanceof bgp.DragTarget)
          continue;


        if (theme_prefs.separators) classes.push('separators');
        panel.className = classes.join(' ');
        toolbar.appendChild(panel);
      }
    }

    this._add_os_attr();

	//----------------------------------------------------------------------------
	if (this._customization_active) {
		var statusbar = doc.getElementById("status-bar");
		var bottombox = doc.getElementById("forecastfox-bottombox");
		var bottombox_is_hidden = true;
		var addonbar = doc.getElementById('addon-bar');
		var is_normal_statusbar = true;
		if (addonbar && addonbar.parentNode.id == 'navigator-toolbox') {
			if (statusbar && (statusbar.parentNode.id == 'addon-bar')) {
				is_normal_statusbar = false;
			}
		}
		//----------------------------------------------------------------------
		if (is_normal_statusbar && (toolbar.parentNode != bottombox)) {
			bottombox_is_hidden = true;
		} else {
			bottombox_is_hidden = false;
		}
		//----------------------------------------------------------------------
		if (bottombox) {
			bottombox.hidden = bottombox_is_hidden;
		}
		//----------------------------------------------------------------------
		this.toggle_drag_icon(true);
	}
	this._rendered_location = bgp.locations.selected();
  },

  render_error: function ForecastfoxOverlay_render_error() {
    this.remove_progress();
    this._logger.debug('rendering error in toolbar');
    var bgp = this.services();
    var errorReporter = bgp.features['error'];
    var panel = errorReporter.toolbar(this._templator, 'ffpanel', true);
    this._replace_node('forecastfox-error', panel);
  },

  remove_progress: function () {
    var node = document.getElementById('forecastfox-progress');
    if (node) node.parentNode.removeChild(node);
  },

  render_progress: function (location) {
    this._logger.debug('rendering progress bar in toolbar');
    var bgp = this.services();
    var progress = bgp.features['progress'];
    var panel = progress.toolbar(this._templator, 'ffpanel', location);

    this._replace_node('forecastfox-progress', panel);
  },

  _replace_node: function(node_id, new_node) {
    var old_node = document.getElementById(node_id);
    var toolbar = document.getElementById('forecastfox-toolbar');
    var next_sibling = toolbar.firstChild;
    if (old_node) {
      next_sibling = old_node.nextSibling;
      old_node.parentNode.removeChild(old_node);
    }

    toolbar.insertBefore(new_node, next_sibling);
  },

  render_tooltip: function ForecastfoxOverlay_render_tooltip() {
    var feature = document.tooltipNode.feature, bgp = this.services();
    var tooltip = document.getElementById('forecastfox-tooltip-' + feature._id),
            bgp = this.services(),
           data = feature.data(),
            now = new Date();

    var toolbar_prefs = bgp.preferences.preference('toolbar');

    var outer = FF_TEMPLATES.tooltip,
        layout = FF_TEMPLATES.details_double_layout,
        table = this._templator.render(FF_TEMPLATES.details_table, {
      'image': bgp.themes.largeImage(data.icon)
    });

    data = {};
    var details;

    if (feature instanceof bgp.Forecast) {
      //dump("INITIAL TEMPLATE: " + table + "\n");
      var day_feature, night_feature;
      if (feature._id.match('day')) {
        day_feature = feature;
        night_feature = bgp.features[feature._id.replace('day', 'night')];
      } else {
        day_feature = bgp.features[feature._id.replace('night', 'day')];
        night_feature = feature;
      }

      details = day_feature.details(this._templator, FF_TEMPLATES.details_row);
      data['top-panel'] = day_feature.general(this._templator, table);
      data['top-panel'] =
        this._templator.render(data['top-panel'], { 'details': details, 'links': '', 'right': '' });

      details = night_feature.details(this._templator, FF_TEMPLATES.details_row);
      data['bottom-panel'] = night_feature.general(this._templator, table);
      data['bottom-panel'] =
        this._templator.render(data['bottom-panel'], { 'details': details, 'links': '', 'right': '' });

      if (toolbar_prefs.days_or_nights == 'days-nights') {
        layout = FF_TEMPLATES.details_single_layout;
        if (feature._part == 'day') {
          data['panel'] = data['top-panel'];
          data['class'] = 'ff-content-top';
        } else if (feature._part == 'night') {
          data['panel'] = data['bottom-panel'];
          data['class'] = 'ff-content-bottom';
        }
      }

    } else if (feature instanceof bgp.CurrentConditions) {
      details = feature.details(this._templator, FF_TEMPLATES.details_row);
      layout = FF_TEMPLATES.details_single_layout;
      data['panel'] = feature.general(this._templator, table);
      data['panel'] =
        this._templator.render(data['panel'], { 'details': details });
      data['class'] = feature.is_night() ? 'ff-content-bottom' : 'ff-content-top';
    } else if (feature instanceof bgp.Radar) {
      layout = FF_TEMPLATES.details_single_layout;
      data['panel'] = feature.general(this._templator, FF_TEMPLATES.radar);
      data['class'] = '';
    } else if (feature instanceof bgp.SWA) {
      layout = FF_TEMPLATES.details_single_layout;
      data['panel'] = feature.general(this._templator, FF_TEMPLATES.text);
      data['class'] = 'ff-content-top';
    }

    layout = this._templator.render(layout, data);
    layout = this._templator.render(outer, {
      'header': this._rendered_location.name,
      'details': layout
    });

//    dump("THE table: "+ layout + "\n");
    tooltip = document.getAnonymousNodes(tooltip)[0];

    while (tooltip.hasChildNodes()) tooltip.removeChild(tooltip.firstChild);

    var ue = Components.classes["@mozilla.org/feed-unescapehtml;1"].
    getService(Components.interfaces.nsIScriptableUnescapeHTML);
    var frag = ue.parseFragment(layout, false, null, tooltip);
    if (bgp.i18n.rtl()) {
      this._logger.debug('setting tooltip direction to rtl');
      if (tooltip.className)
        tooltip.className += ' ff-rtl';
      else
        tooltip.className = 'ff-rtl';
    } else {
      if (tooltip.className) {
        tooltip.className = tooltip.className.split('ff-rtl').join('').split(
            ' ').join('');
        this._logger.debug('returning tooltip to ltr');
      }
    }
    this._logger.debug('tooltip className: ' + tooltip.className);

    tooltip.appendChild(frag);
  },

  clean_tooltip: function() {
    this._logger.debug('cleaning tooltip');
    var tooltip = document.getElementById('forecastfox-tooltip');
    while (tooltip.hasChildNodes()) tooltip.removeChild(tooltip.firstChild);
  },

  render_context_menu: function() {
    var menus = document.getElementById('forecastfox-popup').childNodes,
        bgp = this.services(), i18n = bgp.i18n, locations = bgp.locations;
    for (var x = 0; x < menus.length; x++) {
      var menu = menus[x];
      if (menu.hasAttribute('localize'))
        menu.setAttribute('label', i18n.data(menu.getAttribute('localize')));
    }
  },

  render_location_selector: function() {
    var bgp = this.services(),
        locations = bgp.locations,
        recent_list = locations.saved(),
        menu = document.getElementById('forecastfox-locations-popup'),
        current = locations.selected(),
        self = this;

    var newloc = document.getElementById('forecastfox-new-location');
    newloc.setAttribute('label', bgp.i18n.data(newloc.getAttribute('localize')));

    while (menu.hasChildNodes() && menu.lastChild.tagName != 'menuseparator')
      menu.removeChild(menu.lastChild);

    for (var x = 0; x < recent_list.length; x++) {
      var node = document.createElement('menuitem');
      node.location = recent_list[x];
      node.setAttribute('label', recent_list[x].name);
      node.setAttribute('type', 'radio');
      node.addEventListener('command', function() {
        self._logger.debug('selected location: ' + this.location.name);
        locations.selected(this.location);
      }, false);
      if (recent_list[x].code == current.code)
        node.setAttribute('checked', 'true');
      menu.appendChild(node);
    }
  },

  toggle_drag_icon: function(enable) {
    var         bgp = this.services(),
               node = null,
            toolbar = document.getElementById('forecastfox-toolbar'),
            feature = bgp.features['drag-target'],
        theme_prefs = bgp.preferences.preference('theme');


    this._customization_active = enable;

    if (enable) {
      node = feature.toolbar(this._templator, 'ffpanel');
      var classes = node.className;
      classes = classes ? classes.split(' ') : [];
      if (theme_prefs.separators) classes.push('separators');
      node.className = classes.join(' ');
      node.addEventListener('draggesture',
          ForecastfoxDropTargetObserver.onDragGestureHandle,
          false);
      toolbar.insertBefore(node, toolbar.firstChild);
    } else {
      node = document.getElementById('forecastfox-drag-target');
      node.removeEventListener('draggesture',
          ForecastfoxDropTargetObserver.onDragGestureHandle,
          false);
      node.parentNode.removeChild(node);
    }
  },

  _calc_forecast_offset: function(data, toolbar_prefs) {
    var obsdate = new Date(data.forecast[0].day.date),
            now = new Date(obsdate.toDateString() + ' ' + data.cc.time_raw),
          today = new Date(now.toDateString()),
           hour = now.getHours();

    var date_offset =  (obsdate < today) ? 2 : 0;
    var partial_day_offset = (hour >= (12 + 3)) ? 1 : 0;

    return date_offset + partial_day_offset;
  },

  _add_os_attr: function() {
    var runtime = Components.classes['@mozilla.org/xre/app-info;1']
                              .getService(Components.interfaces.nsIXULRuntime);

    document.getElementById('forecastfox-toolbar').setAttribute('OS', runtime.OS);
  },

  _insert_spring: function() {
    var prefs = this.services().preferences;

    if (prefs.preference('spring_inserted')) return;
    prefs.preference('spring_inserted', true);

    var  toolbar = document.getElementById('toolbar-menubar'),
         toolbox = toolbar.parentNode,
      toolboxDoc = toolbox.ownerDocument,
        setItems = toolbar.currentSet.split(',');

    setItems.push('forecastfox-menubar-spring');

    var newSet = setItems.join(',');
    toolbar.currentSet = newSet;
    toolbar.setAttribute('currentset', newSet);
    toolboxDoc.persist(toolbar.id, 'currentset');

    try {
      BrowserToolboxCustomizeDone(true);
    } catch (e) { this._logger.exception('inserting spring', e); }
  }
};

