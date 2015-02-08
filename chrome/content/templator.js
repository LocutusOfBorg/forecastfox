/*******************************************************************************
 * Objects used by the front-end to take the backing data and render a feature.
 * The templator knows how to take a template and backing data and render
 * the template as html.  The templator uses the jquery.template plugin to
 * handle the actual templating.
 *
 *
 * @see /content/logging.js
 * @see /content/external/class.js
 * @see /content/external/jquery-1.3.2.js
 * @see /content/external/jquery.template.js
 * @version 1.0
 ******************************************************************************/
var Templator = Class.extend({
  _logger: null,
  _document: null,
  _$: $,

  /**
   * Initialize the templator object.
   *
   * @param   logging        The logging service.
   * @param   doc            The document that selectors and templates are in.
   */
  init: function Templator_init(logging, doc) {
    this._logger = logging.getLogger("templator");
    this._document = doc;
    this._logger.debug("initialized");
  },

  /**
   * Retreive a dom node from the document.  It returns the node of a selector
   * or null if the node is not found.
   *
   * @param   selector       The selector of the node to get.
   * @returns                The node or null if not found.
   */
  node: function Templator_node(selector) {
    var node = $(selector, this._document);
    if (node.size() === 0)
      this._logger.warn("could not find a node for " + selector);
    return node;
  },

  /**
   * Retrieve a template from a dom node and cleans it up.  It then returns
   * the cleaned template so it can be rendered.
   *
   * @param   selector       The selector to the template dom node.
   * @return                 The cleaned up template or null if the node can
   *                         not be found.
   */
  template: function Templator_template(selector) {

    // get the template dom node
    var node = this.node(selector);
    if (node.size() == 0)
      return null;

    // get the html of the template
    var template = node.html();

    // replace CDATA with empty strings
    template = template.replace(/\s*<!\[CDATA\[|\]\]>\s*/g, '');

    // replace carriage returns, new lines, and tabs with new lines
    template = template.replace(/[\r\n\t]/g, '\n');

    // decode any uri encoding
    template = unescape(template);

    // return the template
    return template;
  },

  /**
   * Render a jquery.template string using the passed in data.
   *
   * @param   template       The template string to render.
   * @param   data           The data to use in the template.
   * @param   selector       [OPTIONAL] template variable is a selector.
   * @return                 The rendered template.
   */
  render: function Templator_render(template, data, /*OPTIONAL*/selector) {

    // flatten the data so it's used by jquery.template.
    data = flatten(data);

    // get the template.
    var newtemplate = template;
    if (selector)
      newtemplate = this.template(template);

    // return the rendered template
    //this._logger.debug("rendering template " + newtemplate + " with " + JSON.stringify(data));
    return $.template(newtemplate).apply(data);
  }
});


/**
 * Flattens a nested object so that all its properties can be accessed by the
 * jquery template module. It concatenates paths using "-" when flattening.
 *
 * @param     object         a nested JSON object,
 *                           ex: { units: { distance: "m" }, location: "01239" }
 * @return                   a flattened object,
 *                           ex: { "units-distance": "m", location: "01239" }
 */
function flatten(object) {
  var newObject = {};
  _flatten(object, [], newObject);
  return newObject;
}


/**
 * Helper method for flattening data.  Calls itself recursively if to when
 * a property on an object is another object.
 *
 * @param     remaining      Part of the object that remains to be worked on
 * @param     path           An array of property names in the object.
 * @param     newObject      The new object being created with the flattend paths.
 */
function _flatten(remaining, path, newObject) {
  for (var prop in remaining) {
    var newProp = path.concat([prop]);
    if (typeof(remaining[prop]) == "object")
      _flatten(remaining[prop], newProp, newObject);
    else
      newObject[newProp.join("-")] = remaining[prop];
  }
}

