/*******************************************************************************
 * Available logging levels.
 *
 * @version 1.0
 ******************************************************************************/
const LoggingLevels = {
  NOTSET: 0,
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
  CRITICAL: 50
};


/*******************************************************************************
 * Object used to perform logging in the application.  This is loosely based
 * on log4j and the python logging module.  Handlers are defined in browser
 * specific files so they need to be added in whatever script you want to
 * perform logging in.
 *
 * @see /content/external/jquery-1.3.2.js
 * @see /content/external/class.js
 * @version 1.0
 ******************************************************************************/
var Logging = Class.extend({
  loggers: null,
  configs: null,
  level: LoggingLevels.NOTSET,

  /**
   * Initialize the logging service and setup the root logger.  Optionally
   * setup a base configuration for new loggers.
   *
   * @param   level          [OPTIONAL] Level for new loggers.
   * @param   configs        [OPTIONAL] Either a single object or an array of
   *                         objects containing handler data for new loggers.
   *                         The object can contain "level", "format",
   *                         "formatter", and "handler" values.  These are all
   *                         optional values.  "formatter" and "handler" are
   *                         classes of LogFormatter and LogHandler.
   */
  init: function Logging_init(/*OPTIONAL*/ level, /*OPTIONAL*/ configs){
    this.loggers = {};
    this.configure(level, configs);
    this._logger = this.getLogger("root");
    this._logger.debug("initialized");
  },

  /**
   * Set the base configuration for new loggers.
   *
   * @param   level          [OPTIONAL] Level for new loggers.
   * @param   configs        [OPTIONAL] Either a single object or an array of
   *                         objects containing handler data for new loggers.
   *                         The object can contain "level", "format",
   *                         "formatter", and "handler" values.  These are all
   *                         optional values.
   */
  configure: function Logging_configure(/*OPTIONAL*/level, /*OPTIONAL*/configs) {

    // set the default level
    if (typeof(level) == "number")
      this.level = level;

    // no other config values passed in
    if (!configs)
      return;

    // configs is an array
    if ($.isArray(configs))
      this.configs = configs;

    // otherwise it's a single object
    else
      this.configs = [configs];
  },

  /**
   * Get the logger for a given name.
   *
   * @param   name           Name of the logger to return.
   */
  getLogger: function Logging_getLogger(name) {

    // we already have a logger
    if (!(name in this.loggers)) this.loggers[name] = [];

    // create a new logger
    var logger = new Logger(name);

    // set the logging level
    logger.setLevel(this.level);

    // no config specified do the default
    var handlers = [];
    if (!this.configs || this.configs.length == 0) {
      var handler = new LogHandler();
      var formatter = new LogFormatter();
      handler.setFormatter(formatter);
      handlers.push(handler);
    } else {

      // loop through and configure
      this.configs.forEach(function(config) {
        var handler, formatter, level;

        // create the formatter
        if ("formatter" in config)
          formatter = new config.formatter;
        else
          formatter = new LogFormatter();

        // set the format on the on the formatter
        if ("format" in config)
          formatter.setFormat(config.format);

        // set the level on the handler
        if ("level" in config)
          level = config["level"];
        else
          level = LoggingLevels.NOTSET;

        // create a handler
        if ("handler" in config)
          handler = new config.handler(level, formatter);
        else
          handler = new LogHandler(level, formatter);

        // add the handler to the array
        handlers.push(handler);
      });
    }

    // replace the internal handler array for the logger with the requested
    logger.handlers = handlers;

    // store it and return
    this.loggers[name].push(logger);
    return logger;
  },

  /**
   * Shutdown and remove the logger from the logging service.
   *
   * @param   logger         The logger to remove
   */
  removeLogger: function Logging_removeLogger(logger) {
    if (!logger || !(logger.name in this.loggers)) return;
    this.loggers[logger.name] = this.loggers[logger.name].filter(function(l) {
      if (l == logger) {
        logger.handlers.forEach(function(handler) {
          handler.flush();
          handler.close();
        });
        return false;
      }
      return true;
    });
  },

  /**
   * Logs a message with level DEBUG on the root logger.
   *
   * @param   message        Message to log.
   */
  debug: function Logging_debug(message) {
    this.log(LoggingLevels.DEBUG, message);
  },

  /**
   * Logs a message with level INFO on the root logger.
   *
   * @param   message        Message to log.
   */
  info: function Logging_info(message) {
    this.log(LoggingLevels.INFO, message);
  },

  /**
   * Logs a message with level WARN on the root logger.
   *
   * @param   message        Message to log.
   */
  warn: function Logging_warn(message) {
    this.log(LoggingLevels.WARN, message);
  },

  /**
   * Logs a message with level ERROR on the root logger.
   *
   * @param   message        Message to log.
   */
  error: function Logging_error(message) {
    this.log(LoggingLevels.ERROR, message);
  },

  /**
   * Logs a message with level CRITICAL on the root logger.
   *
   * @param   message        Message to log.
   */
  critical: function Logging_critical(message) {
    this.log(LoggingLevels.CRITICAL, message);
  },

  /**
   * Logs a message with level ERROR on the root logger it includes the error
   * information.
   *
   * @param   message        Message to log.
   * @param   e              error to log.
   */
  exception: function Logging_exception(message, e) {
    this.log(LoggingLevels.ERROR, message, e);
  },

  /**
   * Logs a message with integer level on the root.
   *
   * @param   level          Level of the message to log.
   * @param   message        Message to log.
   * @param   exception      [OPTIONAL] exception to log.
   */
  log: function Logger_log(level, message, /*OPTIONAL*/ exception) {
    this._logger.log(level, message, exception);
  },

  /**
   * Informs the logging system to perform an orderly shutdown by flushing
   * and closing all handlers. This should be called at application exit and
   * no further use of the logging system should be made after this call.
   */
  shutdown: function Logging_shutdown() {
    this._logger.debug("logging has shut down");
    for (var name in this.loggers) {
      var loggerList = this.loggers[name]
      for (var x = 0; x < loggerList.length; x++) {
        loggerList[x].handlers.forEach(function(handler) {
          handler.flush();
          handler.close();
        });
      }
    }
    this.configs = null;
    this._logger = null;
    this.loggers = {};
  }
});


/*******************************************************************************
 * Loggers have the following attributes and methods. Note that Loggers are
 * never instantiated directly, but always through the module-level
 * function logging.getLogger(name).
 *
 * @see /content/external/jquery-1.3.2.js
 * @see /content/external/class.js
 * @version 1.0
 ******************************************************************************/
var Logger = Class.extend({
  name: "",
  level: LoggingLevels.NOTSET,
  handlers: null,

  /**
   * Initialize the logger with the level it is responsible for outputting.
   * The default level is NOTSET.  Which means all records will be outputted.
   *
   * @param   name           Name of the logger.
   * @param   level          [OPTIONAL] The level the logger is responsible for.
   *                         Any LogRecords whose level that is below the
   *                         loggers level will be ignored.
   */
  init: function Logger_init(name, /*OPTIONAL*/level) {
    this.handlers = [];
    this.name = name;
    this.setLevel(level);
  },

  /**
   * Sets the threshold for this logger to level. Logging messages which are
   * less severe than level will be ignored. When a logger is created,
   * the level is set to NOTSET which means all messages are emitted.
   *
   * @param   level          The level the logger is responsible for.
   *                         Any LogRecords whose level that is below the
   *                         loggers level will be ignored.
   */
  setLevel: function Logger_setLevel(level) {
    if (typeof(level) == "number")
      this.level = level;
  },

  /**
   * Indicates if a message of severity level would be processed by this logger.
   *
   * @param   level          Level to check and see if the logger can process.
   * @return                 True if the logger could process, otherwise false.
   */
  isEnabledFor: function Logger_isEnabledFor(level) {
    if (level >= this.level)
      return true;
    return false;
  },

  /**
   * Logs a message with level DEBUG on this logger.
   *
   * @param   message        Message to log.
   */
  debug: function Logger_debug(message) {
    this.log(LoggingLevels.DEBUG, message);
  },

  /**
   * Logs a message with level INFO on this logger.
   *
   * @param   message        Message to log.
   */
  info: function Logger_info(message) {
    this.log(LoggingLevels.INFO, message);
  },

  /**
   * Logs a message with level WARN on this logger.
   *
   * @param   message        Message to log.
   */
  warn: function Logger_warn(message) {
    this.log(LoggingLevels.WARN, message);
  },

  /**
   * Logs a message with level ERROR on this logger.
   *
   * @param   message        Message to log.
   */
  error: function Logger_error(message) {
    this.log(LoggingLevels.ERROR, message);
  },

  /**
   * Logs a message with level CRITICAL on this logger.
   *
   * @param   message        Message to log.
   */
  critical: function Logger_critical(message) {
    this.log(LoggingLevels.CRITICAL, message);
  },

  /**
   * Logs a message with level ERROR on the logger it includes the error
   * information.
   *
   * @param   message        Message to log.
   * @param   e              error to log.
   */
  exception: function Logger_exception(message, e) {
    this.log(LoggingLevels.ERROR, message, e);
  },

  /**
   * Logs a message with integer level on this logger.
   *
   * @param   level          Level of the message to log.
   * @param   message        Message to log.
   * @param   exception      [OPTIONAL] Exception to log.
   */
  log: function Logger_log(level, message, /*OPTIONAL*/ exception) {
    if (this.isEnabledFor(level)) {

      // create the record
      var record = new LogRecord(this.name, level, message, exception);

      // no handlers so use the default
      if (this.handlers.length == 0) {
        new LogHandler().handle(record);
        return;
      }

      // loop through the handlers and call each
      this.handlers.forEach(function(handler) {
        handler.handle(record);
      });
    }
  },

  /**
   * Adds the specified handler to this logger.
   *
   * @param   handler        The handler to add.
   */
  addHandler: function Logger_addHandler(handler) {
    if (handler instanceof LogHandler) {
      if (!this.handlers.some(function(o) { return o === handler; }))
        this.handlers.push(handler);
    }
  },

  /**
   * Removes the specified handler from this logger.
   *
   * @param   handler        The handler to add.
   */
  removeHandler: function Logger_removeHandler(handler) {
    this.handlers = this.handlers.filter(function(o) { return o != handler; });
  }
});


/*******************************************************************************
 * Handlers are responsible for taking a LogRecord calling the formatter on it
 * and writting it to whatever location the handler is responsible for.
 * The base handler does not output the log records anywhere.
 *
 * @see /content/external/jquery-1.3.2.js
 * @see /content/external/class.js
 * @version 1.0
 ******************************************************************************/
var LogHandler = Class.extend({
  level: 0,
  formatter: null,

  /**
   * Initialize the handler with the level it is responsible for outputting.
   * The default level is NOTSET.  Which means all records will be outputted.
   *
   * @param   level          [OPTIONAL] The level the handler is responsible for.
   *                         Any LogRecords whose level that is below the
   *                         handlers level will be ignored.
   * @param   formatter      [OPTIONAL] the log formatter to use.
   */
  init: function LogHandler_init(/*OPTIONAL*/ level, /*OPTIONAL*/ formatter) {
    this.setLevel(level);
    if (!formatter)
      formatter = new LogFormatter();
    this.setFormatter(formatter);
  },

  /**
   * Sets the threshold for this handler to level. Logging messages which are
   * less severe than level will be ignored. When a handler is created,
   * the level is set to NOTSET which means all messages are emitted.
   *
   * @param   level          The level the handler is responsible for.
   *                         Any LogRecords whose level that is below the
   *                         handlers level will be ignored.
   */
  setLevel: function LogHandler_setLevel(level) {
    if (typeof(level) == "number")
      this.level = level;
  },

  /**
   * Sets the Formatter for this handle.
   *
   * @param   formatter      The formatter for this handler.
   */
  setFormatter: function LogHandler_setFormatter(formatter) {
    if (formatter instanceof LogFormatter)
      this.formatter = formatter;
  },

  /**
   * Ensure all logging output has been flushed. This version does nothing and
   * is intended to be implemented by subclasses.
   */
  flush: function LogHandler_flush() {},

  /**
   * Tidy up any resources used by the handler.   This version does nothing
   * and is intended to be implemented by subclasses.
   */
  close: function LogHandler_close() {},

  /***
   * handle the record by checking it level and then emitting it.
   *
   * @param   record         The log record to handle.
   */
  handle: function LogHandler_handle(record) {
    if (record.level >= this.level)
      this.emit(record);
  },

  /**
   * Do formatting for a record.
   *
   * @param   record         The log record to format.
   * @param   exclude        [OPTIONAL] Exclude the exception message from the format.
   * @return                 Return the formatted message.
   */
  format: function LogHandler_format(record, exclude) {
    var formatted = this.formatter.format(record);
    if (exclude !== true && record.exception)
      formatted += "\n" + this.formatter.formatException(record.exception);
    return formatted;
  },

  /**
   * Do whatever it takes to actually log the specified logging record.  This
   * version does nothing.
   *
   * @param   record        The log record to output.
   */
  emit: function LogHandler_emit(record) {}
});


/*******************************************************************************
 * Formatters are responsible for converting a LogRecord to (usually) a string
 * which can be interpreted by either a human or an external system.
 * The base Formatter allows a formatting string to be specified.
 * If none is supplied, the default value of '%(message)' is used.
 *
 * A Formatter can be initialized with a format string which makes use of
 * knowledge of the LogRecord attributes.  Possible format string variables are:
 *
 * %(name)                   Name of the logger.
 * %(number)                 Numerical value of the log level.
 * %(level)                  Text value of the log level.
 * %(when)                   Time when the log record was created
 * %(message)                User specified logging message.
 *
 * @see /content/external/jquery-1.3.2.js
 * @see /content/external/class.js
 * @version 1.0
 * ****************************************************************************/
var LogFormatter = Class.extend({
  frmt: "%(message)",
  levelNames: {},

  /**
   * Initialize the log formatter with an optional format string.
   *
   * @param   frmt           [OPTIONAL] The string used to format the record.
   */
  init: function LogFormatter_init(/*OPTIONAL*/frmt) {
    this.setFormat(frmt);

    // setup a cache of level name, keyed by level number
    for (var name in LoggingLevels)
      this.levelNames[LoggingLevels[name]] = name;
  },

  /**
   * Set the format string.
   *
   * @param   format         The format string to use.
   */
  setFormat: function LogFormatter_setFormat(frmt) {
    if (typeof(frmt) == "string")
      this.frmt = frmt;
  },

  /**
   * Format a LogRecord into a formatted string.
   *
   * @param   record         The log record to format.
   * @return                 The formatted string.
   */
  format: function LogFormatter_format(record) {
    var formatted = this.frmt;
    formatted = formatted.replace(/%\(name\)/g, record.name);
    formatted = formatted.replace(/%\(levelnumber\)/g, record.level);
    formatted = formatted.replace(/%\(level\)/g, this.getLevelName(record.level));
    formatted = formatted.replace(/%\(when\)/g, record.when.toUTCString());
    formatted = formatted.replace(/%\(message\)/g, record.message);
    return formatted;
  },

  /**
   * Format an exception into a formatted string.
   *
   * @param   exception      The exception to format.
   * @return                 The formatted string.
   */
  formatException: function LogFormatter_formatException(exception) {
    var formatted = "";
    for (var attr in exception)
      formatted += attr + ": " + exception[attr] + "\n";
    return formatted;
  },

  /**
   * Get the name of a logging level.  If the level is not represented in
   * LoggingLevels than an empty string is returned.
   *
   * @param   level          The level to get the name for.
   * @return                 The name of the logging leve.
   */
  getLevelName: function LogFormatter_getLevelName(level) {
    if (this.levelNames[level])
      return this.levelNames[level];
    return "";
  }
});


/*******************************************************************************
 * Log record that formatters and handlers work off of to actually
 * log the message to whatever medium the handler works on.
 *
 * @see /content/external/jquery-1.3.2.js
 * @see /content/external/class.js
 * @version 1.0
 ******************************************************************************/
var LogRecord = Class.extend({
  name: "",
  level: 0,
  message: "",
  exception: null,
  when: null,

  /**
   * Initialize the log record.
   *
   * @param   name           Name of the logger creating the record.
   * @param   level          Level of the message to log.
   * @param   message        Log message.
   * @param   exception      [OPTIONAL] error object
   */
  init: function Formatter_init(name, level, message, /*OPTIONAL*/ exception) {
    this.name = name;
    this.level = level;
    this.message = message;
    this.exception = exception;
    this.when = new Date();
  }
});
