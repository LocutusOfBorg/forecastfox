$.fn.disableSelection = function() {
  $(this).attr('unselectable', 'on')
         .css('-moz-user-select', 'none')
         .each(function() {
           this.onselectstart = function() { return false; };
         });
};
