
/**
 *  A class that implements the observers interface that can be used from
 *  within our options page
 */
var OptionsObservers = Observers.extend({
  init: function(logging) {
    this._super(logging);
  },

  _send: function(data) {
    // specifies how to SEND
    this._logger.debug('relaying to extension!');
    var msg = JSON.stringify(data);
    var webToExt = document.createEvent('Event');
    webToExt.initEvent('web-to-extension-event', true, false);
    $('#web-to-extension').append('<span>' + msg + '</span>');
    $('#web-to-extension')[0].dispatchEvent(webToExt);
  },

  _installListeners: function() {
    var self = this;
    self._logger.debug('installing listeners');
    $(function() {
      $('#extension-to-web').bind('extension-to-web-event', function() {
        var messages = $('#extension-to-web span').remove().map(function() {
          return $(this).html();
        });

        for (var x = 0; x < messages.length; x++) {
          var msg = messages[x];

          try {
            msg = JSON.parse(msg);
            self._notify(msg.topic, msg.data);
          } catch (e) {
            self._logger.debug('msg failed json parser: ' + e);
          }
        }
      });
    });
  }
});
