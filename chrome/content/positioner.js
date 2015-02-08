var STATUS_BAR = 'status-bar';
var Positioner = Class.extend({

  init: function Positioner_init(logging, prefs) {
    this._logger = logging.getLogger('positioner');
    this._prefs = prefs;
    this._displayed_addonbar = false;
  },

  is_valid_position: function Positioner_is_valid_position(win, toolbar, position) {
    var target = win.document.getElementById(toolbar);

    return (target != null);
  },

  update_all_positions: function Positioner_updatePositions() {
    var mediator = Components.classes["@mozilla.org/appshell/window-mediator;1"].
          getService(Components.interfaces.nsIWindowMediator);

    var windows = mediator.getEnumerator('navigator:browser');
    var p = this._prefs.preference('toolbar');
    var toolbar = p.parent;
    var position = p.position;

    while (windows.hasMoreElements()) {
      this.update_position(windows.getNext(), toolbar, position);
    }
  },

  update_position: function Position_window(win, toolbar, position) {
    var doc = win.document, p;
    var addonbar = doc.getElementById('addon-bar');
    if (toolbar == 'DEFAULT') {
      toolbar = STATUS_BAR;
      if (addonbar && addonbar.collapsed) {
        addonbar.collapsed = false;
        doc.persist(addonbar.id, 'collapsed');
        this._displayed_addonbar = true;
      }
      p = this._prefs.preference('toolbar');
      p.parent = toolbar;
      this._prefs.preference('toolbar', p);
    }

    if (!this.is_valid_position(win, toolbar, position)) {
      p = this._prefs.preference('toolbar');
      p.parent = toolbar = PREFERENCES_DEFAULTS['toolbar']['parent'];
      p.position = position = PREFERENCES_DEFAULTS['toolbar']['position'];
      this._prefs.preference('toolbar', p);
    }

    var ffbar = doc.getElementById('forecastfox-toolbar');
    var target = doc.getElementById(toolbar);
	if (! target) {
		toolbar = STATUS_BAR;
		target = doc.getElementById(toolbar);
	}

    ffbar.parentNode.removeChild(ffbar);

    var newbar;

    if (toolbar == STATUS_BAR) {
      if (ffbar.localName != 'statusbarpanel')
        newbar = doc.createElement('statusbarpanel');
    } else {
      if (ffbar.localName == 'statusbarpanel')
        newbar = doc.createElement('hbox');
    }

    if (newbar) {
      newbar.setAttribute('id', ffbar.getAttribute('id'));
      while (ffbar.hasChildNodes())
        newbar.appendChild(ffbar.firstChild);
    } else
      newbar = ffbar;
    newbar.setAttribute('context', 'forecastfox-popup');

    var children = target.childNodes,
          placed = false;
    for (var x = 0; x < children.length; x++) {
      if (x == position) {
        target.insertBefore(newbar, children[x]);
        placed = true;
      }
    }

    if (position == 'last' || !placed) {
      target.appendChild(newbar);
    }

    var parent = target;
    while (parent) {
      if (parent == addonbar && addonbar.collapsed) {
        // 1. start with addon bar ALREADY hidden.
        // 2. close addonbar
        // 3. we'll reopen without restarting
        if (this._displayed_addonbar)
          break;
        addonbar.collapsed = false;
        doc.persist(addonbar.id, 'collapsed');
        this._logger.debug("displaying the addonbar");
        // only force it once per restart...
        this._displayed_addonbar = true;
        break;
      }
      parent = parent.parentNode;
    }

	//----------------------------------------------------------------------------
	var statusbar = doc.getElementById("status-bar");
	var bottombox = doc.getElementById("forecastfox-bottombox");
	if (bottombox) {
		var is_normal_statusbar = true;
		if (addonbar && addonbar.parentNode.id == 'navigator-toolbox') {
			if (statusbar && (statusbar.parentNode.id == 'addon-bar')) {
				is_normal_statusbar = false;
			}
		}
		if (is_normal_statusbar) {
			if ((! newbar.parentNode) || (newbar.parentNode && (newbar.parentNode == bottombox))) {
				statusbar.appendChild(newbar);
			}
			bottombox.hidden = true;
		} else if (newbar.parentNode && newbar.parentNode == statusbar) {
			bottombox.appendChild(newbar);
			bottombox.hidden = false;
		} else if (newbar.parentNode && newbar.parentNode == bottombox) {
			bottombox.hidden = false;
		} else {
			bottombox.hidden = true;
		}
	}

  }
});
