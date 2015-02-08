/*******************************************************************************
 * Object used to interact with Firefox's sqlite implementation.  This object
 * caches storage statements to optimize reuse.  You should call either query or
 * execute passing in name, sql, and params.
 *
 * @see /content/logging.js
 * @see /content/external/class.js
 * @version 1.0
 ******************************************************************************/
var SQLite = Class.extend({
  _logger: null,
  _statements: null,
  _storage: null,

  /**
   * Retrieve our database nsIFile.  This is used to create a connection to
   * our database file in the users profile.
   */
  database: function SQLite_database() {
    var file = Components.classes["@mozilla.org/file/directory_service;1"].
               getService(Components.interfaces.nsIProperties).
               get("ProfD", Components.interfaces.nsIFile);
    file.append("forecastfox.sqlite");
    return file;
  },

  /**
   * Initialize the sqlite service.  This can be called either with or without
   * the logging paramenter.
   *
   * @param   logging        [OPTIONAL] The logging service.
   */
  init: function SQLite_init(/*OPTIONAL*/ logging) {
    if (logging) this._logger = logging.getLogger("sqlite");

    // add an observer to shutdown
    var observers = Components.classes["@mozilla.org/observer-service;1"].
                    getService(Components.interfaces.nsIObserverService);
    observers.addObserver(this, "xpcom-shutdown", true);

    // get the sql connection
    if (this._logger)
      this._logger.debug("opening connection to forecastfox.sqlite");

    var ss = Components.classes["@mozilla.org/storage/service;1"].
             getService(Components.interfaces.mozIStorageService);
    this._storage = ss.openDatabase(this.database());

    // make sure the table exists
    if (!this._storage.tableExists("datastore")) {
      if (this._logger)
        this._logger.debug("creating datastore table");
      this._storage.createTable("datastore", "key TEXT PRIMARY KEY NOT NULL, value TEXT");
    }

    if (this._logger) this._logger.debug("initialized");
  },

  /* ::::: nsISupports ::::: */
  QueryInterface: function SQLite_QI(iid) {
    if (iid.equals(Components.interfaces.nsISupports) ||
        iid.equals(Components.interfaces.nsISupportsWeakReference) ||
        iid.equals(Components.interfaces.nsIObserver))
      return this;
    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  /* ::::: nsIObserver ::::: */
  observe: function SQLite_observe(subject, topic, data) {
    if (topic != "xpcom-shutdown")
      return;

    // close the connection
    this._storage.close();
    this._storage = null;
  },

  /**
   * Generate an sql statement to be used in other methods.
   *
   * @param   name           Name to cache the statement under.  If the name is
   *                         an empty string the statement will not be cached.
   * @param   sql            The sql to create the statement for.
   * @return                 The mozIStorageStatementWrapper interface.
   */
  statement: function SQLite_statement(name, sql) {
    return this._storage.createStatement(sql);
  },

  /**
   * Execute a sql statement.  This is called if the sql doesn't return any
   * values.  Such as for insert or update statements.
   *
   * @param   name           Name to cache the statement under.  If the name is
   *                         an empty string the statement will not be cached.
   * @param   sql            The sql to create the statement for.
   * @param   params         [OPTIONAL] The params used to execute the statement.
   */
  execute: function SQLite_execute(name, sql, params) {
    var statement = null;
    try {
      statement = this.statement(name, sql);
    } catch(e) {
      if (this._logger) this._logger.exception("error creating statement", e);
      return false;
    }

    // if params passed in add them
    if (params !== undefined) {
      for (var key in params)
        statement.params[key] = params[key];
    }

    // execute the statement
    try {
      if (this._logger) this._logger.debug("executing " + sql);
      statement.execute();
    } catch(e) {
      if (this._logger) this._logger.exception("error executing", e);
      return false;
    }
    return true;
  },

  /**
   * Execute a sql statement and return it's results.
   *
   * @param   name           Name to cache the statement under.  If the name is
   *                         an empty string the statement will not be cached.
   * @param   sql            The sql to create the statement for.
   * @param   params         [OPTIONAL] The params used to execute the statement.
   * @return                 The results of the statement.
   */
  query: function SQLite_query(name, sql, params) {
    var statement = null;
    try {
      statement = this.statement(name, sql);
    } catch(e) {
      if (this._logger) this._logger.exception("error creating statement", e);
      return [];
    }

    // if params passed in add them
    if (params !== undefined) {
      for (var key in params)
        statement.params[key] = params[key];
    }

    var results = null;
    try {
//      if (this._logger) this._logger.debug("querying " + sql);
      results = this._results(statement);
    } catch (e) {
      if (this._logger) this._logger.exception("error querying", e);
      return [];
    } finally {
      statement.reset();
    }
    return results;
  },

  /**
   * Internal helper for stepping through a sql statement and retrieving it's
   * results.  This is called from query.
   *
   * @param   statement      The storage statement to step through.
   * @return                 An array of objects holding column name and value.
   */
  _results: function SQLite__results(statement) {
    var results = [];
    var columns = null;

    // step through the statements
    while(statement.step()) {

      // get the column names if we do not have them
      if (!columns) {
        columns = [];
        for (var j=0; j<statement.columnCount; j++)
          columns[j] = statement.getColumnName(j);
      }

      // get the values per column and append to the results array
      var result = {};
      for (var i=0; i<columns.length; i++)
        result[columns[i]] = statement.row[columns[i]];
      results[results.length] = result;
    }

    // return the results array
    return results;
  }
});