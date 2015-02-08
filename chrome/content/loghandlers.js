/*******************************************************************************
 * Browser specific log handlers.  This module currently implements:
 *
 * AlertLogHandler
 * ConsoleLogHandler
 * StorageLogHandler
 *
 * NOTE:  The storage log handler deals with the sqlite directly since
 *        datastore depends on logging.
 *
 * @see /content/logging.js
 * @see /content/sqlite.js
 * @see /content/external/class.js
 * @version 1.0
 ******************************************************************************/
var AlertLogHandler = LogHandler.extend({
  _mediator: null,

  init: function AlertLogHandler_init(level, formatter) {
    this._super(level, formatter);
    this._mediator = Components.classes["@mozilla.org/appshell/window-mediator;1"].
                     getService(Components.interfaces.nsIWindowMediator);
  },

  emit: function AlertLogHandler_emit(record) {
    var win = this._mediator.getMostRecentWindow(null);
    if (!win)
      return;

    win.alert(this.format(record));
  },

  close: function AlertLogHandler_close() {
    this._mediator = null;
  }
});


var ConsoleLogHandler = LogHandler.extend({
  _console: null,

  init: function ConsoleLogHandler_init(level, formatter) {
    this._super(level, formatter);
    this._console = Components.classes["@mozilla.org/consoleservice;1"].
                    getService(Components.interfaces.nsIConsoleService);
  },

  emit: function ConsoleLogHandler_emit(record) {
    if (record.level >= LoggingLevels.ERROR) {
      if (!record.exception)
        this._console.logStringMessage(this.format(record));
      else {
        this._console.logStringMessage(this.format(record, true));
        if (!(record.expection instanceof Components.interfaces.nsIConsoleMessage))
          record.exception = this._createError(record.exception);
        this._console.logMessage(record.exception);
      }
    } else
      this._console.logStringMessage(this.format(record));
  },

  close: function ConsoleLogHandler_close() {
    this._console = null;
  },

  _createError: function ConsoleLogHandler__createError(message){
    var stack = this._findStack();
    var se = Components.classes["@mozilla.org/scripterror;1"].
             createInstance(Components.interfaces.nsIScriptError);

    se.init(message, stack.filename, stack.sourceLine, stack.lineNumber, 0,
            Components.interfaces.nsIScriptError.errorFlag, "javascript");
    return se;
  },

  _findStack: function ConsoleLogHandler_findStack() {
    var rv = {"filename": null, "sourceLine": null, "lineNumber": 0};
    var stack = Components.stack;
    while (stack) {
      if (stack.filename.indexOf("loghandlers.js") != -1) {
        stack = stack.caller;
        continue;
      } else if (stack.filename.indexOf("logging.js") != -1) {
        stack = stack.caller;
        continue;
      } else
        break;
    }

    if (stack) {
      rv.filename = stack.filename;
      rv.sourceLine = stack.sourceLine;
      rv.lineNumber = stack.lineNumber;
    }
    return rv;
  }
});


var StorageLogHandler = LogHandler.extend({
  _key: "logging",
  _storage: null,
  _limit: 500,

  init: function StorageLogHandler_init(level, formatter) {
    this._super(level, formatter);

    var scope = {};
    var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].
                 getService(Components.interfaces.mozIJSSubScriptLoader);
    loader.loadSubScript("chrome://forecastfox/content/sqlite.js", scope);

    this._storage = new scope.SQLite();
  },

  format: function StorageLogHandler_format(record) {
    return {
      "when": record.when.toUTCString(),
      "name": record.name,
      "number": record.level,
      "level": this.formatter.getLevelName(record.level),
      "message": record.message,
      "formatted": this._super(record)
    };
  },

  emit: function StorageLogHandler_emit(record) {
    var results = this._storage.query(
      "get", "SELECT value FROM datastore WHERE key=:key", {"key": this._key});
    var records = null;
    if (results.length > 0)
      records = JSON.parse(results[0].value);
    if (!records)
      records = [];

    records.unshift(this.format(record));
    records = records.slice(0, this._limit);

    var value = JSON.stringify(records);
    if (results.length > 0) {
      this._storage.execute(
        "update",
        "UPDATE datastore SET value=:value WHERE key=:key;",
        {"key": this._key, "value": value});
    } else {
      this._storage.execute(
        "insert",
        "INSERT INTO datastore (key, value) VALUES(:key, :value);",
        {"key": this._key, "value": value});
    }
  },

  close: function StorageLogHandler_close() {
    this._storage = null;
  }
});