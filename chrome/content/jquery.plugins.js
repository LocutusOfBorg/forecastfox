$.fn.disableSelection = function() {
  $(this).attr('unselectable', 'on')
         .css('-moz-user-select', 'none')
         .each(function() {
           this.onselectstart = function() { return false; };
         });
};

// TODO move this
/*String.prototype.format = function() {
  var s = this;
  var i = arguments.length;

  while (i--) {
    s = s.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
  }
  return s;
};*/

