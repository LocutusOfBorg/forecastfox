(function($){

/*
 * Example usage:
 *   $('.p.day5').ff.attach('toolbar.day5', {type:'by-boolean'});
 *   $('.p.temperature').ff.attach('units.temperature', {type:'by-id'});
 *   $('.p.days').ff.attach('units.days', {type:'by-id'});
 *
 */
$.fn.ff = function(method) {
  // Method calling logic
  if (methods[method])
    return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
  else if (typeof method === 'object' || !method)
    return methods.init.apply(this, arguments);
  else
    $.error('Method ' + method + ' does not exist on jQuery.ff');
}

var methods = {};

// for setting a pref in the extension
var CHANNEL_SET_PREF = 'ui-set-pref';

// for when a pref changes is in the extension
var CHANNEL_ON_PREF_UPDATE = 'ui-on-pref-update';

methods.attach = function(preference, opts) {
  var settings = {
    type: 'radio'
  };

  if (opts)
    $.extend(settings, opts);

  console.log('attaching ' + settings.type + ' to ' + preference);
  // install the classes and click handlers
  var self = $(this);
  var options = $(this).children('.option');
  //$(selector).disableSelection();
  $(options).unbind('click');
  $(options).click(function(e) {
    //try {
    if (settings.type == 'multi') {
      console.log('multi click');
      if (e.ctrlKey || e.metaKey) {
        // user held ctrl and is adding to the selection
        var selection = $(options).filter('.selected').length + 1;
        $(this).addClass('selected').attr('sindex', selection);
      } else {
        // user did not hold ctrl and is selecting a new item
        $(options).removeClass('selected').attr('sindex', '');
        $(this).addClass('selected').attr('sindex', '1');
      }
    } else {
      console.log('radio click');
      $(options).removeClass('selected');
      $(this).addClass('selected');
    }

    observer.notify(CHANNEL_SET_PREF, {
      'name': preference,
      'value': $(self).ff('val')
    });
    //} catch (e) { console.log(e); }
  });

  // listen to observer events to see if its been set
  observer.add(CHANNEL_ON_PREF_UPDATE, function(data) {
    if (preference in data)
      $(self).ff('val', data[preference]);
  });
}

/* gets and sets it by value */
methods.val = function(val) {
  if (val !== undefined) {
    var options = $(this).children('.option').removeClass('selected');

    if (typeof(val) == 'boolean') {
      options.filter(val ? '.yes' : '.no').addClass('selected');

    } else if (typeof(val) == 'string' || typeof(val) == 'number') {
      options.filter('#p-'+val).addClass('selected');

    } else if (val instanceof Array) {
      options.attr('sindex', '').children('.sindex').remove();
      for (var x = 0, len = val.length; x < len; x++)
        options.filter('#'+val[x]).addClass('selected')
               .attr('sindex', x+1)
               .append('<span class="sindex">'+(x+1)+'</span>');

    }
  } else {
    var options = $(this).children('.option');
    if ($(options).filter('.yes').size()) {
      // this is a boolean preference
      return $(options).filter('.selected').hasClass('yes');

    } else {
      // this is a preference by id (and possibly a multipref)
      var selected = $(options).filter('.selected');
      if ($(selected).attr('sindex') !== 'undefined') {
        selected.sort(function(a,b) { return $(a).attr('sindex') - $(b).attr('sindex'); });
        return $.map(selected, function(e) { return $(e).attr('id').slice(2); });
      } else
        return $(selected).attr('id').slice(2);
    }
  }

  return val;
}
})(jQuery);