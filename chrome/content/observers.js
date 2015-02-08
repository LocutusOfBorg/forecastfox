/*******************************************************************************
 * Observer service is a way for services to communicate with each other
 * without having to actually reference each other.  A service can register
 * to listen for a topic, with a callback.  When the topic is fired a json
 * object is passed into the callback function.  Calling the notify function
 * on the service will loop through the observers for a topic and call the
 * callback functions that have been registered.
 *
 * @see /content/external/jquery-1.3.2.js
 * @see /content/external/class.js
 * @version 1.0
 ******************************************************************************/
const OBSERVERS_CHANNEL = "observers";


var Observers = Class.extend({
  _prefix: "forecastfox-",

  /**
   * Initialize the observer service.  This takes a logging parameter so we can
   * log updates.
   *
   * @param   logging        The logging service
   * @param   channel        [OPTIONAL] an optional channel name
   * @param   background     [OPTIONAL] true if observers are on the background
   */
  init: function Observers_init(logging, /*OPTIONAL*/channel, /*OPTIONAL*/background) {
    this._logger = logging.getLogger("observers");
    this._callbacks = {};
    this._ports = [];

    // use the default channel name if one not passed in
    if (!channel)
      channel = OBSERVERS_CHANNEL;
    this._channel = channel;

    this._installListeners();

    this._logger.debug("adding observer " + this._topic());
    this._logger.debug("initialized");
  },

  /**
   * Add an observer to the service.
   *
   * @param   topic          Topic to listen for notifications.
   * @param   callback       Function to callback when a topic is notified.
   */
  add: function Observers_add(topic, callback) {

    // create topic storage if not already created
    if (!(topic in this._callbacks)) {
      this._callbacks[topic] = [];
      this._logger.debug("topic storage created for " + topic);
    }

    // callback is already stored
    if (this._callbacks[topic].some(function(c) { return c == callback; })) {
      this._logger.debug("callback already stored for " + topic);
      return;
    }

    // store the callback
    this._callbacks[topic].push(callback);
    this._logger.debug("callback stored for " + topic);
  },

  /**
   * Remove an observer from the service.
   *
   * @param   topic          Topic to listen for notifications.
   * @param   callback       Function to callback when a topic is notified.
   */
  remove: function Observers_remove(topic, callback) {

    // no observers for the topic
    if (!(topic in this._callbacks)) {
      this._logger.debug("no callbacks stored for " + topic);
      return;
    }

    // remove the callback
    this._callbacks[topic] = this._callbacks[topic].filter(function(o) { return o != callback; });
    this._logger.debug("callback remove from " + topic);
  },

  /**
   * Notify observers of a topic.  We send the notification out over the
   * Firefox observer service.
   *
   * @param   topic          Topic to notify observers about.
   * @param   data           The data object to pass on to the observers.
   */
  notify: function Observers_notify(topic, data) {
    this._send({"topic": topic, "data": data});
  },

  /**
   * Informs the observer system to perform an orderly shutdown.
   * This should be called at application exit and no further use of the
   * observer system should be made after this call.
   */
  shutdown: function Observers_shutdown() {
    this._service.removeObserver(this, this._topic(), true);
    this._callbacks = {};
    this._logger.debug(this._channel + " observers has shut down");
  },

  /**
   * Notifies the callbacks registered with this local observers instance
   * that are observing the designated topic.
   *
   */
  _notify: function Observers__notify(topic, data) {
    var self = this;

    // no observers for the topic
    var callbacks = this._callbacks[topic];
    if (!callbacks) {
      this._logger.debug("no callbacks stored for " + topic);
      return;
    }

    // loop through the callbacks in the same process.
    callbacks.forEach(function(callback) {
      try {
        setTimeout(function() {callback.apply(null, [data]); }, 0);
//        self._logger.debug("callback " + callback + " notified of " + topic);
      } catch(e) {
        self._logger.exception("callback failed for " + topic, e);
      }
    });
  },

  /**
   * Send out the message over the observer service.
   *
   * @param   msg            Message to send.
   */
  _send: function Observers_send(msg) {
    var data = JSON.stringify(msg);
    this._logger.debug("sending message: " + msg.topic);
    this._service.notifyObservers(this, this._topic(), data);
  },

  _installListeners: function Observers_installListeners() {
    // listen for messages on the port
    this._service = Components.classes["@mozilla.org/observer-service;1"].
                    getService(Components.interfaces.nsIObserverService);
		// TODO why do weak references not work?
    this._service.addObserver(this, this._topic(), false);
  },

  /**
   * Internal function for creating the topic we use in the firefox observer
   * service.
   *
   * @return                 The topic
   */
  _topic: function Observers__topic() {
    return this._prefix + this._channel;
  },

  /* ::::: nsISupports ::::: */
  QueryInterface: function Observers_QI(iid) {
    if (iid.equals(Components.interfaces.nsISupports) ||
        iid.equals(Components.interfaces.nsISupportsWeakReference) ||
        iid.equals(Components.interfaces.nsIObserver))
      return this;
    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  /* ::::: nsIObserver ::::: */
  observe: function Observers_observe(subject, topic, data) {
    this._logger.debug("received message: " + topic);
    var msg = JSON.parse(data);
    this._notify(msg.topic, msg.data);
  }
});