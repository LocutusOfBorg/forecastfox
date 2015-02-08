var OptionsI18n = I18n.extend({
  init: function () {
    var self = this;
    this._super(logging, observers, null);
    observers.add('ui-get-locale-results', function(msg) {
      try {
        logger.debug('ui-get-locale-results received. updating UI');
        $.localize.data = msg.data;
        self._cache = msg.selected;
        self._supported = msg.supported;
        self._update_ui();
        set_options();
      } catch (x) {
        logger.error(x);
      }
    });
    $(function() { self._init_locale_selector(); });
  },

  locale: function (code) {
    if (code) dispatcher.set_locale(code);
    return this._cache;
  },

  supported: function () { return this._supported; },
  _ensure_locale_exists: function() {},
  _load: function(code) {},

  _init_locale_selector: function() {
    var selector = $('#locale_selector select');
    var i18n = this;
    logger.debug('initializing the locale selector');
    selector.change(function() {
      logger.debug('new locale selected');
      var locale = $('#locale_selector select option:selected').val();
      i18n.locale(locale);
    });
  },

  /** this method is specific to the option page. we can refractor it out of the
   * class in the future if we need... was just easier to put it here for now.
   */
  _update_ui: function() {
    this.localize(templator);
    this._update_locale_selector();
    if ('init_previous_locations' in window) init_previous_locations();

    $('#copyright').html(templator.render(this.data('copyright'), {
      accuweather: templator.render(FF_TEMPLATES.link, { type: 'accuweather',
          href: 'http://www.accuweather.com/?partner=forecastfox',
          label: 'AccuWeather.com®'
        })
    }));

    if ($('#new_location_bar').hasClass('defaults')) {
      $('#new_location_bar').attr('value', this.data('options.search.instructions'));
    }

    $('#language-callout span').html(
      templator.render(this.data('options.notranslate'), {
        'feedback-forums': templator.render(FF_TEMPLATES.link, { type: 'feedback',
          href: 'http://forecastfox.uservoice.com',
          label: this.data('options.feedback')
      })
    }));

    $('#language-callout')
      .toggleClass('hidden', ('accucode' in this.supported()[this.locale()]));

    $('#migration-callout-content').html(
      templator.render(this.data('options.firefoxmigration'), {
        'feedback-forums': templator.render(FF_TEMPLATES.link, { type: 'feedback',
          href: 'http://forecastfox.uservoice.com',
          label: this.data('options.feedback')
        }),
        'br': '<br/>'
    }));

    $('#top-instructions').html(
      templator.render(this.data('options.instructions.top'), { 'br':'<br />' })
    );

    $('#englishnames').toggleClass('hidden', (this.locale() == 'en'));

    var width = $('.location_form button').outerWidth();
    $('.location_form button').css('margin-left', - width - 10);

    $('#toolbar-position-label').html(
      templator.render(this.data('options.positions.instructions'), {
        'icon': '<img src="' + drag_icon + '" class="drag-target"></img>'
      })
    );

    $('#drag-hint-tooltip-text').html(
      templator.render(this.data('options.positions.dragtip'), {
        'screenshot':
           "<div style='text-align: center; margin: 5px 0;'><img src='"
             + drag_hint_img + "'/></div>"
      })
     );

    $('.rotate_locations label').html(
      templator.render(this.data('options.locations.rotate'), {
        'number': '<input type="text" value=5 size=2 onclick="return false"/>'
      })
    );

    $('#multiselect-callout').html(
      templator.render(this.data('options.units.multiselect'), {
        'key': '<span class="pc">ctrl</span><span class="mac">⌘</span>'
      })
    );

    $('.pc').toggleClass('hidden', isMac);
    $('.mac').toggleClass('hidden', !isMac);

    $('body').toggleClass('ff-rtl', (this.rtl()));
  },

  _update_locale_selector: function() {
    logger.debug('updating locale selector');
    var locales = this.supported();
    var selector = $('#locale_selector select');
    selector.children('option').remove();

    $.each(locales, function(code, locale) {
      selector.append('<option value="' + code + '">' + locale.name + '</option>');
    });

    $('#locale_selector option[value='+this.locale()+']').attr('selected', 'selected');
  }
//  localize: function (templator) { },

//  data: function (key) { },
//  all_data: function() { }

});
