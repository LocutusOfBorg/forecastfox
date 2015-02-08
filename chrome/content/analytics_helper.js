var _gaq = _gaq || [];
_gaq.push(['_setAccount', 'UA-316228-5']);

function process_events() {
  var messages = $('#ext-to-web span').remove().map(function() {
    return $(this).html();
  });

  for (var x = 0; x < messages.length; x++) {
    _gaq.push(JSON.parse(messages[x]));
  }
}

$(function() {
  $('#ext-to-web').bind('ext-to-web-event', process_events);
});
