var ForecastfoxDropTargetObserver;
(function() {
  var VALID_BARS = ['toolbar', 'statusbar', 'menubar'];
  var gCurrentDragOverItem = null;
  var dropTargetObserver = {

    onDragStart: function(event, transferData, action) {
      transferData.data = new TransferData();
      transferData.data.addDataForFlavour(
          'id/forecastfox-toolbar', 'forecastfox-toolbar');

      toggleDragListeners(true);
    },

    onDragOver: function(event, flavor, session) {
      try {
        var toolbar = event.target;
        var dropTarget = event.target;

        while (toolbar && !isToolbar(toolbar)) {
          dropTarget = toolbar;
          toolbar = toolbar.parentNode;
        }

        var previousDragItem = gCurrentDragOverItem;

        if (!isToolbar(toolbar)) {
          if (gCurrentDragOverItem)
            toggleDragMarkers(gCurrentDragOverItem, false);
          gCurrentDragOverItem = null;
          return;
        };

        if (isToolbar(dropTarget)) {
          gCurrentDragOverItem = dropTarget;
        } else if (!('boxObject' in dropTarget)) {
          gCurrentDragOverItem = null;
        } else {
          gCurrentDragOverItem = null;

          var dropTargetCenter = dropTarget.boxObject.x + (dropTarget.boxObject.width / 2);
          var dragAfter = (event.clientX > dropTargetCenter);

          if (dragAfter) {
            gCurrentDragOverItem = dropTarget.nextSibling;
            while (isHidden(gCurrentDragOverItem))
              gCurrentDragOverItem = gCurrentDragOverItem.nextSibling;
            if (gCurrentDragOverItem == null)
              gCurrentDragOverItem = toolbar;
          } else
            gCurrentDragOverItem = dropTarget;
        }

        //dump('previous: ' + previousDragItem.id + ' current: ' + gCurrentDragOverItem.id + ' \n');
        if (previousDragItem && (gCurrentDragOverItem != previousDragItem)) {
          toggleDragMarkers(previousDragItem, false);
        }

        toggleDragMarkers(gCurrentDragOverItem, true);
        session.canDrop = true;
      } catch (e) { /*dump('Error: ' + e.toString() + '\n');*/ }
    },

    onDragExit: function(event, session) {
      if (gCurrentDragOverItem != null)
        toggleDragMarkers(gCurrentDragOverItem, false);
    },

    onDrop: function(event, dropData, session) {
      toggleDragListeners(false);
      if (gCurrentDragOverItem == null)
        return;

      toggleDragMarkers(gCurrentDragOverItem, false);

      if (dropData.data == gCurrentDragOverItem.getAttribute('id'))
        return;

      var toolbar = event.target;

      while (toolbar && !isToolbar(toolbar))
        toolbar = toolbar.parentNode;

      var toolbarId = toolbar.getAttribute('id');
      var toolbarPosition = getPosition(gCurrentDragOverItem);

      savePosition(toolbarId, toolbarPosition);

      gCurrentDragOverItem = null;
    },

    getSupportedFlavours: function() {
      var flavours = new FlavourSet();
      flavours.appendFlavour('id/forecastfox-toolbar');
      return flavours;
    },

    onDragGestureHandle: function(event) {
      nsDragAndDrop.startDrag(event, dropTargetObserver);
    }
  }

  function savePosition(toolbar, position) {
    var bgp = Forecastfox.services(),
      prefs = bgp.preferences;

    var p = prefs.preference('toolbar');
    p.parent = toolbar;
    p.position = position;
    prefs.preference('toolbar', p);
  }

  function getPosition(node) {
    if (isToolbar(node)) return 'last';
    var parent = node.parentNode;
    var siblings = parent.childNodes;
    var index = -1, offset = 0;
    for (var x = 0; x < siblings.length; x++) {
      if (siblings[x].getAttribute('id') == 'forecastfox-toolbar')
        offset = -1;
      if (siblings[x] == node) {
        index = x;
        break;
      }
    };
    if (index == siblings.length - 1)
      return 'right';
    return index + offset;
  }

  function isHidden(node) {
    if (!node) return false;
    if (node.localName == 'menupopup') return true;
    return node.hasAttribute('collapsed') || node.hasAttribute('hidden');
  }

  function isToolbar(node) {
    if (!node) return false;
    return (node.localName == 'toolbar' || node.localName == 'statusbar' || node.localName == 'menubar');
  }

  function toggleDragListeners(enable) {
    var targetBars = ['navigator-toolbox', 'status-bar'];
    for (var x = 0; x < targetBars.length; x++) {
      var barId = targetBars[x],
            bar = document.getElementById(barId);

      // We need to use capturing events here or we don't get all the events, like
      // when you're dragging over the bookmarks bar.
      var toggleEventListener = 
        enable ? bar.addEventListener : bar.removeEventListener;
      toggleEventListener('dragover', onDragOverHandler, true);
      toggleEventListener('dragexit', onDragExitHandler, true);
      toggleEventListener('dragdrop', onDragDropHandler, true);
      toggleEventListener('drop', onDragDropHandler, true);
    };
  }

  function toggleDragMarkers(node, enable) {
    var value = 'left';
    var target = node;
    if (isToolbar(target)) {
      target = node.lastChild;
      // TODO this while loop could leave stale styles if the thing is no longer
      //      hidden by the time they drag out of that section
      while (isHidden(target))
        target = target.previousSibling;
      value = 'right';
    }

    if (!target) return;

    if (enable) {
      if (!target.hasAttribute('ff-dragover'))
        target.setAttribute('ff-dragover', value);
    } else {
      target.removeAttribute('ff-dragover');
    }
  }

  function onDragOverHandler(event) {
    nsDragAndDrop.dragOver(event, dropTargetObserver);
  }

  function onDragExitHandler(event) {
    nsDragAndDrop.dragExit(event, dropTargetObserver);
  }

  function onDragDropHandler(event) {
    nsDragAndDrop.drop(event, dropTargetObserver);
  }

  ForecastfoxDropTargetObserver = dropTargetObserver;
})();
