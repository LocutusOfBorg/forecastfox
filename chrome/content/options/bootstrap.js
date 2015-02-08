
var logging = { getLogger: function(l) { return logger; } };
var logger = {
  setLevel: function(level) {},
  isEnabledFor: function(level) {},
  debug: function(msg) { this.log(msg); },
  info: function(msg) {this.log(msg); },
  warn: function(msg) {this.log(msg); },
  error: function(msg) { this.log(msg); },
  critical: function(msg) {this.log(msg); },
  exception: function(msg, e) {
    this.log(msg);


    this.log(e);

  },
  log: function(level, msg, e) {
    if (('console' in window) && (console.log))
      console.log(((new Date()).getTime())/1000 + level);
    },
  addHandler: function(handler) {},
  removeHandler: function(handler) {}
};

var observers = new OptionsObservers(logging);
var templator = new Templator(logging, document);
var datastore = new DataStore(logging);
var i18n = new OptionsI18n();


var radio_group = function (selector) {
  // makes it impossible to select text.
  $(selector).disableSelection();
  $(selector).unbind('click');
  $(selector).click(function() {
    $(selector).removeClass('selected');
    $(this).addClass('selected');
  });
};

var radio_multi_group = function (selector) {
  $(selector).disableSelection();
  $(selector).unbind('click').addClass('multi').click(function(e) {
    if (e.ctrlKey || e.metaKey) {
      // user held ctrl and is adding to the selection
      var selection = $(selector).filter('.selected').length + 1;
      $(this).addClass('selected');
      $(this).attr('sindex', selection);
    } else {
      // user did not hold ctrl and is selecting a new item
      $(selector).removeClass('selected');
      $(selector).attr('sindex', '');
      $(this).addClass('selected');
      $(this).attr('sindex', '1');
    }
  });
}

/*
function install_nav() {
  $('#sub-navigation li').click(function() {
    $('#sub-navigation li').removeClass('selected');
    $(this).addClass('selected');
    $('#center > .option_group').addClass('hidden');
    $('#' + $(this).attr('tid')).removeClass('hidden');
  });
}*/
var isMac;
$(function() {
  $('#location').corner("keep 8px");

  observers.add('ui-content-script-loaded', function() {
    observers.notify('ui-get-locale-request', {});
    observers.notify('ui-get-options-request', {});
    observers.notify('ui-get-locations-request', {});
  });

  observers.add('ui-restore-defaults-results', function() {
    window.location.reload();
  });

  if (Forecastfox.environment == 'chrome')
    observers.notify('ui-content-script-loaded');

  observers.notify('ui-set-options-request', { showoptions: false });

  $(window).unload(function() {
    // do not show the migration message again....
    observers.notify('ui-set-options-request', { firefoxmigration: false });
  });
  setTimeout(function() { if (typeof _loadUserVoice != 'undefined') _loadUserVoice(); }, 30);
  isMac = ($.client.os == 'Mac');
  $('.pc').toggleClass('hidden', isMac);
  $('.mac').toggleClass('hidden', !isMac);
});

function reset_all_settings() {
  if (confirm(i18n.data("options.restore.confirm"))) {
    observers.notify('ui-restore-defaults-request', {});
  }
}

$(window).unload(function() {
  observers.notify('ui-options-close', { });
});