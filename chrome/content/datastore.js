/*******************************************************************************
 * Object used to abstract away the different storage mechanisms that we may
 * use to store data.  All values in the data store are stored as strings.
 * This script should be included in such a way as to not pollute
 * the global context.
 *
 * @see /content/logging.js
 * @see /content/external/class.js
 * @version 1.0
 ******************************************************************************/
var DataStore = Class.extend({
  _logger: null,
  _storage: null,

  /**
   * Initialize the datastore.
   *
   * @param   logging        The logging service.
   */
  init: function DataStore_init(logging) {
    this._logger = logging.getLogger("datastore");

    var scope = {};
    var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader);
    loader.loadSubScript("chrome://forecastfox/content/sqlite.js", scope);

    this._storage = new scope.SQLite(logging);
    this._logger.debug("initialized");
  },

  /**
   * Get an array of keys in the data store.  The array is sorted alphabetically.
   *
   * @return                 An array of keys in the data store.  If no keys
   *                         exist in the store then an empty array is returned.
   */
  keys: function DataStore_keys() {
    var results = this._storage.query("keys", "SELECT key FROM datastore");
    this._logger.debug("getting " + results.length + " keys");
    var keys = [];
    for (var i=0; i<results.length; i++)
      keys.push(results[i].key);
    keys.sort();
    return keys;
  },

  /**
   * Find the value indicated by the key.  If an item doesn't exist in
   * the store, null will be returned.
   *
   * @param   key            The lookup key indicating the value.
   * @param   parse          Indicates we should try to parse as a json string.
   * @return                 The value indicated by the key.  If the key
   *                         doesn't exist or parsing the json string fails,
   *                         null will be returned.
   */
  get: function DataStore_get(key, parse) {
    var results = this._storage.query("get", "SELECT value FROM datastore WHERE key=:key", {"key": key});
    var value = ((results.length) ? results[0].value : null);

    if (value && parse) {
      try {
        return JSON.parse(value);
      } catch(e) {
        this._logger.exception("json parsing failed for " + key, e);
        return null;
      }
    }
    this._logger.debug("data retrieved for " + key);
    return value;
  },

  /***
   * Add the key/value pair to the store.  If the key already exists it will
   * be updated with the new value.
   *
   * @param   key            The lookup key indicating the value.
   * @param   value          The value to be stored.
   * @param   stringify      Indicates if we should try to convert the value
   *                         to a json string.
   * @return                 true if the value is set successfully.
   *                         Otherwise, false.
   */
  set: function DataStore_set(key, value, stringify) {
    if (stringify) {
      try {
        value = JSON.stringify(value);
        if (value == "{}") {
          this._logger.error("json stringify failed for " + key);
          return false;
        }
      } catch(e) {
        this._logger.exception("json stringify failed for " + key, e);
        return false;
      }
    }

    if (typeof(value) != "string") {
      this._logger.error("value is not a string for " + key);
      return false;
    }

    var success = false;
    if (this._has(key))
      success = this._storage.execute("update", "UPDATE datastore SET value=:value WHERE key=:key;", {"key": key, "value": value});
    else
      success = this._storage.execute("insert", "INSERT INTO datastore (key, value) VALUES(:key, :value);", {"key": key, "value": value});

    if (success) {
      this._logger.debug("data stored for " + key);
      return true;
    } else {
      this._logger.error("storing data failed for " + key);
      return false;
    }
  },

  /**
   * Delete the indicated key/value pair.
   *
   * @param   key            The lookup key indicating the value.
   */
  remove: function DataStore_remove(key) {
    this._storage.execute("remove", "DELETE FROM datastore WHERE key=:key;", {"key": key});
    this._logger.debug("data removed for " + key);
  },

  /**
   * Remove all key/value pairs from the store.
   */
  clear: function DataStore_clear() {
    this._storage.execute("clear", "DELETE FROM datastore;");
    this._logger.debug("data store cleared");
  },

  /**
   * All data from the datastore.  A json object of key/value pairs is
   * returned.  The values are returned as strings, no JSON parsing occurs.
   *
   * @return                 A JSON object of key/value pairs.
   */
  all: function DataStore_all() {
    this._logger.debug("retrieving all key/value pairs in the data store");
    var obj = {};
    var results = this._storage.query("all", "SELECT * FROM datastore;");
    for (var i=0; i<results.length; i++) {
      var row = results[i];
      obj[row.key] = row.value;
    }
    return obj;
  },

  /**
   * Ingest all values into the data store.  A json object of key/value pairs
   * should be passed in.  The values should be string values.
   *
   * @param   obj            JSON object of key/value pairs.
   */
  ingest: function DataStore_ingest(obj) {
    for (var key in obj) {
      var value = obj[key];
      this.set(key, value);
      this._logger.debug("ingesting " + value + " for " + key + " key");
    }
  },

  /**
   * Check if we have a key in the datastore.
   *
   * @param   key            The key to check.
   * @return                 True if the key exists otherwise false.
   */
  _has: function DataStore__has(key) {
    var results = this._storage.query("has", "SELECT key FROM datastore WHERE key=:key", {"key": key});
    this._logger.debug("checking if key " + key + " exists");
    return (results.length > 0);
  }
});