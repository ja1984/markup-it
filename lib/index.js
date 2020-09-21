'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var slate = require('slate');
var Immutable = require('immutable');
var Immutable__default = _interopDefault(Immutable);
var uid = _interopDefault(require('uid'));
var is = _interopDefault(require('is'));
var entities = require('entities');
var Html = require('html');
var detectNewLine = _interopDefault(require('detect-newline'));
var htmlparser2 = require('htmlparser2');
var htmlclean = _interopDefault(require('htmlclean'));
var isAbsoluteURL = _interopDefault(require('is-absolute-url'));
var splitLines$1 = _interopDefault(require('split-lines'));
var escapeStringRegexp = _interopDefault(require('escape-string-regexp'));
var trimNewlines = _interopDefault(require('trim-newlines'));
var trimTrailingLines = _interopDefault(require('trim-trailing-lines'));
var indentString = _interopDefault(require('indent-string'));
var warning = _interopDefault(require('warning'));
var ltrim = _interopDefault(require('ltrim'));
var rtrim = _interopDefault(require('rtrim'));
var jsYaml = require('js-yaml');
var fm = _interopDefault(require('front-matter'));

/**
 * Map of all block types. Blocks can contain inlines or blocks.
 * @type {Map}
 */
const BLOCKS = {
  TEXT: 'unstyled',
  // Classic blocks
  CODE: 'code_block',
  CODE_LINE: 'code_line',
  BLOCKQUOTE: 'blockquote',
  PARAGRAPH: 'paragraph',
  FOOTNOTE: 'footnote',
  HTML: 'html_block',
  HR: 'hr',
  // Headings
  HEADING_1: 'header_one',
  HEADING_2: 'header_two',
  HEADING_3: 'header_three',
  HEADING_4: 'header_four',
  HEADING_5: 'header_five',
  HEADING_6: 'header_six',
  // Table
  TABLE: 'table',
  TABLE_ROW: 'table_row',
  TABLE_CELL: 'table_cell',
  // Lists
  OL_LIST: 'ordered_list',
  UL_LIST: 'unordered_list',
  LIST_ITEM: 'list_item',
  // Comment
  COMMENT: 'comment',
  // Math
  MATH: 'math_block',
  // Default block
  DEFAULT: 'paragraph'
};

const ALL_BLOCKS = Object.values(BLOCKS);
/**
 * Dictionary of all container block types, and the set block types they accept as children.
 * The first value of each set is the default block type.
 *
 * @type {Map<String:Array>}
 */

const CONTAINERS = {
  // We use Document.object instead of its type
  document: [BLOCKS.PARAGRAPH, ...ALL_BLOCKS],
  [BLOCKS.BLOCKQUOTE]: [BLOCKS.TEXT, ...ALL_BLOCKS],
  [BLOCKS.TABLE]: [BLOCKS.TABLE_ROW],
  [BLOCKS.TABLE_ROW]: [BLOCKS.TABLE_CELL],
  [BLOCKS.TABLE_CELL]: [BLOCKS.PARAGRAPH, ...ALL_BLOCKS],
  [BLOCKS.LIST_ITEM]: [BLOCKS.TEXT, ...ALL_BLOCKS],
  [BLOCKS.OL_LIST]: [BLOCKS.LIST_ITEM],
  [BLOCKS.UL_LIST]: [BLOCKS.LIST_ITEM],
  [BLOCKS.CODE]: [BLOCKS.CODE_LINE]
};

/**
 * Map of all inline node types. Inline nodes can only contain inline or text nodes.
 * @type {Map}
 */
const INLINES = {
  HTML: 'html',
  LINK: 'link',
  IMAGE: 'image',
  FOOTNOTE_REF: 'footnote-ref',
  MATH: 'math',
  VARIABLE: 'variable'
};

/**
 * Dictionary of all leaf containers (those that can contain inlines or text).

 * @type {Map<String:Boolean>}
 */

const LEAFS = {
  [BLOCKS.PARAGRAPH]: true,
  [BLOCKS.TEXT]: true,
  [BLOCKS.TABLE_CELL]: true,
  [BLOCKS.CODE_LINE]: true
};

const MARKS = {
  BOLD: 'BOLD',
  ITALIC: 'ITALIC',
  CODE: 'CODE',
  STRIKETHROUGH: 'STRIKETHROUGH'
};

const TABLE_ALIGN = {
  LEFT: 'left',
  RIGHT: 'right',
  CENTER: 'center'
};

const VOID = {
  [BLOCKS.HR]: true,
  [BLOCKS.HTML]: true,
  [BLOCKS.COMMENT]: true,
  [INLINES.IMAGE]: true
};

const DEFAULTS = {
  transform: state => state
};
class RuleFunction extends Immutable.Record(DEFAULTS) {
  /**
   * Execute a rule function or a function.
   * @param {Function or RuleFunction} fn
   * @param {Mixed} ...args
   * @return {Mixed} result
   */
  static exec(fn) {
    for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }

    return fn instanceof RuleFunction ? fn.exec(...args) : fn(...args);
  }
  /**
   * Add a composition to the transform function
   * @param  {Function} composer
   * @return {RuleFunction}
   */


  compose(composer) {
    let {
      transform
    } = this;
    transform = composer(transform);
    return this.merge({
      transform
    });
  }
  /**
   * Push a transformation to the stack of execution.
   * @param  {Function} next
   * @return {RuleFunction}
   */


  then(next) {
    return this.compose(prev => state => {
      const prevState = prev(state);

      if (typeof prevState == 'undefined') {
        return undefined;
      }

      return next(prevState);
    });
  }
  /**
   * Push an interceptor withut changing the end value.
   * @param  {Function} interceptor
   * @return {RuleFunction}
   */


  tap(interceptor) {
    return this.compose(prev => state => {
      const prevState = prev(state);
      interceptor(prevState);
      return prevState;
    });
  }
  /**
   * Try multiple alternatives
   * @param  {Function} alternatives
   * @return {RuleFunction}
   */


  use(alternatives) {
    return this.then(state => {
      let newState;
      alternatives.some(fn => {
        newState = RuleFunction.exec(fn, state);
        return Boolean(newState);
      });
      return newState;
    });
  }
  /**
   * Prevent applying the transform function if <match> is false
   * @param  {Function} match
   * @return {RuleFunction}
   */


  filter(match) {
    return this.compose(prev => state => {
      const prevState = prev(state);

      if (!prevState || !match(prevState)) {
        return undefined;
      }

      return prevState;
    });
  }
  /**
   * Prevent applying the transform function if <match> returns true
   * @param  {Function} match
   * @return {RuleFunction}
   */


  filterNot(match) {
    return this.filter(state => !RuleFunction.exec(match, state));
  }
  /**
   * Execute the transform function on an input
   * @param  {State} state
   * @param  {Object} value
   * @return {Object}
   */


  exec(state, value) {
    return this.transform(state);
  }

}

class Deserializer extends RuleFunction {
  /**
   * Match text using a regexp, and move the state to the right position.
   *
   * @param {RegExp | Array<RegExp>} re
   * @param {Function} callback
   * @return {Deserializer}
   */
  matchRegExp(inputRegexps, callback) {
    let regexps = inputRegexps;

    if (!(regexps instanceof Array)) {
      regexps = [regexps];
    }

    regexps = Immutable.List(regexps);
    let match;
    return this.filter(state => regexps.some(re => {
      match = re.exec(state.text);
      return match;
    })).then(state => callback(state.skip(match[0].length), match));
  }

}

const DeserializerFactory = () => new Deserializer();

class Serializer extends RuleFunction {
  /**
   * Limit execution of the serializer to a set of node types
   * @param {Function || Array || String} matcher
   * @return {Serializer}
   */
  matchType(inputMatcher) {
    const matcher = normalizeMatcher(inputMatcher);
    return this.filter(state => {
      const node = state.peek();
      const {
        type
      } = node;
      return matcher(type);
    });
  }
  /**
   * Limit execution of the serializer to a "object" of node
   * @param {Function || Array || String} matcher
   * @return {Serializer}
   */


  matchObject(inputMatcher) {
    const matcher = normalizeMatcher(inputMatcher);
    return this.filter(state => {
      const node = state.peek();
      const {
        object
      } = node;
      return matcher(object);
    });
  }
  /**
   * Limit execution of the serializer to leaf containing a certain mark
   * @param {Function || Array || String} matcher
   * @param {Function} transform(State, String, Mark)
   * @return {Serializer}
   */


  matchMark(inputMatcher) {
    const matcher = normalizeMatcher(inputMatcher);
    return this.matchObject('text').filter(state => {
      const text = state.peek();
      return text.getLeaves().some(leaf => {
        const hasMark = leaf.marks.some(mark => matcher(mark.type));
        return hasMark;
      });
    });
  }
  /**
   * Transform all leaves in a text.
   * @param {Function} transform(state: State, leaf: Leaf)
   * @return {Serializer}
   */


  transformLeaves(transform) {
    return this.matchObject('text').then(state => {
      const text = state.peek();
      let leaves = text.getLeaves(); // Transform leaves

      leaves = leaves.map(leaf => transform(state, leaf)); // Create new text and push it back

      const newText = slate.Text.create({
        leaves
      });
      return state.shift().unshift(newText);
    });
  }
  /**
   * Transform leaves matching a mark
   * @param {Function || Array || String} matcher
   * @param {Function} transform(state: State, text: String, mark: Mark): String
   * @return {Serializer}
   */


  transformMarkedLeaf(inputMatcher, transform) {
    const matcher = normalizeMatcher(inputMatcher);
    return this.matchMark(matcher).transformLeaves((state, leaf) => {
      let {
        text,
        marks
      } = leaf;
      const mark = leaf.marks.find((_ref) => {
        let {
          type
        } = _ref;
        return matcher(type);
      });

      if (!mark) {
        return leaf;
      }

      text = transform(state, text, mark);
      marks = marks.delete(mark);
      return leaf.merge({
        text,
        marks
      });
    });
  }
  /**
   * Transform text.
   * @param {Function} transform(state: State, leaf: Leaf): Leaf
   * @return {Serializer}
   */


  transformText(transform) {
    const MARK = uid();
    return this.matchObject('text') // We can't process empty text node
    .filter(state => {
      const text = state.peek();
      return !text.isEmpty;
    }) // Avoid infinite loop
    .filterNot(new Serializer().matchMark(MARK)) // Escape all text
    .transformLeaves((state, inputLeaf) => {
      const leaf = transform(state, inputLeaf);
      return leaf.merge({
        marks: leaf.marks.add(slate.Mark.create({
          type: MARK
        }))
      });
    });
  }

}
/**
 * Normalize a node matching plugin option.
 *
 * @param {Function || Array || String} matchIn
 * @return {Function}
 */


function normalizeMatcher(matcher) {
  switch (typeof matcher) {
    case 'function':
      return matcher;

    case 'string':
      return type => type == matcher;

    default:
      if (Array.isArray(matcher)) {
        return type => matcher.includes(type);
      }

      throw new Error('Cannot normalize matcher');
  }
}

const SerializerFactory = () => new Serializer();

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);

  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) symbols = symbols.filter(function (sym) {
      return Object.getOwnPropertyDescriptor(object, sym).enumerable;
    });
    keys.push.apply(keys, symbols);
  }

  return keys;
}

function _objectSpread2(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};

    if (i % 2) {
      ownKeys(Object(source), true).forEach(function (key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys(Object(source)).forEach(function (key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }

  return target;
}

/*
    State stores the global state when serializing a document or deseriaizing a text.
 */

const DEFAULTS$1 = {
  text: '',
  nodes: Immutable.List(),
  // Stack of parsing state. A new state is pushed everytime we go `down`
  // Stack<{ text: String, nodes: List<Node>, object: String }>
  stack: Immutable.Stack(),
  marks: Immutable.Set(),
  object: String('document'),
  rulesSet: Immutable.Map(),
  depth: 0,
  props: Immutable.Map()
};
class State extends Immutable.Record(DEFAULTS$1) {
  /**
   * Create a new state from a set of rules.
   * @param  {Object} rulesSet
   * @param  {Object} props
   * @return {State} state
   */
  static create() {
    let rulesSet = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    let props = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    return new State({
      rulesSet: Immutable.Map(rulesSet).map(Immutable.List),
      props: Immutable.Map(props)
    });
  }
  /**
   * Return list of rules currently being used
   * @return {List} rules
   */


  get rules() {
    const {
      object,
      rulesSet
    } = this;
    return rulesSet.get(object, Immutable.List());
  }
  /**
   * Change set of rules to use.
   *
   * @param  {String} object
   * @return {State} state
   */


  use(object) {
    return this.merge({
      object
    });
  }
  /**
   * Set a prop for the state.
   *
   * @param  {String} key
   * @param  {Mixed} value
   * @return {State} state
   */


  setProp(key, value) {
    let {
      props
    } = this;
    props = props.set(key, value);
    return this.merge({
      props
    });
  }
  /**
   * Get a prop from the state
   *
   * @param  {String} key
   * @param  {Mixed} defaultValue
   * @return {Mixed}
   */


  getProp(key, defaultValue) {
    const {
      props
    } = this;
    return props.get(key, defaultValue);
  }
  /**
   * Write a string. This method can be used when serializing nodes into text.
   *
   * @param  {String} string
   * @return {State} state
   */


  write(string) {
    let {
      text
    } = this;
    text += string;
    return this.merge({
      text
    });
  }
  /**
   * Replace all the text in the state.
   *
   * @param  {String} text
   * @return {State} state
   */


  replaceText(text) {
    return this.merge({
      text
    });
  }
  /**
   * Peek the first node in the stack
   *
   * @return {Node} node
   */


  peek() {
    return this.nodes.first();
  }
  /**
   * Shift the first node from the stack
   *
   * @return {State} state
   */


  shift() {
    let {
      nodes
    } = this;
    nodes = nodes.shift();
    return this.merge({
      nodes
    });
  }
  /**
   * Unshift a node in the list
   *
   * @param  {Node} node
   * @return {State} state
   */


  unshift(node) {
    let {
      nodes
    } = this;
    nodes = nodes.unshift(node);
    return this.merge({
      nodes
    });
  }
  /**
   * Push a new node to the stack. This method can be used when deserializing
   * a text into a set of nodes.
   *
   * @param  {Node | List<Node>} node
   * @return {State} state
   */


  push(node) {
    let {
      nodes
    } = this;

    if (Immutable.List.isList(node)) {
      nodes = nodes.concat(node);
    } else {
      nodes = nodes.push(node);
    }

    return this.merge({
      nodes
    });
  }
  /**
   * Push a new mark to the active list
   *
   * @param  {Mark} mark
   * @return {State} state
   */


  pushMark(mark) {
    let {
      marks
    } = this;
    marks = marks.add(mark);
    return this.merge({
      marks
    });
  }
  /**
   * Generate a new text container.
   *
   * @param  {String} text
   * @return {Node} text
   */


  genText() {
    let text = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
    const {
      marks
    } = this;
    let node = slate.Text.create({
      text,
      marks
    });

    if (this.object == 'block') {
      node = slate.Block.create({
        type: BLOCKS.TEXT,
        nodes: [node]
      });
    }

    return node;
  }
  /**
   * Push a new text node.
   *
   * @param  {String} text
   * @return {State} state
   */


  pushText(text) {
    return this.push(this.genText(text));
  }
  /**
   * Move this state to a lower level
   *
   * @param  {List<Node>} nodes
   * @param  {String} text
   * @return {State} state
   */


  down() {
    let {
      nodes = Immutable.List(),
      text = ''
    } = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    return this.merge({
      depth: this.depth + 1,
      nodes,
      text,
      stack: this.stack.push({
        object: this.object,
        nodes: this.nodes,
        text: this.text
      })
    });
  }
  /**
   * Move this state to a upper level
   *
   * @return {State} state
   */


  up() {
    const {
      nodes,
      text,
      object
    } = this.stack.peek();
    return this.merge({
      depth: this.depth - 1,
      nodes,
      text,
      object,
      stack: this.stack.pop()
    });
  }
  /**
   * Skip "n" characters in the text.
   * @param  {Number} n
   * @return {State} state
   */


  skip(n) {
    let {
      text
    } = this;
    text = text.slice(n);
    return this.merge({
      text
    });
  }
  /**
   * Parse current text buffer
   * @return {State} state
   */


  lex() {
    let opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    const state = this;
    const {
      text
    } = state;
    const {
      // Non parsed content left in the stack
      rest = '',
      // Should we trim the rest
      trim = true,
      // When should we stop lexing
      stopAt = (newState, prevState) => null
    } = opts;
    let startState = state;
    const trimedRest = trim ? rest.trim() : rest;

    if (trimedRest) {
      startState = startState.pushText(trimedRest);
    } // No text to parse, we return


    if (!text) {
      return startState;
    } // We apply the rules to find the first matching one


    const newState = startState.applyRules('deserialize'); // Same state cause an infinite loop

    if (newState == startState) {
      throw new Error('Some rule is returning an identical state (no-op). Make sure your rules either return undefined to pass their turn, or return a different state.');
    } // No rules match, we move and try the next char


    if (!newState) {
      return state.skip(1).lex(_objectSpread2({}, opts, {
        rest: rest + text[0]
      }));
    } // Should we stop ?


    const stop = stopAt(newState, state);

    if (stop) {
      return stop;
    } // Otherwise we keep parsing


    return newState.lex(opts);
  }
  /**
   * Apply first matching rule
   * @param  {String} text
   * @return {State} state
   */


  applyRules(object) {
    const state = this;
    const {
      rules
    } = state;
    let newState;
    rules.filter(rule => rule[object]).forEach(rule => {
      newState = RuleFunction.exec(rule[object], state);
      return !newState;
    });
    return newState;
  }
  /**
   * Deserialize a text into a list of Nodes.
   * @param  {String} text
   * @return {List<Node>} nodes
   */


  deserialize(text) {
    return this.down({
      text
    }).lex().nodes;
  }
  /**
   * Deserialize a string content into a Document.
   * @param  {String} text
   * @return {Document} document
   */


  deserializeToDocument(text) {
    const document = this.use('document').deserialize(text).get(0) || slate.Document.create();
    let {
      nodes
    } = document; // We should never return an empty document

    if (nodes.size === 0) {
      nodes = nodes.push(slate.Block.create({
        type: BLOCKS.PARAGRAPH,
        nodes: [slate.Text.create()]
      }));
    }

    return document.merge({
      nodes
    });
  }
  /**
   * Serialize nodes into text
   * @param  {List<Node>} nodes
   * @return {String} text
   */


  serialize(nodes) {
    return this.down({
      nodes: Immutable.List(nodes)
    })._serialize().text;
  }
  /**
   * Serialize a document into text
   * @param  {Document} document
   * @return {String} text
   */


  serializeDocument(document) {
    return this.use('document').serialize([document]);
  }
  /**
   * Serialize a node into text
   * @param  {Node} node
   * @return {String} text
   */


  serializeNode(node) {
    return this.serialize([node]);
  }
  /**
   * Update the state to serialize it.
   * @return {State} state
   */


  _serialize() {
    let state = this;

    if (state.nodes.size == 0) {
      return state;
    }

    state = state.applyRules('serialize'); // No rule can match this node

    if (!state) {
      throw new Error("No rule match node ".concat(this.peek().object, "#").concat(this.peek().type || ''));
    } // Same state cause an infinite loop


    if (state == this) {
      throw new Error('A rule returns an identical state, returns undefined instead when passing.');
    }

    return state._serialize();
  }

}

const ALIGNS = 'current_table_aligns'; // Key to indicate that the current row is a header

const THEAD = 'next_row_is_header'; // Key to indicate the current column index

const COL = 'current_column';
/**
 * Serialize a table to HTML
 * @type {Serializer}
 */

const serializeTable = {
  serialize: SerializerFactory().matchType(BLOCKS.TABLE).then(state => {
    const table = state.peek();
    const aligns = table.data.get('aligns');
    const rows = table.nodes;
    const headerText = state.setProp(ALIGNS, aligns).setProp(COL, 0).setProp(THEAD, true).serialize(rows.slice(0, 1));
    const bodyText = state.setProp(ALIGNS, aligns).setProp(COL, 0).serialize(rows.rest());
    return state.shift().write(['<table>', '<thead>', "".concat(headerText, "</thead>"), '<tbody>', "".concat(bodyText, "</tbody>"), '</table>', '\n'].join('\n'));
  })
};
/**
 * Serialize a row to HTML
 * @type {Serializer}
 */

const serializeRow = {
  serialize: SerializerFactory().matchType(BLOCKS.TABLE_ROW).then(state => {
    const row = state.peek();
    const inner = state.setProp(COL, 0).serialize(row.nodes);
    return state.shift().write("<tr>\n".concat(inner, "</tr>\n"));
  })
};
/**
 * Serialize a table cell to HTML
 * @type {Serializer}
 */

const serializeCell = {
  serialize: SerializerFactory().matchType(BLOCKS.TABLE_CELL).then(state => {
    const cell = state.peek();
    const isHead = state.getProp(THEAD);
    const aligns = state.getProp(ALIGNS);
    const column = state.getProp(COL);
    const cellAlign = aligns[column];
    const containOneParagraph = cell.nodes.size === 1 && cell.nodes.first().type === BLOCKS.PARAGRAPH;
    const inner = state.serialize(containOneParagraph ? cell.nodes.first().nodes : cell.nodes);
    const tag = isHead ? 'th' : 'td';
    const style = cellAlign ? " style=\"text-align:".concat(cellAlign, "\"") : '';
    return state.shift().setProp(COL, column + 1).write("<".concat(tag).concat(style, ">").concat(inner, "</").concat(tag, ">\n"));
  })
};
var table = {
  table: serializeTable,
  row: serializeRow,
  cell: serializeCell
};

/**
 * Escape all entities (HTML + XML)
 * @param  {String} str
 * @return {String}
 */

function escape(str) {
  return entities.encodeXML(str);
}

/**
 * @param {String} tag The HTML tag
 * @param {Boolean} [opts.isSingleTag=false] Render as self-closing tag
 * @param {Function} [opts.getAttrs] Function to get the HTML
 * attributes of the tag, as an Object
 * @return {Function} A function to seralize a node into an HTML tag
 */

function serializeTag(tag) {
  let opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  const {
    isSingleTag = false,
    getAttrs = node => {}
  } = opts;
  return state => {
    const node = state.peek();
    const attrs = getAttrs(node);
    const attrsText = attrsToString(attrs);
    let text;

    if (isSingleTag) {
      text = "<".concat(tag).concat(attrsText, "/>");
    } else {
      const inner = state.serialize(node.nodes);
      text = "<".concat(tag).concat(attrsText, ">").concat(inner, "</").concat(tag, ">");
    }

    return state.shift().write(text);
  };
}
/**
 * Convert a map of attributes into a string of HTML attributes.
 * @param {Object} attrs
 * @return {String}
 */


function attrsToString(attrsObject) {
  const attrs = new Immutable.Map(attrsObject);
  return attrs.reduce((output, value, key) => {
    if (is.undef(value) || is.nil(value)) {
      return output;
    } else if (is.equal(value, '')) {
      return "".concat(output, " ").concat(key);
    }

    return "".concat(output, " ").concat(key, "=\"").concat(escape(value), "\"");
  }, '');
}

/**
 * Serialize a paragraph to HTML
 * @type {Serializer}
 */

const serialize = SerializerFactory().matchType(BLOCKS.PARAGRAPH).then(serializeTag('p'));
var paragraph = {
  serialize
};

/**
 * Serialize an horizontal rule to HTML
 * @type {Serializer}
 */

const serialize$1 = SerializerFactory().matchType(BLOCKS.HR).then(serializeTag('hr', {
  isSingleTag: true
}));
var hr = {
  serialize: serialize$1
};

/**
 * Serialize a blockquote to HTML
 * @type {Serializer}
 */

const serialize$2 = SerializerFactory().matchType(BLOCKS.BLOCKQUOTE).then(serializeTag('blockquote'));
var blockquote = {
  serialize: serialize$2
};

/**
 * Serialize a code block to HTML
 * @type {Serializer}
 */

const serialize$3 = SerializerFactory().matchType(BLOCKS.CODE).then(state => {
  const node = state.peek();
  const syntax = node.data.get('syntax');
  const text = node.nodes.map(line => line.text).join('\n');
  const className = syntax ? " class=\"lang-".concat(syntax, "\"") : '';
  return state.shift().write("<pre><code".concat(className, ">").concat(escape(text), "</code></pre>\n"));
});
var code = {
  serialize: serialize$3
};

const RULES = {
  [BLOCKS.HEADING_1]: serializeTag('h1', {
    getAttrs
  }),
  [BLOCKS.HEADING_2]: serializeTag('h2', {
    getAttrs
  }),
  [BLOCKS.HEADING_3]: serializeTag('h3', {
    getAttrs
  }),
  [BLOCKS.HEADING_4]: serializeTag('h4', {
    getAttrs
  }),
  [BLOCKS.HEADING_5]: serializeTag('h5', {
    getAttrs
  }),
  [BLOCKS.HEADING_6]: serializeTag('h6', {
    getAttrs
  })
};
/**
 * Serialize a heading to HTML
 * @type {Serializer}
 */

const serialize$4 = SerializerFactory().matchType(Object.keys(RULES)).then(state => {
  const node = state.peek();
  return RULES[node.type](state);
});
/**
 * @param {Node} headingNode
 * @return {Object} The attributes names/value for the heading
 */

function getAttrs(headingNode) {
  return {
    id: headingNode.data.get('id')
  };
}

var heading = {
  serialize: serialize$4
};

/**
 * Return true if a list node contains task items.
 * @param {Block} list
 * @return {Boolean}
 */

function containsTaskList(list) {
  const {
    nodes
  } = list;
  return nodes.some(item => item.data.has('checked'));
}
/**
 * Serialize a unordered list to HTML
 * @type {Serializer}
 */


const serialize$5 = SerializerFactory().matchType([BLOCKS.OL_LIST, BLOCKS.UL_LIST]).then(state => {
  const node = state.peek();
  const tag = node.type === BLOCKS.OL_LIST ? 'ol' : 'ul';
  const isTaskList = containsTaskList(node);
  const inner = state.serialize(node.nodes);
  return state.shift().write("<".concat(tag).concat(isTaskList ? ' class="contains-task-list"' : '', ">\n").concat(inner, "</").concat(tag, ">\n"));
});
var list = {
  serialize: serialize$5
};

/**
 * Serialize a list item to HTML
 * @type {Serializer}
 */

const serialize$6 = SerializerFactory().matchType(BLOCKS.LIST_ITEM).then(state => {
  const node = state.peek();
  let inner = state.serialize(node.nodes);
  let className = '';
  const isTaskList = node.data.has('checked');
  const isChecked = node.data.get('checked');

  if (isTaskList) {
    className = ' class="task-list-item"';
    inner = "<input type=\"checkbox\" class=\"task-list-item-checkbox\"".concat(isChecked ? ' checked' : '', " disabled /> ").concat(inner);
  }

  return state.shift().write("<li".concat(className, ">").concat(inner, "</li>\n"));
});
var listitem = {
  serialize: serialize$6
};

/**
 * Serialize an unstyled block to HTML
 * @type {Serializer}
 */

const serialize$7 = SerializerFactory().matchType(BLOCKS.TEXT).then(state => {
  // Ignore the block, but still serialize its content
  const node = state.peek();
  return state.shift().write(state.serialize(node.nodes));
});
var unstyled = {
  serialize: serialize$7
};

/**
 * Serialize a footnote block to HTML
 * @type {Serializer}
 */

const serialize$8 = SerializerFactory().matchType(BLOCKS.FOOTNOTE).then(state => {
  const node = state.peek();
  const text = state.serialize(node.nodes);
  const refname = node.data.get('id');
  return state.shift().write("<blockquote id=\"fn_".concat(refname, "\">\n<sup>").concat(refname, "</sup>. ").concat(text, "\n<a href=\"#reffn_").concat(refname, "\" title=\"Jump back to footnote [").concat(refname, "] in the text.\"> &#8617;</a>\n</blockquote>\n"));
});
var footnote = {
  serialize: serialize$8
};

/**
 * Serialize an HTML block to HTML (pretty easy, huh?)
 * @type {Serializer}
 */

const serialize$9 = SerializerFactory().matchType(BLOCKS.HTML).then(state => {
  const node = state.peek();
  return state.shift().write("".concat(node.data.get('html'), "\n\n"));
});
var html = {
  serialize: serialize$9
};

var blocks = [paragraph, hr, blockquote, code, heading, list, listitem, unstyled, table.table, table.row, table.cell, footnote, html];

/**
 * Escape all text leaves during serialization.
 *
 * @type {Serializer}
 */

const serialize$a = SerializerFactory().transformText((state, leaf) => {
  const {
    text
  } = leaf;
  return leaf.merge({
    text: escape(text)
  });
});
var escape$1 = {
  serialize: serialize$a
};

/**
 * Serialize an inline code to HTML
 * @type {Serializer}
 */

const serialize$b = SerializerFactory().transformMarkedLeaf(MARKS.CODE, (state, text, mark) => "<code>".concat(text, "</code>"));
var code$1 = {
  serialize: serialize$b
};

/**
 * Serialize a bold text to HTML
 * @type {Serializer}
 */

const serialize$c = SerializerFactory().transformMarkedLeaf(MARKS.BOLD, (state, text, mark) => "<b>".concat(text, "</b>"));
var bold = {
  serialize: serialize$c
};

/**
 * Serialize a italic text to HTML
 * @type {Serializer}
 */

const serialize$d = SerializerFactory().transformMarkedLeaf(MARKS.ITALIC, (state, text, mark) => "<em>".concat(text, "</em>"));
var italic = {
  serialize: serialize$d
};

/**
 * Serialize a strikethrough text to HTML
 * @type {Serializer}
 */

const serialize$e = SerializerFactory().transformMarkedLeaf(MARKS.STRIKETHROUGH, (state, text, mark) => "<del>".concat(text, "</del>"));
var strikethrough = {
  serialize: serialize$e
};

/**
 * Serialize a text node to HTML
 * @type {Serializer}
 */

const serialize$f = SerializerFactory().matchObject('text').then(state => {
  const node = state.peek();
  let {
    text
  } = node; // Hard-line breaks are newline in text nodes

  text = text.replace(/(?:\r\n|\r|\n)/g, '<br />');
  return state.shift().write(text);
});
var text = {
  serialize: serialize$f
};

/**
 * Serialize an image to HTML
 * @type {Serializer}
 */

const serialize$g = SerializerFactory().matchType(INLINES.IMAGE).then(serializeTag('img', {
  isSingleTag: true,
  getAttrs: node => ({
    src: node.data.get('src'),
    alt: node.data.get('alt')
  })
}));
var image = {
  serialize: serialize$g
};

/**
 * Serialize a link to HTML
 * @type {Serializer}
 */

const serialize$h = SerializerFactory().matchType(INLINES.LINK).then(serializeTag('a', {
  getAttrs: (_ref) => {
    let {
      data
    } = _ref;
    return {
      href: data.get('href') || '',
      title: data.get('title') || undefined
    };
  }
}));
var link = {
  serialize: serialize$h
};

/**
 * Serialize a inline footnote reference to HTML
 * @type {Serializer}
 */

const serialize$i = SerializerFactory().matchType(INLINES.FOOTNOTE_REF).then(state => {
  const node = state.peek();
  const refname = node.data.get('id');
  return state.shift().write("<sup><a href=\"#fn_".concat(refname, "\" id=\"reffn_").concat(refname, "\">").concat(refname, "</a></sup>"));
});
var footnoteRef = {
  serialize: serialize$i
};

/**
 * Serialize an HTML inline to HTML
 * @type {Serializer}
 */

const serialize$j = SerializerFactory().matchType(INLINES.HTML).then(state => {
  const node = state.peek();
  const {
    html,
    openingTag,
    closingTag,
    innerHtml
  } = node.data.toObject();

  if (html) {
    // Legacy format
    return state.shift().write(html);
  } else if (innerHtml) {
    return state.shift().write(openingTag).write(innerHtml).write(closingTag);
  }

  return state.shift().write(openingTag).write(state.serialize(node.nodes)).write(closingTag);
});
var html$1 = {
  serialize: serialize$j
};

var inlines = [escape$1, code$1, bold, italic, strikethrough, text, image, link, footnoteRef, html$1];

const INLINE_TAGS = {
  a: INLINES.LINK,
  img: INLINES.IMAGE
};
const BLOCK_TAGS = {
  h1: BLOCKS.HEADING_1,
  h2: BLOCKS.HEADING_2,
  h3: BLOCKS.HEADING_3,
  h4: BLOCKS.HEADING_4,
  h5: BLOCKS.HEADING_5,
  h6: BLOCKS.HEADING_6,
  pre: BLOCKS.CODE,
  blockquote: BLOCKS.BLOCKQUOTE,
  p: BLOCKS.PARAGRAPH,
  hr: BLOCKS.HR,
  table: BLOCKS.TABLE,
  tr: BLOCKS.TABLE_ROW,
  th: BLOCKS.TABLE_CELL,
  td: BLOCKS.TABLE_CELL,
  ul: BLOCKS.UL_LIST,
  ol: BLOCKS.OL_LIST,
  li: BLOCKS.LIST_ITEM
};
const MARK_TAGS = {
  b: MARKS.BOLD,
  strong: MARKS.BOLD,
  del: MARKS.STRIKETHROUGH,
  em: MARKS.ITALIC,
  code: MARKS.CODE
};
const MARK_CLASSNAME = {
  'line-through': MARKS.STRIKETHROUGH
};
const TAGS_TO_DATA = {
  a(attribs) {
    return {
      href: attribs.href,
      title: attribs.alt || ''
    };
  },

  img(attribs) {
    return {
      src: attribs.src,
      title: attribs.alt || ''
    };
  },

  h1: resolveHeadingAttrs,
  h2: resolveHeadingAttrs,
  h3: resolveHeadingAttrs,
  h4: resolveHeadingAttrs,
  h5: resolveHeadingAttrs,
  h6: resolveHeadingAttrs
};

function resolveHeadingAttrs(attribs) {
  return attribs.id ? {
    id: attribs.id
  } : {};
}
/**
 * Flatten a block node into a list of inline nodes.
 * @param  {Node} node
 * @return {List<Node>} nodes
 */


function selectInlines(node) {
  if (node.object !== 'block') {
    return Immutable.List([node]);
  }

  const {
    nodes
  } = node;
  return nodes.reduce((result, child) => result.concat(selectInlines(child)), Immutable.List());
}
/**
 * Get all marks from a class name.
 * @param {String} className
 * @return {Array<Mark>}
 */


function getMarksForClassName() {
  let className = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
  const classNames = className.split(' ');
  const result = [];
  classNames.forEach(name => {
    const type = MARK_CLASSNAME[name];

    if (!type) {
      return;
    }

    const mark = slate.Mark.create({
      type
    });
    result.push(mark);
  });
  return result;
}
/**
 * Returns the accepted block types for the given container
 */


function acceptedBlocks(container) {
  return CONTAINERS[container.type || container.object];
}
/**
 * True if the node is a block container node
 */


function isBlockContainer(node) {
  return Boolean(acceptedBlocks(node));
}
/**
 * Returns the default block type for a block container
 */


function defaultBlockType(container) {
  return acceptedBlocks(container)[0];
}
/**
 * True if `block` can contain `node`
 */


function canContain(block, node) {
  if (node.object === 'inline' || node.object === 'text') {
    return LEAFS[block.type];
  }

  const types = acceptedBlocks(block);
  return types && types.indexOf(node.type) !== -1;
}
/*
 * sanitizeSpaces replace non-breaking spaces with regular space
 * non-breaking spaces (aka &nbsp;) are sources of many problems & quirks
 * &nbsp; in ascii is `0xA0` or `0xC2A0` in utf8
 * @param {String} str
 * @return {String}
 */


function sanitizeSpaces(str) {
  return str.replace(/\xa0/g, ' ');
}
/**
 * @param {String} tagName The tag name
 * @param {Object} attrs The tag's attributes
 * @return {Object} data
 */


function getData(tagName, attrs) {
  return (TAGS_TO_DATA[tagName] || (() => {}))(attrs);
}
/**
 * @param {String} nodeType
 * @return {Boolean} isVoid
 */


function isVoid(nodeType) {
  return Boolean(VOID[nodeType]);
}
/**
 * Returns the list of lines in the string
 * @param {String} text
 * @param {String} sep?
 * @return {List<String>}
 */


function splitLines(text) {
  let sep = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : detectNewLine(text) || '\n';
  return Immutable.List(text.split(sep));
}
/**
 * Update the node on top of the stack with the given node
 * @param {Stack} stack
 * @param {Node} node
 * @return {Stack}
 */


function setNode(stack, node) {
  return stack.pop().push(node);
}
/**
 * Append a node child to the current parent node
 * @param {Stack} stack
 * @param {Node} node
 * @return {Stack}
 */


function appendNode(stack, node) {
  const parent = stack.peek();
  let {
    nodes
  } = parent; // If parent is not a block container

  if (!isBlockContainer(parent) && node.object == 'block') {
    // Discard all blocks
    nodes = nodes.concat(selectInlines(node));
  } // Wrap node if type is not allowed
  else if (isBlockContainer(parent) && (node.object !== 'block' || !canContain(parent, node))) {
      const previous = parent.nodes.last();

      if (previous && canContain(previous, node)) {
        // Reuse previous block if possible
        nodes = nodes.pop().push(previous.set('nodes', previous.nodes.push(node)));
      } else {
        // Else insert a default wrapper
        const wrapper = slate.Block.create({
          type: defaultBlockType(parent),
          nodes: [node]
        });
        nodes = nodes.push(wrapper);
      }
    } else {
      nodes = nodes.push(node);
    }

  return setNode(stack, parent.merge({
    nodes
  }));
}
/**
 * Push a new node, as current parent. We started parsing it
 * @param {Stack} stack
 * @param {Node} node
 * @return {Stack}
 */


function pushNode(stack, node) {
  return stack.push(node);
}
/**
 * Pop the current parent node. Because we're done parsing it
 * @param {Stack} stack
 * @return {Stack}
 */


function popNode(stack) {
  return appendNode(stack.pop(), stack.peek());
}
/**
 * Parse an HTML string into a document
 * @param {String} str
 * @return {Document}
 */


function parse(str) {
  // Cleanup whitespaces
  const cleanedUpStr = htmlclean(str); // For convenience, starts with a root node

  const root = slate.Document.create({}); // The top of the stack always hold the current parent
  // node. Should never be empty.

  let stack = Immutable.Stack().push(root); // The current marks

  let marks = Immutable.Set();
  const parser = new htmlparser2.Parser({
    onopentag(tagName, attribs) {
      if (BLOCK_TAGS[tagName]) {
        const type = BLOCK_TAGS[tagName];
        const block = slate.Block.create({
          data: getData(tagName, attribs),
          isVoid: isVoid(type),
          type
        });
        stack = pushNode(stack, block);
      } else if (INLINE_TAGS[tagName]) {
        const type = INLINE_TAGS[tagName];
        const inline = slate.Inline.create({
          data: getData(tagName, attribs),
          isVoid: isVoid(type),
          type
        });
        stack = pushNode(stack, inline);
      } else if (MARK_TAGS[tagName]) {
        const mark = slate.Mark.create({
          data: getData(tagName, attribs),
          type: MARK_TAGS[tagName]
        });
        marks = marks.add(mark);
      } else if (tagName == 'br') {
        const textNode = slate.Text.create({
          text: '\n',
          marks
        });
        stack = appendNode(stack, textNode);
      } // else ignore
      // Parse marks from the class name


      const newMarks = getMarksForClassName(attribs.class);
      marks = marks.concat(newMarks);
    },

    ontext(text) {
      const cleanText = sanitizeSpaces(text);
      const textNode = slate.Text.create({
        text: cleanText,
        marks
      });
      stack = appendNode(stack, textNode);
    },

    onclosetag(tagName) {
      if (BLOCK_TAGS[tagName] || INLINE_TAGS[tagName]) {
        const parent = stack.peek(); // Special rule for code blocks that we must split in lines

        if (parent.type === BLOCKS.CODE) {
          let lines = splitLines(parent.text); // Remove trailing newline

          if (lines.last().trim() === '') {
            lines = lines.skipLast(1);
          }

          stack = setNode(stack, parent.merge({
            nodes: lines.map(line => // Create a code line
            slate.Block.create({
              type: BLOCKS.CODE_LINE,
              nodes: [slate.Text.create(line)]
            }))
          }));
        }

        stack = popNode(stack);
      } else if (MARK_TAGS[tagName]) {
        const type = MARK_TAGS[tagName];
        marks = marks.filter(mark => mark.type !== type);
      } // else ignore

    }

  }, {
    decodeEntities: true
  });
  parser.write(cleanedUpStr);
  parser.end();

  if (stack.size !== 1) {
    throw new Error('Invalid HTML. A tag might not have been closed correctly.');
  }

  return stack.peek();
}

/**
 * Serialize a document to HTML.
 * @type {Serializer}
 */

const serialize$k = SerializerFactory().matchObject('document').then(state => {
  const node = state.peek();
  const {
    nodes
  } = node;
  const text = state.use('block').serialize(nodes);
  const prettified = Html.prettyPrint(text, {
    indent_size: 2
  });
  return state.shift().write(prettified);
});
/**
 * Deserialize an HTML document.
 * @type {Deserializer}
 */

const deserialize = DeserializerFactory().then(state => {
  const {
    text
  } = state;
  const document = parse(text);
  return state.skip(text.length).push(document);
});
var document = {
  serialize: serialize$k,
  deserialize
};

/**
 * Default rule to serialize to HTML, that simply ignore the node.
 * Should be removed in the end.
 * @type {Serializer}
 */

const serialize$l = SerializerFactory().then(state => state.shift());
var ignoreNode = {
  serialize: serialize$l
};

const ALL = [...blocks, ...inlines, ignoreNode // Default catch-all rule
]; // We don't use groups of rules such as 'block' and 'inline' for
// deserialization, because we have a single deserialization rule 'document'.
//
// For serialization, there is no ambiguity in the Slate
// format, so we always use all the rules at the same time.

const HTMLParser = {
  document: [document],
  block: ALL
};

/**
 * Deserialize the inner text of a code block
 * @param  {String} text
 * @return {Array<Node>} nodes
 */

function deserializeCodeLines(text) {
  const lines = splitLines$1(text);
  return lines.map(line => slate.Block.create({
    type: BLOCKS.CODE_LINE,
    nodes: [slate.Text.create(line)]
  }));
}

function re(str) {
  return new RegExp(escapeStringRegexp(str), 'g');
}
/**
 * Escape a string using a map of replacements.
 * @param  {Map} replacements
 * @param  {String} text
 * @return {String}
 */


function escapeWith(replacements, text) {
  return replacements.reduce((out, value, key) => out.replace(re(key), value), text);
}
/**
 * Unescape a string using a map of replacements.
 * @param  {Map} replacements
 * @param  {String} text
 * @return {String}
 */

function unescapeWith(replacements, text) {
  return escapeWith(replacements.flip(), text);
}

// See http://spec.commonmark.org/0.15/#backslash-escapes

const REPLACEMENTS_ESCAPE = Immutable.Map([['*', '\\*'], ['#', '\\#'], // GitHub doesn't escape slashes, and render the backslash in that cause
// [ '/', '\\/' ],
['(', '\\('], [')', '\\)'], ['[', '\\['], [']', '\\]'], ['`', '\\`'], ['<', '&lt;'], ['>', '&gt;'], ['_', '\\_'], ['|', '\\|']]); // We do not escape all characters, but we want to unescape them all.

const REPLACEMENTS_UNESCAPE = REPLACEMENTS_ESCAPE.merge({
  ' ': '\\ ',
  '+': '\\+'
}); // Replacements for escaping urls (links and images)

const URL_REPLACEMENTS_UNESCAPE = REPLACEMENTS_UNESCAPE.merge({
  ' ': '%20'
});
const URL_REPLACEMENTS_ESCAPE = Immutable.Map([[' ', '%20'], ['(', '%28'], [')', '%29']]);
/**
 * Escape markdown syntax
 * We escape only basic XML entities
 *
 * @param {String} str
 * @param {Boolean} escapeXML
 * @return {String}
 */

function escape$2(inputStr, escapeXML) {
  const str = escapeWith(REPLACEMENTS_ESCAPE, inputStr);
  return escapeXML === false ? str : entities.encodeXML(str);
}
/**
 * Unescape markdown syntax
 * We unescape all entities (HTML + XML)
 *
 * @param {String} str
 * @return {String}
 */

function unescape(str) {
  return entities.decodeHTML(unescapeWith(REPLACEMENTS_UNESCAPE, str));
}
/**
 * Escape an url
 *
 * @param {String} str
 * @return {String}
 */

function escapeURL(str) {
  return escapeWith(URL_REPLACEMENTS_ESCAPE, str);
}
/**
 * URI decode and unescape an url
 *
 * @param {String} str
 * @return {String}
 */

function unescapeURL(str) {
  let decoded;

  try {
    // If URL is absolute, we shouldn't try to decode it
    // since it doesn't represent a file path but rather a static resource
    decoded = isAbsoluteURL(str) ? str : decodeURI(str);
  } catch (e) {
    if (!(e instanceof URIError)) {
      throw e;
    } else {
      decoded = str;
    }
  }

  return unescapeWith(URL_REPLACEMENTS_UNESCAPE, decoded);
}
/**
 * Create a function to replace content in a regex
 * @param  {RegEx} regex
 * @param  {String} opt
 * @return {Function(String, String)}
 */

function replace(regex) {
  let opt = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
  let {
    source
  } = regex;
  return function self(name, val) {
    if (!name) return new RegExp(source, opt);
    let {
      source: valSource = val
    } = val;
    valSource = valSource.replace(/(^|[^[])\^/g, '$1');
    source = source.replace(name, valSource);
    return self;
  };
}
/**
 * Resolve a reference (links and images) in a state.
 * @param  {State} state
 * @param  {String} refID
 * @return {Object} props?
 */

function resolveRef(state, refID) {
  const refs = state.getProp('refs');
  const normRefID = refID.replace(/\s+/g, ' ').toLowerCase();
  const data = refs.get(normRefID);

  if (!data) {
    return undefined;
  }

  return Immutable.Map(data).filter(Boolean);
}
/**
 * Wrap inline content with the provided characters.
 * e.g wrapInline('bold content', '**')
 * @param {String} str
 * @param {String} chars
 */

function wrapInline(str, chars) {
  return str.replace(/^\s*/, spaces => "".concat(spaces).concat(chars)).replace(/\s*$/, spaces => "".concat(chars).concat(spaces));
}

const heading$1 = {
  // Normal heading "# Hello"
  normal: /^ *(#{1,6}) *([^\n]*?) *(?:\n|$)/,
  // 2 Lines heading
  line: /^([^\n]+)\n *(=|-){2,} *(?:\n|$)/,
  // ID in heading
  id: /({#)(.+)(})/g
};

const inline = {
  escape: /^\\([\\`*{}[\]()#$+\-.!_>|])/,
  autolink: /^<([^ >]+(@|:\/)[^ >]+)>/,
  url: /^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/,
  htmlComment: /^<!--[\s\S]*?-->/,
  htmlTagPair: /^<(\w+(?!:\/|[^\w\s@]*@)\b)+?((?:"[^"]*"|'[^']*'|{[^}]*}|[^'">])*?)>([\s\S]*?)<\/\1>/,
  htmlSelfClosingTag: /^<(\w+(?!:\/|[^\w\s@]*@)\b)(?:"[^"]*"|'[^']*'|{[^}]*}|[^'">/])*?\/?>/,
  link: /^!?\[(inside)\]\(href\)/,
  reflink: /^!?\[(inside)\]\s*\[([^\]]*)\]/,
  nolink: /^!?\[((?:\[[^\]]*\]|[^[\]])*)\]/,
  reffn: /^!?\[\^(inside)\]/,
  strong: /^__([\s\S]+?)__(?!_)|^\*\*([\s\S]+?)\*\*(?!\*)/,
  em: /^\b_((?:__|[\s\S])+?)_\b|^\*((?:\*\*|[\s\S])+?)\*(?!\*)/,
  code: /^(`+)\s*([\s\S]*?[^`])\s*\1(?!`)/,
  br: /^ {2,}\n(?!\s*$)/,
  del: /^~~(?=\S)([\s\S]*?\S)~~/,
  text: /^[\s\S]+?(?=[\\<![_*`$]| {2,}\n|$)/,
  math: /^\$\$([^$]+)\$\$/,
  variable: /^{{\s*(.*?)\s*(?=[#%}]})}}/
}; // Escaped chars: match all characters + escaped characters

const escapedButQuotesAndParen = /(?:\\\(|\\\)|\\"|\\'|[^()"'])/;
const escapedButQuotes = /(?:\\\(|\\\)|\\"|\\'|[^"'])/;
inline._inside = /(?:\[[^\]]*\]|[^[\]]|\](?=[^[]*\]))*/;
inline._href = /\s*<?(escapedHref*)>?(?:\s+['"](escapedTitle*?)['"])?\s*/;
inline._href = replace(inline._href)('escapedHref', escapedButQuotesAndParen)('escapedTitle', escapedButQuotes)();
inline.link = replace(inline.link)('inside', inline._inside)('href', inline._href)();
inline.reflink = replace(inline.reflink)('inside', inline._inside)();
inline.reffn = replace(inline.reffn)('inside', inline._inside)(); // Update RegExp for text/escape to stop at strikethrough

inline.text = replace(inline.text)(']|', '~]|')('|', '|https?://|')('~]|', "~]|".concat(inline.variable.source, "|"))();
inline.escape = replace(inline.escape)('])', '~|])')();

const pipe = /\|/;
const table$1 = {
  cellSeparation: /^pipe/,
  nptable: /^ *(\S.*\|.*)\n *([-:]+ *\|[-| :]*)\n((?:.*\|.*(?:\n|$))*)\n*/,
  normal: /^ *\|(.+)\n *\|( *[-:]+[-| :]*)\n((?: *\|.*(?:\n|$))*)\n*/,
  // Split a row into cells
  cell: / *pipe */,
  // Replace trailing pipe
  trailingPipe: /^ *| *pipe *$/g,
  // Remove trailing pipe of align
  trailingPipeAlign: /^ *|pipe *$/g,
  // Remove trailing pipe of cell
  trailingPipeCell: /(?: *pipe *)?\n$/,
  // Remove edge pipes of a cell
  edgePipesCell: /^ *pipe *| *pipe *$/g,
  // Alignements
  alignRight: /^ *-+: *$/,
  alignCenter: /^ *:-+: *$/,
  alignLeft: /^ *:-+ *$/
};
table$1.cellSeparation = replace(table$1.cellSeparation)(/pipe/g, pipe)();
table$1.cell = replace(table$1.cell)(/pipe/g, pipe)();
table$1.trailingPipe = replace(table$1.trailingPipe, 'g')(/pipe/g, pipe)();
table$1.trailingPipeAlign = replace(table$1.trailingPipeAlign, 'g')(/pipe/g, pipe)();
table$1.trailingPipeCell = replace(table$1.trailingPipeCell, 'g')(/pipe/g, pipe)();
table$1.edgePipesCell = replace(table$1.edgePipesCell, 'g')(/pipe/g, pipe)();
table$1.cellInlineText = replace(inline.text)(']|', '|]|')();
table$1.cellInlineEscape = inline.escape;

/* eslint-disable no-unexpected-multiline, no-spaced-func */
const block = {
  newline: /^\n+/,
  code: /^((?: {4}|\t)[^\n]+\n*)+/,
  hr: /^( *[-*_]){3,} *(?:\n|$)/,
  blockquote: /^( *>[^\n]+(\n(?!def|customBlock)[^\n]+)*\n*)+/,
  html: /^ *(?:comment *(?:\n|\s*$)|closed *(?:\n{2,}|\s*$)|closing *(?:\n{2,}|\s*$))/,
  // [someref]: google.com
  def: /^ {0,3}\[([^\]]+)\]: *<?([^\s>]+)>?(?: +["(]([^\n]+)[")])? *(?:\n|$)/,
  footnote: /^\[\^([^\]]+)\]: ([^\n]+)/,
  paragraph: /^((?:(?:(?!notParagraphPart)[^\n])+\n?(?!notParagraphNewline))+)\n*/,
  text: /^[^\n]+/,
  fences: /^ *(`{3,}|~{3,})[ .]*(\S+)? *\n([\s\S]*?)\s*\1 *(?:\n+|$)/,
  yamlHeader: /^ *(?=```)/,
  math: /^ *(\${2,}) *(\n+[\s\S]+?)\s*\1 *(?:\n|$)/,
  list: {
    block: /^( *)(bullet) [\s\S]+?(?:hr|def|\n{2,}(?! )(?!\1allbull )\n*|\s*$|(?=\ncustomBlock))/,
    item: /^( *)(bullet) [^\n]*(?:\n(?!\1allbull )[^\n]*)*/,
    bullet: /(?:[*+-]|\d+\.)/,
    bullet_ul: /(?:\d+\.)/,
    bullet_ol: /(?:[*+-])/,
    checkbox: /^\[([ x])\] +/,
    bulletAndSpaces: /^ *([*+-]|\d+\.) +/
  },
  customBlock: /^{% *(.*?) *(?=[#%}]})%}/,
  comment: /^{#\s*(.*?)\s*(?=[#%}]})#}/
}; // Any string matching these inside a line will marks the end of the current paragraph

const notParagraphPart = 'customBlock'; // Any line starting with these marks the end of the previous paragraph.

const notParagraphNewline = 'hr|heading|lheading|blockquote|tag|def|math|comment|customBlock|table|tablenp|fences|ol';

const _tag = '(?!(?:' + 'a|em|strong|small|s|cite|q|dfn|abbr|data|time|code' + '|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo' + '|span|br|wbr|ins|del|img)\\b)\\w+(?!:\\/|[^\\w\\s@]*@)\\b';

block.list.item = replace(block.list.item, 'gm')(/allbull/g, block.list.bullet)(/bullet/g, block.list.bullet)();
block.blockquote = replace(block.blockquote)('def', block.def)('customBlock', block.customBlock)();
block.list.block = replace(block.list.block)(/allbull/g, block.list.bullet)('hr', '\\n+(?=\\1?(?:[-*_] *){3,}(?:\\n+|$))')('def', "\\n+(?=".concat(block.def.source, ")"))('footnote', block.footnote)('customBlock', block.customBlock)();
block.list.block_ul = replace(block.list.block)(/bullet/g, block.list.bullet_ul)();
block.list.block_ol = replace(block.list.block)(/bullet/g, block.list.bullet_ol)();
block.list.block = replace(block.list.block)(/bullet/g, block.list.bullet)();
block.html = replace(block.html)('comment', /<!--[\s\S]*?-->/)('closed', /<(tag)(?:[^<]|{[^}]*})*?(?:>)[\s\S]+?<\/\1>/)('closing', /<tag(?:"[^"]*"|'[^']*'|{[^}]*}|[^'">/])*?\/?>/)(/tag/g, _tag)();
block.paragraph = replace(block.paragraph)('notParagraphPart', notParagraphPart)('notParagraphNewline', notParagraphNewline)('hr', block.hr)('heading', heading$1.normal)('lheading', heading$1.line)('blockquote', block.blockquote)('tag', "<".concat(_tag))('def', block.def)('math', block.math)('customBlock', block.customBlock)('comment', block.comment)('table', table$1.normal)('tablenp', table$1.nptable)('fences', block.fences.source.replace('\\1', '\\2'))('ol', block.list.block_ol.source.replace('\\1', '\\3'))();

/**
 * Serialize an HR to markdown
 * @type {Serializer}
 */

const serialize$m = SerializerFactory().matchType(BLOCKS.HR).then(state => {
  const {
    depth,
    text
  } = state;
  const isFirstNode = depth == 2 && !text;
  return state.shift().write("".concat(isFirstNode ? '\n' : '', "---\n\n"));
});
/**
 * Deserialize an HR to a node.
 * @type {Deserializer}
 */

const deserialize$1 = DeserializerFactory().matchRegExp(block.hr, (state, match) => {
  const node = slate.Block.create({
    type: BLOCKS.HR,
    isVoid: true
  });
  return state.push(node);
});
var hr$1 = {
  serialize: serialize$m,
  deserialize: deserialize$1
};

const TYPES = [BLOCKS.HEADING_1, BLOCKS.HEADING_2, BLOCKS.HEADING_3, BLOCKS.HEADING_4, BLOCKS.HEADING_5, BLOCKS.HEADING_6];
/**
 * Serialize an heading node to markdown
 * @type {Serializer}
 */

const serialize$n = SerializerFactory().matchType(TYPES).then(state => {
  const node = state.peek();
  const {
    type,
    data
  } = node;
  const id = data.get('id');
  const depth = TYPES.indexOf(type);
  const prefix = Array(depth + 2).join('#');
  let inner = state.use('inline').serialize(node.nodes);

  if (id) {
    inner = "".concat(inner, " <a id=\"").concat(escape(id), "\"></a>");
  }

  return state.shift().write("".concat(prefix, " ").concat(inner, "\n\n"));
});
/**
 * Deserialize a normal heading (starting with "#..") and headings using
 * line syntax to a node.
 * @type {Deserializer}
 */

const deserializeNormal = DeserializerFactory().matchRegExp(heading$1.normal, (state, match) => {
  const level = match[1].length;
  return parseHeadingText(state, level, match[2]);
});
/**
 * Deserialize a line heading.
 * @type {Deserializer}
 */

const deserializeLine = DeserializerFactory().matchRegExp(heading$1.line, (state, match) => {
  const level = match[2] === '=' ? 1 : 2;
  return parseHeadingText(state, level, match[1]);
});
const deserialize$2 = DeserializerFactory().use([deserializeNormal, deserializeLine]);
/**
 * Trim text left on a List of Nodes
 * @param  {List<Node>} nodes
 * @return {List<Node>}
 */

function trimLeftNodesText(nodes) {
  if (nodes.size === 0) {
    return nodes;
  }

  const firstNode = nodes.first(); // We don't want to trim complicated blocks

  if (firstNode.object !== 'text') {
    return nodes;
  }

  const leaves = firstNode.getLeaves();
  const firstLeaf = leaves.first();
  return nodes.rest().unshift(firstNode.setLeaves(leaves.rest().unshift(firstLeaf.merge({
    text: firstLeaf.text.trimLeft()
  }))));
}
/**
 * Trim text right on a List of Nodes
 * @param  {List<Node>} nodes
 * @return {List<Node>}
 */


function trimRightNodesText(nodes) {
  if (nodes.size === 0) {
    return nodes;
  }

  const lastNode = nodes.last(); // We don't want to trim complicated blocks

  if (lastNode.object !== 'text') {
    return nodes;
  }

  const leaves = lastNode.getLeaves();
  const lastLeaf = leaves.last();
  return nodes.butLast().push(lastNode.setLeaves(leaves.butLast().push(lastLeaf.merge({
    text: lastLeaf.text.trimRight()
  }))));
}
/**
 * Parse inner text of header to extract ID entity
 * @param  {State} state
 * @param  {Number} level
 * @param  {String} initialText
 * @return {State}
 */


function parseHeadingText(state, level, initialText) {
  let text = initialText;
  heading$1.id.lastIndex = 0;
  const matchId = heading$1.id.exec(text);
  let data;

  if (matchId) {
    // Remove ID from text
    text = text.replace(matchId[0], '').trim();
  } else {
    text = text.trim();
  }

  const newState = state.down({
    text
  }).use('inline').lex(); // Use the custom ID, or use the id of the last anchor found (see anchors tests)

  const id = matchId && matchId[2] || newState.getProp('lastAnchorId') || null;

  if (id) {
    data = {
      id
    };
  }

  const trimmedLeftNodes = trimLeftNodesText(newState.nodes);
  const trimmedNodes = trimRightNodesText(trimmedLeftNodes);
  const node = slate.Block.create({
    type: TYPES[level - 1],
    nodes: trimmedNodes,
    data
  });
  return newState.up() // We have consumed any anchor ID that was seen recently
  .setProp('lastAnchorId', null).push(node);
}

var heading$2 = {
  serialize: serialize$n,
  deserialize: deserialize$2
};

/**
 * Serialize a paragraph to markdown
 * @type {Serializer}
 */

const serialize$o = SerializerFactory().matchType(BLOCKS.PARAGRAPH).then(state => {
  const node = state.peek();
  const inner = state.use('inline').setProp('hardlineBreak', true).serialize(node.nodes);
  return state.shift().write("".concat(inner, "\n\n"));
});
/**
 * Deserialize a paragraph to a node.
 * @type {Deserializer}
 */

const deserialize$3 = DeserializerFactory().matchRegExp(block.paragraph, (state, match) => {
  const parentDepth = state.depth - 1;
  const isInBlockquote = state.getProp('blockquote') === parentDepth;
  const isInLooseList = state.getProp('looseList') === parentDepth;
  const isTop = state.depth === 2;

  if (!isTop && !isInBlockquote && !isInLooseList) {
    return undefined;
  }

  const text = collapseWhiteSpaces(match[1]);
  const newState = state.down({
    text
  }).use('inline').lex();
  const {
    nodes
  } = newState;
  const node = slate.Block.create({
    type: BLOCKS.PARAGRAPH,
    nodes
  });
  return newState.up().push(node);
});
/*
 * Collapse newlines and whitespaces into a single whitespace. But preserve
 * hardline breaks '··⏎'
 */

function collapseWhiteSpaces(text) {
  return text // Remove hardline breaks
  .split('  \n').map(part => part.trim().replace(/\s+/g, ' ')) // Restore hardline breaks
  .join('  \n').trim();
}

var paragraph$1 = {
  serialize: serialize$o,
  deserialize: deserialize$3
};

/**
 * Serialize a code block to markdown
 * @type {Serializer}
 */

const serialize$p = SerializerFactory().matchType(BLOCKS.CODE).then(state => {
  const node = state.peek();
  const {
    nodes,
    data
  } = node; // Escape the syntax
  // http://spec.commonmark.org/0.15/#example-234

  const syntax = escape$2(data.get('syntax') || ''); // Get inner content and number of fences

  const innerText = nodes.map(line => line.text).join('\n');
  const hasFences = innerText.indexOf('`') >= 0;
  let output; // Use fences if syntax is set

  if (!hasFences || syntax) {
    output = '```'.concat(syntax || '', "\n").concat(innerText, "\n", '```', "\n\n");
    return state.shift().write(output);
  }

  output = "".concat(nodes.map((_ref) => {
    let {
      text
    } = _ref;

    if (!text.trim()) {
      return '';
    }

    return "    ".concat(text);
  }).join('\n'), "\n\n");
  return state.shift().write(output);
});
/**
 * Deserialize a code block to a node.
 * @type {Deserializer}
 */

const deserializeFences = DeserializerFactory().matchRegExp(block.fences, (state, match) => {
  // Extract code block text, and trim empty lines
  const text = trimNewlines(match[3]); // Extract language syntax

  let data;

  if (match[2]) {
    data = {
      syntax: unescape(match[2].trim())
    };
  } // Split lines


  const nodes = deserializeCodeLines(text);
  const node = slate.Block.create({
    type: BLOCKS.CODE,
    nodes,
    data
  });
  return state.push(node);
});
/**
 * Deserialize a code block to a node.
 * @type {Deserializer}
 */

const deserializeTabs = DeserializerFactory().matchRegExp(block.code, (state, match) => {
  let inner = match[0]; // Remove indentation

  inner = inner.replace(/^( {4}|\t)/gm, ''); // No pedantic mode

  inner = inner.replace(/\n+$/, ''); // Split lines

  const nodes = deserializeCodeLines(inner);
  const node = slate.Block.create({
    type: BLOCKS.CODE,
    nodes
  });
  return state.push(node);
});
const deserialize$4 = DeserializerFactory().use([deserializeFences, deserializeTabs]);
var codeBlock = {
  serialize: serialize$p,
  deserialize: deserialize$4
};

/**
 * Serialize a blockquote node to markdown
 * @type {Serializer}
 */

const serialize$q = SerializerFactory().matchType(BLOCKS.BLOCKQUOTE).then(state => {
  const node = state.peek();
  const inner = state.use('block').serialize(node.nodes);
  const lines = splitLines$1(inner.trim());
  const output = lines.map(line => line ? "> ".concat(line) : '>').join('\n');
  return state.shift().write("".concat(output, "\n\n"));
});
/**
 * Deserialize a blockquote to a node.
 * @type {Deserializer}
 */

const deserialize$5 = DeserializerFactory().matchRegExp(block.blockquote, (state, match) => {
  const inner = match[0].replace(/^ *> ?/gm, '').trim();
  const nodes = state.use('block') // Signal to children that we are in a blockquote
  .setProp('blockquote', state.depth).deserialize(inner);
  const node = slate.Block.create({
    type: BLOCKS.BLOCKQUOTE,
    nodes
  });
  return state.push(node);
});
var blockquote$1 = {
  serialize: serialize$q,
  deserialize: deserialize$5
};

/**
 * Serialize a unstyled node to markdown
 * @type {Serializer}
 */

const serialize$r = SerializerFactory().matchType(BLOCKS.TEXT).then(state => {
  const node = state.peek();
  const inner = state.use('inline').serialize(node.nodes);
  return state.shift().write("".concat(inner, "\n"));
});
/**
 * Deserialize a unstyle text to a node.
 * @type {Deserializer}
 */

const deserialize$6 = DeserializerFactory().matchRegExp(block.text, (state, match) => {
  const inner = match[0];
  const nodes = state.use('inline').deserialize(inner);
  const node = slate.Block.create({
    type: BLOCKS.TEXT,
    nodes
  });
  return state.push(node);
});
var unstyled$1 = {
  serialize: serialize$r,
  deserialize: deserialize$6
};

/**
 * Serialize a footnote to markdown
 * @type {Serializer}
 */

const serialize$s = SerializerFactory().matchType(BLOCKS.FOOTNOTE).then(state => {
  const node = state.peek();
  const inner = state.use('inline').serialize(node.nodes);
  const id = node.data.get('id');
  return state.shift().write("[^".concat(id, "]: ").concat(inner, "\n\n"));
});
/**
 * Deserialize a footnote to a node.
 * @type {Deserializer}
 */

const deserialize$7 = DeserializerFactory().matchRegExp(block.footnote, (state, match) => {
  const id = match[1];
  const text = match[2];
  const nodes = state.use('inline').deserialize(text);
  const node = slate.Block.create({
    type: BLOCKS.FOOTNOTE,
    nodes,
    data: {
      id
    }
  });
  return state.push(node);
});
var footnote$1 = {
  serialize: serialize$s,
  deserialize: deserialize$7
};

/**
 * Deserialize a table with no leading pipe (gfm) to a node.
 * @type {Deserializer}
 */

const deserializeNoPipe = DeserializerFactory().matchRegExp(table$1.nptable, (state, match) => {
  // Get all non empty lines
  const lines = match[0].split('\n').filter(Boolean);
  const header = lines[0];
  const aligns = lines[1];
  const rows = lines.slice(2);
  const node = parseTable(state, header, aligns, rows);
  return state.push(node);
});
/**
 * Deserialize a normal table to a node.
 * @type {Deserializer}
 */

const deserializeNormal$1 = DeserializerFactory().matchRegExp(table$1.normal, (state, match) => {
  // Get all non empty lines
  const lines = match[0].split('\n').filter(Boolean);
  const header = lines[0];
  const aligns = lines[1];
  const rows = lines.slice(2);
  const node = parseTable(state, header, aligns, rows);
  return state.push(node);
});
/**
 * Serialize a table node to markdown
 * @type {Serializer}
 */

const serialize$t = SerializerFactory().matchType(BLOCKS.TABLE).then(state => {
  const table = state.peek();

  if (mustSerializeAsHTML(table)) {
    // Serialize as HTML
    const htmlState = State.create(HTMLParser);
    const htmlOutput = htmlState.serializeDocument(slate.Document.create({
      nodes: [table]
    }));
    return state.shift().write("".concat(htmlOutput, "\n\n"));
  }

  const {
    data,
    nodes
  } = table;
  const aligns = data.get('aligns');
  const headerRow = nodes.get(0);
  const bodyRows = nodes.slice(1);
  const output = "".concat(rowToText(state, headerRow), "\n").concat(alignsToText(aligns), "\n").concat(bodyRows.map(row => rowToText(state, row)).join('\n'), "\n\n");
  return state.shift().write(output);
});
const deserialize$8 = DeserializerFactory().use([deserializeNoPipe, deserializeNormal$1]);
/**
 * Parse a table into a node.
 * @param  {State} state
 * @param  {String} headerStr
 * @param  {String} alignsStr The line containing the column aligns
 * @param  {String} rowStrs
 * @return {Block} table
 */

function parseTable(state, headerStr, alignsStr, rowStrs) {
  // Header
  const headerRow = parseRow(state, headerStr); // Rows

  const rowTokens = rowStrs.map(rowStr => parseRow(state, rowStr)); // Align for columns

  const alignsCells = rowToCells(alignsStr);
  const aligns = mapAligns(alignsCells);
  return slate.Block.create({
    type: BLOCKS.TABLE,
    data: {
      aligns
    },
    nodes: [headerRow].concat(rowTokens)
  });
}
/**
 * Parse a row from a table into a row node.
 *
 * @param {State} state
 * @param {String} row
 * @return {Node}
 */


function parseRow(state, row) {
  // Split into cells
  const cells = rowToCells(row); // Tokenize each cell

  const cellNodes = cells.map(cell => {
    const text = cell.trim();
    const nodes = state.use('inline').deserialize(text);
    const paragraph = slate.Block.create({
      type: BLOCKS.PARAGRAPH,
      nodes
    });
    return slate.Block.create({
      type: BLOCKS.TABLE_CELL,
      nodes: [paragraph]
    });
  });
  return slate.Block.create({
    type: BLOCKS.TABLE_ROW,
    nodes: cellNodes
  });
}
/**
 * Split a row up into its individual cells
 *
 * @param {String} rowStr
 * @return {Array<String>}
 */


function rowToCells(rowStr) {
  const cells = [];
  const trimmed = rowStr.trim();
  let lastSep = 0;

  for (let i = 0; i < trimmed.length; i += 1) {
    const prevIdx = i === 0 ? 0 : i - 1;
    const isSep = trimmed[i] === '|';
    const isNotEscaped = trimmed[prevIdx] !== '\\';

    if (isSep && isNotEscaped) {
      // New cell
      if (i > 0 && i < trimmed.length) {
        cells.push(trimmed.slice(lastSep, i));
      }

      lastSep = i + 1;
    }
  } // Last cell


  if (lastSep < trimmed.length) {
    cells.push(trimmed.slice(lastSep));
  }

  return cells;
}
/**
 * Detect alignement per column
 *
 * @param {Array<String>}
 * @return {Array<String|null>}
 */


function mapAligns(aligns) {
  return aligns.map(s => {
    if (table$1.alignRight.test(s)) {
      return TABLE_ALIGN.RIGHT;
    } else if (table$1.alignCenter.test(s)) {
      return TABLE_ALIGN.CENTER;
    } else if (table$1.alignLeft.test(s)) {
      return TABLE_ALIGN.LEFT;
    }

    return null;
  });
}
/**
 * Render a row to text.
 *
 * @param {State} state
 * @param {Node} row
 * @return {String} text
 */


function rowToText(state, row) {
  const {
    nodes
  } = row;
  return "| ".concat(nodes.map(cell => cellToText(state, cell)).join(' | '), " |");
}
/**
 * Render a cell to text.
 *
 * @param {State} state
 * @param {Node} row
 * @return {String} text
 */


function cellToText(state, cell) {
  const {
    nodes
  } = cell; // The cell may contain a single paragraph,
  // we just want to serialize the inner

  let nodesToSerialize;

  if (nodes.size === 1 && nodes.first().type === BLOCKS.PARAGRAPH) {
    nodesToSerialize = nodes.first().nodes;
  } else {
    nodesToSerialize = nodes;
  }

  return state.use('inline').serialize(nodesToSerialize);
}
/**
 * Render aligns of a table into a Markdown align row
 *
 * @param {Array<String>} aligns
 * @return {String}
 */


function alignsToText(aligns) {
  return "|".concat(aligns.map(align => {
    if (align == 'right') {
      return ' ---: |';
    } else if (align == 'center') {
      return ' :---: |';
    } else if (align == 'left') {
      return ' :--- |';
    }

    return ' --- |';
  }).join(''));
}
/**
 * Render aligns of a table into a Markdown align row
 *
 * @param {Node} table
 * @return {Boolean}
 */


function mustSerializeAsHTML(table) {
  const isMultiBlockCell = cell => {
    const {
      nodes
    } = cell;
    const containOneParagraph = nodes.size === 1 && nodes.first().type === BLOCKS.PARAGRAPH;
    const containInlines = nodes.every(child => child.object !== 'block');
    return !containOneParagraph && !containInlines;
  };

  return table.findDescendant(node => node.type === BLOCKS.TABLE_CELL && isMultiBlockCell(node));
}

var table$2 = {
  serialize: serialize$t,
  deserialize: deserialize$8
};

/**
 * Serialize a list to markdown
 * @type {Serializer}
 */

const serialize$u = SerializerFactory().matchType([BLOCKS.UL_LIST, BLOCKS.OL_LIST]).then(state => {
  const list = state.peek();
  const {
    nodes
  } = list;
  const output = nodes.map((item, index) => serializeListItem(state, list, item, index)).join('');
  return state.shift().write(output);
});
/**
 * Deserialize a list to a node.
 * @type {Deserializer}
 */

const deserialize$9 = DeserializerFactory().matchRegExp(block.list.block, (state, match) => {
  const rawList = match[0];
  const bull = match[2];
  const ordered = bull.length > 1;
  const type = ordered ? BLOCKS.OL_LIST : BLOCKS.UL_LIST;
  let item;
  let loose;
  let data;
  let next = false;
  let lastIndex = 0;
  const nodes = [];
  let rawItem;
  let textItem;
  let space;
  const items = []; // Extract all items

  block.list.item.lastIndex = 0;

  do {
    item = block.list.item.exec(rawList);

    if (item !== null) {
      rawItem = rawList.slice(lastIndex, block.list.item.lastIndex);
      lastIndex = block.list.item.lastIndex;
      items.push([item, rawItem]);
    }
  } while (item !== null);

  for (let i = 0; i < items.length; i += 1) {
    item = items[i][0];
    rawItem = items[i][1];
    data = undefined; // Remove the list item's bullet
    // so it is seen as the next token.

    textItem = item[0];
    space = textItem.length;
    textItem = textItem.replace(block.list.bulletAndSpaces, ''); // Parse tasklists

    let checked = block.list.checkbox.exec(textItem);

    if (checked) {
      checked = checked[1] === 'x';
      textItem = textItem.replace(block.list.checkbox, '');
      data = {
        checked
      };
    } // Outdent whatever the
    // list item contains. Hacky.


    if (~textItem.indexOf('\n ')) {
      space -= textItem.length;
      textItem = textItem.replace(new RegExp("^ {1,".concat(space, "}"), 'gm'), '');
    } // Determine whether item is loose or not.
    // Use: /(^|\n)(?! )[^\n]+\n\n(?!\s*$)/
    // for discount behavior.


    loose = next || /\n\n(?!\s*$)/.test(textItem);

    if (i !== items.length - 1) {
      next = textItem.charAt(textItem.length - 1) === '\n';
      if (!loose) loose = next;
    }

    const nodeItem = slate.Block.create({
      type: BLOCKS.LIST_ITEM,
      data,
      nodes: (loose ? state.setProp('looseList', state.depth) : state).use('block').deserialize(textItem)
    });
    nodes.push(nodeItem);
  }

  const listBlock = slate.Block.create({
    type,
    nodes
  });
  return state.push(listBlock);
});
/**
 * Serialize a list item to markdown.
 * @param  {State} state
 * @param  {Block} list
 * @param  {Block} item
 * @param  {Number} index
 * @return {String} output
 */

function serializeListItem(state, list, item, index) {
  // Is it a task item ?
  const hasChecked = item.data.has('checked');
  const isChecked = item.data.get('checked'); // Is it a loose list?

  const loose = item.nodes.some(child => child.type === BLOCKS.PARAGRAPH); // Is it the last item from the list?

  const last = list.nodes.size - 1 === index; // Calcul bullet to use

  const bullet = list.type === BLOCKS.OL_LIST ? "".concat(index + 1, ".") : '*'; // Indent all lignes

  const indent = bullet.length + 1;
  let body = state.use('block').serialize(item.nodes); // Remove unwanted empty lines added by sub-blocks

  body = "".concat(trimTrailingLines(body), "\n");
  body = indentString(body, indent, {
    indent: ' '
  }).slice(indent);

  if (loose || last) {
    // Add empty line
    body += '\n';
  }

  if (hasChecked) {
    body = "".concat(isChecked ? '[x]' : '[ ]', " ").concat(body);
  }

  return "".concat(bullet, " ").concat(body);
}

var list$1 = {
  serialize: serialize$u,
  deserialize: deserialize$9
};

const reDef = /^ {0,3}\[(.+)]:[ \t]*\n?[ \t]*<?(\S+?)>?(?: =([*\d]+[A-Za-z%]{0,4})x([*\d]+[A-Za-z%]{0,4}))?[ \t]*\n?[ \t]*(?:(\n*)["|'(](.+?)["|')][ \t]*)?(?:\n+|(?=~0))/gm;
/**
 * Cleanup a text before parsing: normalize newlines and tabs
 *
 * @param {String} src
 * @return {String}
 */

function cleanupText(src) {
  return src.replace(/\r\n|\r/g, '\n').replace(/\t/g, '    ').replace(/\u00a0/g, ' ').replace(/\u2424/g, '\n').replace(/^ +$/gm, '');
}
/**
 * Deserialize all definitions in a markdown document and store them as
 * "refs" prop.
 * @type {Deserializer}
 */


const deserialize$a = DeserializerFactory().then(state => {
  const {
    depth,
    nodes
  } = state;
  let {
    text
  } = state; // Apply it as first rule only

  if (depth > 2 || nodes.size > 0 || state.getProp('refs')) {
    return undefined;
  } // Normalize the text


  text = cleanupText(text);
  const refs = {}; // Parse all definitions

  text = text.replace(reDef, (wholeMatch, linkId, href, width, height, blankLines, title) => {
    refs[linkId.toLowerCase()] = {
      href,
      title
    };
    return '';
  });
  return state.replaceText(text).setProp('refs', Immutable.Map(refs));
});
var definition = {
  deserialize: deserialize$a
};

/**
 * Serialize a math node to markdown
 * @type {Serializer}
 */

const serialize$v = SerializerFactory().matchType(BLOCKS.MATH).then(state => {
  const node = state.peek();
  const {
    data
  } = node;
  const formula = data.get('formula');
  const output = "$$\n".concat(formula.trim(), "\n$$\n\n");
  return state.shift().write(output);
});
/**
 * Deserialize a math block into a paragraph with an inline math in it.
 * @type {Deserializer}
 */

const deserialize$b = DeserializerFactory().matchRegExp(block.math, (state, match) => {
  const formula = match[2].trim();

  if (state.getProp('math') === false || !formula) {
    return undefined;
  }

  const node = slate.Block.create({
    type: BLOCKS.MATH,
    isVoid: true,
    data: {
      formula
    }
  });
  return state.push(node);
});
var math = {
  serialize: serialize$v,
  deserialize: deserialize$b
};

/**
 * Serialize a comment to markdown
 * @type {Serializer}
 */

const serialize$w = SerializerFactory().matchType(BLOCKS.COMMENT).then(state => {
  const node = state.peek();
  const {
    data
  } = node;
  const text = data.get('text');
  return state.shift().write("{# ".concat(text, " #}"));
});
/**
 * Deserialize a comment to a node.
 * @type {Deserializer}
 */

const deserialize$c = DeserializerFactory().matchRegExp(block.comment, (state, match) => {
  if (state.getProp('template') === false) {
    return undefined;
  }

  const node = slate.Block.create({
    type: BLOCKS.COMMENT,
    isVoid: true,
    data: {
      text: match[1].trim()
    }
  });
  return state.push(node);
});
var comment = {
  serialize: serialize$w,
  deserialize: deserialize$c
};

/**
 * Serialize an HTML block to markdown
 * @type {Serializer}
 */

const serialize$x = SerializerFactory().matchType(BLOCKS.HTML).then(state => {
  const node = state.peek();
  const {
    data
  } = node;
  return state.shift().write("".concat(data.get('html').trim(), "\n\n"));
});
/**
 * Deserialize an HTML block to a node.
 * @type {Deserializer}
 */

const deserialize$d = DeserializerFactory().matchRegExp(block.html, (state, match) => {
  const html = match[0].trim();
  const htmlState = State.create(HTMLParser);
  const document = htmlState.deserializeToDocument(html);
  const firstNode = document.nodes.first();
  const documentIsEmpty = document.nodes.size === 1 && firstNode.type === BLOCKS.PARAGRAPH && firstNode.text === '';

  if (documentIsEmpty) {
    return state;
  }

  return state.push(document.nodes);
});
var html$2 = {
  serialize: serialize$x,
  deserialize: deserialize$d
};

/* eslint-disable no-unexpected-multiline, no-spaced-func */

const singleQuoted = /'(?:[^'\\]|\\.)*'/;
const doubleQuoted = /"(?:[^"\\]|\\.)*"/;
const quoted = replace(/singleQuoted|doubleQuoted/)('singleQuoted', singleQuoted)('doubleQuoted', doubleQuoted)(); // basic types

const integer = /-?\d+/;
const number = /-?\d+\.?\d*|\.?\d+/;
const bool = /true|false/; // property access

const identifier = /[\w-]+/;
const literal = replace(/(?:quoted|bool|number)/)('quoted', quoted)('bool', bool)('number', number)(); // Match inner of the tag to split the name and the props

const tagLine = replace(/^\s*(identifier)\s*(.*)\s*$/)('identifier', identifier)(); // Types

const numberLine = replace(/^number$/)('number', number)();
const boolLine = replace(/^bool$/i)('bool', bool)();
const quotedLine = replace(/^quoted$/)('quoted', quoted)(); // Assignment of a variable message="Hello"

const assignment = replace(/(identifier)\s*=\s*(literal)/)('identifier', identifier)('literal', literal)(); // Argument or kwargs

const delimiter = /(?:\s*|^)/;
const prop = replace(/(?:delimiter)(?:(assignment|literal))/)('literal', literal)('delimiter', delimiter)('assignment', assignment)();
var lexical = {
  prop,
  quoted,
  number,
  bool,
  literal,
  integer,
  identifier,
  quotedLine,
  numberLine,
  boolLine,
  tagLine
};

const REPLACEMENTS = Immutable.OrderedMap([['\\', '\\\\'], ['*', '\\*'], ['#', '\\#'], ['(', '\\('], [')', '\\)'], ['[', '\\['], [']', '\\]'], ['`', '\\`'], ['_', '\\_'], ['|', '\\|'], ['"', '\\"'], ["'", "\\'"]]);

const escape$3 = str => escapeWith(REPLACEMENTS, str); // User-inserted slashes have to be escaped first.
// But they need to be unescaped last as markupit adds slashes itself.
// So first we unescape the slashes combined with something else and end by unescaping the lone-slashes.


const unescape$1 = str => unescapeWith(REPLACEMENTS.reverse(), str);

/**
 * Parse a literal value.
 * @param  {String} str
 * @return {String|Number|Boolean}
 */

function parseLiteral(str) {
  if (str.match(lexical.numberLine)) {
    return Number(str);
  } else if (str.match(lexical.boolLine)) {
    return str.toLowerCase() === 'true';
  } else if (str.match(lexical.quotedLine)) {
    return unescape$1(str.slice(1, -1));
  }

  return str;
}
/**
 * Parse data of the block.
 * @param  {String} text
 * @return {Map} props
 */


function parseData(inputText) {
  let match;
  let args = 0;
  const result = {};
  let text = inputText;

  do {
    match = text.match(lexical.prop);

    if (match) {
      if (match[2]) {
        result[match[2]] = parseLiteral(match[3]);
      } else {
        result[args] = parseLiteral(match[1]);
        args += 1;
      }

      text = text.slice(match[0].length);
    }
  } while (match);

  return Immutable.Map(result);
}
/**
 * Parse the inner text of a tag.
 * @param  {String} text
 * @return {Object | Null} { tag: String, data: Map }
 */


function parseTag(text) {
  const match = text.match(lexical.tagLine);

  if (!match) {
    return null;
  }

  return {
    tag: match[1],
    data: parseData(match[2])
  };
}

/**
 * Stringify a literal
 * @param  {Mixed} value
 * @return {String}
 */

function stringifyLiteral(value) {
  if (is.bool(value)) {
    return value ? 'true' : 'false';
  } else if (is.string(value)) {
    return "\"".concat(escape$3(value), "\"");
  }

  return String(value);
}
/**
 * Stringify a map of properties.
 * @param  {Map} data
 * @return {String}
 */


function stringifyData(data) {
  return data.entrySeq().map((_ref) => {
    let [key, value] = _ref;
    const isArgs = Number(key) >= 0;
    const stringValue = stringifyLiteral(value);

    if (isArgs) {
      return stringValue;
    }

    return "".concat(key, "=").concat(stringValue);
  }).join(' ');
}
/**
 * Stringify a custom liquid tag.
 *
 * @param  {Object} tagData
 *    [tagData.type] {String}
 *    [tagData.data] {Map}
 * @return {String}
 */


function stringifyTag(_ref2) {
  let {
    tag,
    data
  } = _ref2;
  return "{% ".concat(tag).concat(data && data.size > 0 ? " ".concat(stringifyData(data)) : '', " %}");
}

var liquid = {
  parseTag,
  stringifyTag
};

/**
 * Return true if a block type is a custom one.
 * @param  {String} tag
 * @return {Boolean}
 */

function isCustomType(type) {
  return type.indexOf('x-') === 0;
}
/**
 * Return liquid tag from a custom type.
 * @param  {String} type
 * @return {String} tag
 */


function getTagFromCustomType(type) {
  return type.slice(2);
}
/**
 * Return custom type from a liquid tag.
 * @param  {String} tag
 * @return {String} type
 */


function getCustomTypeFromTag(tag) {
  return "x-".concat(tag);
}
/**
 * Return true if a type if the closing tag.
 * @param  {String} tag
 * @return {Boolean}
 */


function isClosingTag(tag) {
  return tag.indexOf('end') === 0;
}
/**
 * Return true if a type if the closing tag of another type
 * @param  {String} type
 * @return {Boolean}
 */


function isClosingTagFor(tag, forTag) {
  return tag.indexOf("end".concat(forTag)) === 0;
}
/**
 * Wrap the given nodes in the default block
 * @param  {Array<Node>} nodes
 * @return {Block}
 */


function wrapInDefaultBlock(nodes) {
  return slate.Block.create({
    type: BLOCKS.DEFAULT,
    nodes
  });
}
/**
 * Serialize a templating block to markdown
 * @type {Serializer}
 */


const serialize$y = SerializerFactory().matchType(isCustomType).then(state => {
  const node = state.peek();
  const {
    type,
    data
  } = node;
  const startTag = liquid.stringifyTag({
    tag: getTagFromCustomType(type),
    data
  });
  const split = node.object == 'block' ? '\n' : '';
  const end = node.object == 'block' ? '\n\n' : '';

  if (node.isVoid || node.nodes.isEmpty()) {
    warning(node.isVoid, 'Encountered a non-void custom block with no children');
    return state.shift().write("".concat(startTag).concat(end));
  }

  const containsInline = node.nodes.first().object !== 'block';
  warning(!containsInline, 'Encountered a custom block containing inlines');
  const innerNodes = containsInline ? Immutable.List([wrapInDefaultBlock(node.nodes)]) : node.nodes;
  const inner = trimTrailingLines(state.serialize(innerNodes));
  const unendingTags = state.getProp('unendingTags') || Immutable.List();
  const endTag = unendingTags.includes(getTagFromCustomType(node.type)) ? '' : liquid.stringifyTag({
    tag: "end".concat(getTagFromCustomType(node.type))
  });
  return state.shift().write("".concat(startTag).concat(split).concat(inner).concat(split).concat(endTag).concat(end));
});
/**
 * Deserialize a templating block to a node.
 * @type {Deserializer}
 */

const deserialize$e = DeserializerFactory().matchRegExp(block.customBlock, (initialState, match) => {
  let state = initialState;

  if (state.getProp('template') === false) {
    return undefined;
  }

  const text = match[1].trim();

  if (!text) {
    return state;
  }

  const parsed = liquid.parseTag(text);

  if (!parsed) {
    return state;
  }

  const {
    tag,
    data
  } = parsed;
  const node = slate.Block.create({
    type: getCustomTypeFromTag(tag),
    data,
    isVoid: true,
    nodes: Immutable.List()
  }); // This node is temporary

  if (isClosingTag(tag)) {
    return state.push(node);
  } // By default it'll add this node as a single node.


  state = state.push(node); // List of tags that don't have an end

  const unendingTags = state.getProp('unendingTags') || Immutable.List();
  const resultState = state.lex({
    stopAt(newState) {
      // What nodes have been added in this iteration?
      const added = newState.nodes.skip(state.nodes.size);
      const between = added.takeUntil(child => {
        // Some tags don't have an explicit end and thus
        // need a special treatment
        if (unendingTags.includes(tag)) {
          return isCustomType(child.type) && ( // Closing custom tag close previous unending tags
          isClosingTag(getTagFromCustomType(child.type)) || // Unending tag close previous unending tags
          unendingTags.includes(getTagFromCustomType(child.type)));
        }

        return isCustomType(child.type) && isClosingTagFor(getTagFromCustomType(child.type), tag);
      });

      if (between.size == added.size) {
        return undefined;
      } // We skip the default node.


      const beforeNodes = state.nodes.butLast();
      const afterNodes = added.skip(between.size);
      return newState.merge({
        nodes: beforeNodes.push(node.merge({
          isVoid: false,
          nodes: between.size == 0 ? Immutable.List([state.genText()]) : between
        })).concat(afterNodes) // Filter out this node's closing tag
        .filterNot(child => isCustomType(child.type) && isClosingTag(getTagFromCustomType(child.type)) && // Don't swallow others' closing node by ensuring
        // we filter the one that matches the current one
        isClosingTagFor(getTagFromCustomType(child.type), tag))
      });
    }

  });
  return resultState;
});
var custom = {
  serialize: serialize$y,
  deserialize: deserialize$e
};

var block$1 = [// All link definition (for link reference) must be resolved first.
definition, // HTML must be high in the stack too.
html$2, table$2, hr$1, list$1, footnote$1, blockquote$1, codeBlock, heading$2, math, comment, custom, paragraph$1, unstyled$1];

/**
 * Serialize a text node to markdown
 * @type {Serializer}
 */

const serialize$z = SerializerFactory().matchObject('text').then(state => {
  const node = state.peek();
  return state.shift().write(node.text);
});
/**
 * Deserialize escaped text.
 * @type {Deserializer}
 */

const deserializeEscaped = DeserializerFactory().matchRegExp(inline.escape, (state, match) => state.pushText(match[1]));
/**
 * Deserialize text.
 * @type {Deserializer}
 */

const deserializeText = DeserializerFactory().matchRegExp(inline.text, (state, match) => {
  const text = unescape(match[0]);
  return state.pushText(text);
});
const deserialize$f = DeserializerFactory().use([deserializeEscaped, deserializeText]);
var text$1 = {
  serialize: serialize$z,
  deserialize: deserialize$f
};

/**
 * Serialize a footnote to markdown
 * @type {Serializer}
 */

const serialize$A = SerializerFactory().matchType(INLINES.FOOTNOTE_REF).then(state => {
  const node = state.peek();
  const id = node.data.get('id');
  const output = "[^".concat(id, "]");
  return state.shift().write(output);
});
/**
 * Deserialize a footnote.
 * @type {Deserializer}
 */

const deserialize$g = DeserializerFactory().matchRegExp(inline.reffn, (state, match) => {
  const id = match[1];
  const node = slate.Inline.create({
    type: INLINES.FOOTNOTE_REF,
    isVoid: true,
    data: {
      id
    }
  });
  return state.push(node);
});
var footnote$2 = {
  serialize: serialize$A,
  deserialize: deserialize$g
};

/**
 * Resolve an image reference
 * @param  {State} state
 * @param  {String} refID
 * @return {Map} data?
 */

function resolveImageRef(state, refID) {
  const data = resolveRef(state, refID);

  if (!data) {
    return null;
  }

  return data.set('src', data.get('href')).remove('href');
}
/**
 * Test if a link input is an image
 * @param {String} raw
 * @return {Boolean}
 */


function isImage(raw) {
  return raw.charAt(0) === '!';
}
/**
 * Serialize a image to markdown
 * @type {Serializer}
 */


const serialize$B = SerializerFactory().matchType(INLINES.IMAGE).then(state => {
  const node = state.peek();
  const {
    data
  } = node; // Escape the url

  const src = escapeURL(data.get('src') || '');
  const alt = escape$2(data.get('alt') || '');
  const title = escape$2(data.get('title') || '');
  let output;

  if (title) {
    output = "![".concat(alt, "](").concat(src, " \"").concat(title, "\")");
  } else {
    output = "![".concat(alt, "](").concat(src, ")");
  }

  return state.shift().write(output);
});
/**
 * Deserialize a classic image like:
 *  ![Hello](test.png)
 * @type {Deserializer}
 */

const deserializeNormal$2 = DeserializerFactory().matchRegExp(inline.link, (state, match) => {
  if (!isImage(match[0])) {
    return undefined;
  }

  const data = Immutable.Map({
    alt: match[1] ? unescape(match[1]) : undefined,
    src: unescapeURL(match[2]),
    title: match[3] ? unescape(match[3]) : undefined
  }).filter(Boolean);
  const node = slate.Inline.create({
    type: INLINES.IMAGE,
    isVoid: true,
    data
  });
  return state.push(node);
});
/**
 * Deserialize a reference image:
 *  nolink: ![1]
 * @type {Deserializer}
 */

const deserializeRef = DeserializerFactory().matchRegExp([inline.reflink, inline.nolink], (state, match) => {
  if (!isImage(match[0])) {
    return undefined;
  }

  const refID = match[2] || match[1];
  const data = resolveImageRef(state, refID);

  if (!data) {
    return undefined;
  }

  const node = slate.Inline.create({
    type: INLINES.IMAGE,
    isVoid: true,
    data
  });
  return state.push(node);
});
const deserialize$h = DeserializerFactory().use([deserializeNormal$2, deserializeRef]);
var image$1 = {
  serialize: serialize$B,
  deserialize: deserialize$h
};

/**
 * Serialize a link to markdown
 * @type {Serializer}
 */

const serialize$C = SerializerFactory().matchType(INLINES.LINK).then(state => {
  const node = state.peek();
  const {
    data,
    nodes
  } = node;
  const inner = state.use('inline').serialize(nodes); // Escape the href

  const href = escapeURL(data.get('href', '')); // Escape the title

  let title = escape$2(data.get('title', ''));

  if (title) {
    title = title ? " \"".concat(title, "\"") : '';
  }

  const output = "[".concat(inner, "](").concat(href).concat(title, ")");
  return state.shift().write(output);
});
/**
 * Deserialize a classic image like:
 *  ![Hello](test.png)
 * @type {Deserializer}
 */

const deserializeNormal$3 = DeserializerFactory().matchRegExp(inline.link, (state, match) => {
  const inner = match[1];
  const nodes = state.use('inline') // Signal to children that we are in a link
  .setProp('link', state.depth).deserialize(inner);
  const data = Immutable.Map({
    href: unescapeURL(match[2]),
    title: match[3] ? unescape(match[3]) : undefined
  }).filter(Boolean);
  const node = slate.Inline.create({
    type: INLINES.LINK,
    nodes,
    data
  });
  return state.push(node);
});
/**
 * Deserialize an url:
 *  https://www.google.fr
 * @type {Deserializer}
 */

const deserializeUrl = DeserializerFactory().matchRegExp(inline.url, (state, match) => {
  // Already inside a link?
  if (state.getProp('link')) {
    return undefined;
  }

  const href = unescapeURL(match[1]);
  const node = slate.Inline.create({
    type: INLINES.LINK,
    nodes: [slate.Text.create(href)],
    data: {
      href
    }
  });
  return state.push(node);
});
/**
 * Deserialize an url with < and >:
 *  <samy@gitbook.com>
 * @type {Deserializer}
 */

const deserializeAutolink = DeserializerFactory().matchRegExp(inline.autolink, (state, match) => {
  // Already inside a link?
  if (state.getProp('link')) {
    return undefined;
  }

  const text = match[1];
  let href;

  if (match[2] === '@') {
    href = "mailto:".concat(text);
  } else {
    href = text;
  }

  const node = slate.Inline.create({
    type: INLINES.LINK,
    nodes: [slate.Text.create(text)],
    data: {
      href
    }
  });
  return state.push(node);
});
/**
 * Deserialize a reference link:
 *  nolink: [1]
 * @type {Deserializer}
 */

const deserializeRef$1 = DeserializerFactory().matchRegExp([inline.reflink, inline.nolink], (state, match) => {
  // Already inside a link?
  if (state.getProp('link')) {
    return undefined;
  }

  const refID = match[2] || match[1];
  const inner = match[1];
  const data = resolveRef(state, refID);

  if (!data) {
    return undefined;
  }

  const nodes = state.use('inline').setProp('link', state.depth).deserialize(inner);
  const node = slate.Inline.create({
    type: INLINES.LINK,
    nodes,
    data
  });
  return state.push(node);
});
/**
 * Deserialize a reference.
 * @type {Deserializer}
 */

const deserializeReffn = DeserializerFactory().matchRegExp(inline.reffn, (state, match) => {
  // Already inside a link?
  if (state.getProp('link')) {
    return undefined;
  }

  const refID = match[1];
  const data = resolveRef(state, refID);

  if (!data) {
    return undefined;
  }

  const node = slate.Inline.create({
    type: INLINES.LINK,
    nodes: [slate.Text.createFromString(refID)],
    data
  });
  return state.push(node);
});
const deserialize$i = DeserializerFactory().use([deserializeNormal$3, deserializeUrl, deserializeAutolink, deserializeReffn, deserializeRef$1]);
var link$1 = {
  serialize: serialize$C,
  deserialize: deserialize$i
};

// List of valid html blocks names, accorting to commonmark spec
// http://spec.commonmark.org/0.28/#html-blocks
// Treat these blocks as RAW HTML
const HTML_BLOCKS = ['address', 'article', 'aside', 'base', 'basefont', 'blockquote', 'body', 'caption', 'center', 'col', 'colgroup', 'dd', 'details', 'dialog', 'dir', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hr', 'html', 'iframe', 'legend', 'li', 'link', 'main', 'menu', 'menuitem', 'meta', 'nav', 'noframes', 'ol', 'optgroup', 'option', 'p', 'param', 'pre', 'section', 'source', 'summary', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'title', 'tr', 'track', 'ul'];

/**
 * Test if a tag name is an HTML block that should not be parsed inside
 * @param {String} tag
 * @return {Boolean}
 */

function isHTMLBlock(tag) {
  return HTML_BLOCKS.indexOf(tag.toLowerCase()) >= 0;
}
/**
 * Create a raw HTML node (inner Html not parsed)
 * @param {String} openingTag
 * @param {String} closingTag
 * @param {String} innerHtml
 * @param
 * @return {Inline}
 */


function createRawHTML(opts) {
  const {
    openingTag = '',
    closingTag = '',
    innerHtml = ''
  } = opts;
  return slate.Inline.create({
    type: INLINES.HTML,
    isVoid: true,
    data: {
      openingTag,
      closingTag,
      innerHtml
    }
  });
}
/**
 * Create an HTML node
 * @param {String} openingTag
 * @param {String} closingTag
 * @param {Node[]} nodes
 * @return {Inline}
 */


function createHTML(opts) {
  const {
    openingTag = '',
    closingTag = '',
    nodes
  } = opts;
  return slate.Inline.create({
    type: INLINES.HTML,
    data: {
      openingTag,
      closingTag
    },
    nodes
  });
}
/**
 * Deserialize inline HTML
 * @param {String} html
 * @return {List<Node>} parsed nodes
 */


function deserializeHtml(html) {
  const htmlParser = State.create(HTMLParser);
  const document = htmlParser.deserializeToDocument(html);
  const firstNode = document.nodes.first();
  const isEmpty = !firstNode || document.nodes.size === 1 && firstNode.type === BLOCKS.PARAGRAPH && firstNode.nodes.every(child => !child.isVoid) && firstNode.text === '';

  if (isEmpty) {
    return Immutable.List();
  }

  return firstNode.nodes;
}
/**
 * Serialize an HTML node to markdown
 * @type {Serializer}
 */


const serialize$D = SerializerFactory().matchType(INLINES.HTML).then(state => {
  const node = state.peek();
  const {
    openingTag = '',
    closingTag = '',
    innerHtml = ''
  } = node.data.toObject();

  if (innerHtml) {
    return state.shift().write(openingTag).write(innerHtml).write(closingTag);
  }

  return state.shift().write(openingTag).write(state.serialize(node.nodes)).write(closingTag);
});
/**
 * Deserialize HTML comment from markdown
 * @type {Deserializer}
 */

const deserializeComment = DeserializerFactory().matchRegExp(inline.htmlComment, (state, match) => // Ignore
state);
/**
 * Deserialize HTML tag pair from markdown
 * @type {Deserializer}
 */

const deserializePair = DeserializerFactory().matchRegExp(inline.htmlTagPair, (state, match) => {
  const [fullTag, tagName, attributes = '', innerHtml = ''] = match;
  const openingTag = "<".concat(tagName).concat(attributes, ">");
  const closingTag = fullTag.slice(openingTag.length + innerHtml.length); // Finish parsing the inside of the HTML as Markdown

  const htmlNode = (() => {
    if (isHTMLBlock(tagName)) {
      // Do not parse inner HTML
      return createRawHTML({
        openingTag,
        closingTag,
        innerHtml
      });
    } // else parse inner HTML as Markdown


    const isLink = tagName.toLowerCase() === 'a';
    const innerNodes = state.setProp(isLink ? 'link' : 'html', state.depth).deserialize(innerHtml);
    return createHTML({
      openingTag,
      closingTag,
      nodes: innerNodes
    });
  })(); // Now convert everything back to HTML and interpret the whole
  // (we got rid of any Markdown)


  const htmlParser = State.create(HTMLParser);
  const htmlOnly = htmlParser.use('block').serializeNode(htmlNode);
  return state // If we have found an anchor, store it so it is attached to the next heading
  .setProp('lastAnchorId', findHtmlAnchor(htmlOnly)).push(deserializeHtml(htmlOnly));
});
/**
 * Look for <a id="..."></a>, often used to
 * add custom anchors to Markdown headings.
 * @param {String} html
 * @return {String | Null} id of the anchor found
 */

function findHtmlAnchor(html) {
  let anchorId = null;
  const parser = new htmlparser2.Parser({
    onopentag(tagName, attribs) {
      if (tagName.toLowerCase() === 'a' && attribs.id) {
        // This is an anchor with an ID
        anchorId = attribs.id;
      }
    }

  }, {
    decodeEntities: true
  });
  parser.write(html);
  parser.end();
  return anchorId;
}
/**
 * Deserialize HTML self closing tag from markdown
 * @type {Deserializer}
 */


const deserializeClosing = DeserializerFactory().matchRegExp(inline.htmlSelfClosingTag, (state, match) => {
  const [selfClosingHtml] = match;
  return state.push(deserializeHtml(selfClosingHtml));
});
var html$3 = {
  serialize: serialize$D,
  deserialize: DeserializerFactory().use([deserializeComment, deserializePair, deserializeClosing])
};

/**
 * Normalize some TeX content
 * @param {String} content
 * @return {String}
 */

function normalizeTeX(content) {
  return rtrim(ltrim(content, '\n'), '\n');
}
/**
 * Serialize a math node to markdown
 * @type {Serializer}
 */


const serialize$E = SerializerFactory().matchType(INLINES.MATH).then(state => {
  const node = state.peek();
  const {
    data
  } = node;
  let formula = data.get('formula');
  formula = normalizeTeX(formula);
  const output = "$$".concat(formula, "$$");
  return state.shift().write(output);
});
/**
 * Deserialize a math
 * @type {Deserializer}
 */

const deserialize$j = DeserializerFactory().matchRegExp(inline.math, (state, match) => {
  const formula = match[1].trim();

  if (state.getProp('math') === false || !formula) {
    return undefined;
  }

  const node = slate.Inline.create({
    type: INLINES.MATH,
    isVoid: true,
    data: {
      formula
    }
  });
  return state.push(node);
});
var math$1 = {
  serialize: serialize$E,
  deserialize: deserialize$j
};

/**
 * Serialize a template variable to markdown
 * @type {Serializer}
 */

const serialize$F = SerializerFactory().matchType(INLINES.VARIABLE).then(state => {
  const node = state.peek();
  const {
    data
  } = node;
  const key = data.get('key');
  return state.shift().write("{{ ".concat(key, " }}"));
});
/**
 * Deserialize a template variable.
 * @type {Deserializer}
 */

const deserialize$k = DeserializerFactory().matchRegExp(inline.variable, (state, match) => {
  if (state.getProp('template') === false) {
    return undefined;
  }

  const node = slate.Inline.create({
    type: INLINES.VARIABLE,
    isVoid: true,
    data: {
      key: match[1]
    }
  });
  return state.push(node);
});
var variable = {
  serialize: serialize$F,
  deserialize: deserialize$k
};

/**
 * Escape all text leaves during serialization.
 * This step should be done before processing text leaves for marks.
 *
 * @type {Serializer}
 */

const serialize$G = SerializerFactory().transformText((state, leaf) => {
  const {
    text,
    marks
  } = leaf;
  const hasCode = marks.some(mark => mark.type === MARKS.CODE);
  return leaf.merge({
    text: hasCode ? text : escape$2(text, false)
  });
});
var escape$4 = {
  serialize: serialize$G
};

/**
 * Serialize a code text to markdown
 * @type {Serializer}
 */

const serialize$H = SerializerFactory().transformMarkedLeaf(MARKS.CODE, (state, text, mark) => {
  let separator = '`'; // We need to find the right separator not present in the content

  while (text.indexOf(separator) >= 0) {
    separator += '`';
  }

  return wrapInline(text, separator);
});
/**
 * Deserialize a code.
 * @type {Deserializer}
 */

const deserialize$l = DeserializerFactory().matchRegExp(inline.code, (state, match) => {
  const text = match[2];
  const mark = slate.Mark.create({
    type: MARKS.CODE
  });
  const node = slate.Text.create({
    text,
    marks: [mark, ...state.marks]
  });
  return state.push(node);
});
var code$2 = {
  serialize: serialize$H,
  deserialize: deserialize$l
};

/**
 * Serialize a bold text to markdown
 * @type {Serializer}
 */

const serialize$I = SerializerFactory().transformMarkedLeaf(MARKS.BOLD, (state, text, mark) => wrapInline(text, '**'));
/**
 * Deserialize a bold.
 * @type {Deserializer}
 */

const deserialize$m = DeserializerFactory().matchRegExp(inline.strong, (state, match) => {
  const text = match[2] || match[1];
  const mark = slate.Mark.create({
    type: MARKS.BOLD
  });
  const nodes = state.pushMark(mark).deserialize(text);
  return state.push(nodes);
});
var bold$1 = {
  serialize: serialize$I,
  deserialize: deserialize$m
};

/**
 * Serialize a italic text to markdown
 * @type {Serializer}
 */

const serialize$J = SerializerFactory().transformMarkedLeaf(MARKS.ITALIC, (state, text) => wrapInline(text, '_'));
/**
 * Deserialize an italic.
 * @type {Deserializer}
 */

const deserialize$n = DeserializerFactory().matchRegExp(inline.em, (state, match) => {
  const text = match[2] || match[1];
  const mark = slate.Mark.create({
    type: MARKS.ITALIC
  });
  const nodes = state.pushMark(mark).deserialize(text);
  return state.push(nodes);
});
var italic$1 = {
  serialize: serialize$J,
  deserialize: deserialize$n
};

/**
 * Replace hardline break by two spaces followed by a newline
 *
 * @type {Serializer}
 */

const serialize$K = SerializerFactory().transformText((state, leaf) => {
  const {
    text
  } = leaf;
  const allowHardlineBreak = state.getProp('hardlineBreak');
  const replaceWith = allowHardlineBreak ? '  \n' : ' ';
  return leaf.merge({
    text: text.replace(/\n/g, replaceWith)
  });
});
/**
 * Deserialize hardline break.
 * http://spec.commonmark.org/0.26/#hard-line-break
 *
 * @type {Deserializer}
 */

const deserialize$o = DeserializerFactory().matchRegExp(inline.br, (state, match) => state.pushText('\n'));
var hardlineBreak = {
  serialize: serialize$K,
  deserialize: deserialize$o
};

/**
 * Serialize a strikethrough text to markdown
 * @type {Serializer}
 */

const serialize$L = SerializerFactory().transformMarkedLeaf(MARKS.STRIKETHROUGH, (state, text) => wrapInline(text, '~~'));
/**
 * Deserialize a strikethrough.
 * @type {Deserializer}
 */

const deserialize$p = DeserializerFactory().matchRegExp(inline.del, (state, match) => {
  const text = match[1];
  const mark = slate.Mark.create({
    type: MARKS.STRIKETHROUGH
  });
  const nodes = state.pushMark(mark).deserialize(text);
  return state.push(nodes);
});
var strikethrough$1 = {
  serialize: serialize$L,
  deserialize: deserialize$p
};

var inline$1 = [footnote$2, image$1, link$1, math$1, html$3, variable, hardlineBreak, // Text ranegs should be escaped before processing marks
escape$4, // Code mark should be applied before everything else
code$2, // Bold should be before italic
bold$1, italic$1, strikethrough$1, text$1];

/**
 * Serialize a document to markdown.
 * @type {Serializer}
 */

const serialize$M = SerializerFactory().matchObject('document').then(state => {
  const node = state.peek();
  const {
    data,
    nodes
  } = node;
  const body = state.use('block').serialize(nodes);

  if (data.size === 0) {
    return state.shift().write(body);
  }

  const frontMatter = "---\n".concat(jsYaml.safeDump(data.toJS(), {
    skipInvalid: true
  }), "---\n\n");
  return state.shift().write(frontMatter + body);
});
/**
 * Deserialize a document.
 * @type {Deserializer}
 */

const deserialize$q = DeserializerFactory().then(state => {
  const {
    text
  } = state;
  const {
    body,
    attributes
  } = parseFrontMatter(text);
  const nodes = state.use('block').deserialize(body);
  const data = Immutable__default.fromJS(attributes);
  const node = slate.Document.create({
    data,
    nodes
  });
  return state.skip(text.length).push(node);
});
/**
 * Extracts front matter from a text
 * Returns the actual text body and the front matter attributes as an object
 * @param  {String} fullText
 * @return {Object} { body: String, frontMatter: Object }
 */

function parseFrontMatter(fullText) {
  // Gracefully parse front matter
  // Invalid (non-parsable or string only) is considered as part of the text
  try {
    const parsed = fm(fullText);
    const {
      body,
      attributes
    } = parsed; // If the result of parsing is a string,
    // we consider it as simple text

    if (typeof attributes === 'string') {
      return {
        body: fullText,
        attributes: {}
      };
    }

    return {
      body,
      attributes
    };
  } catch (error) {
    // In case of error, we consider the front matter invalid
    // and parse it as normal text
    return {
      body: fullText,
      attributes: {}
    };
  }
}

var document$1 = {
  serialize: serialize$M,
  deserialize: deserialize$q
};

const MarkdownParser = {
  document: [document$1],
  inline: inline$1,
  block: block$1
};

Object.defineProperty(exports, 'Block', {
    enumerable: true,
    get: function () {
        return slate.Block;
    }
});
Object.defineProperty(exports, 'Document', {
    enumerable: true,
    get: function () {
        return slate.Document;
    }
});
Object.defineProperty(exports, 'Inline', {
    enumerable: true,
    get: function () {
        return slate.Inline;
    }
});
Object.defineProperty(exports, 'Leaf', {
    enumerable: true,
    get: function () {
        return slate.Leaf;
    }
});
Object.defineProperty(exports, 'Mark', {
    enumerable: true,
    get: function () {
        return slate.Mark;
    }
});
Object.defineProperty(exports, 'Text', {
    enumerable: true,
    get: function () {
        return slate.Text;
    }
});
exports.BLOCKS = BLOCKS;
exports.CONTAINERS = CONTAINERS;
exports.Deserializer = DeserializerFactory;
exports.HTMLParser = HTMLParser;
exports.INLINES = INLINES;
exports.LEAFS = LEAFS;
exports.MARKS = MARKS;
exports.MarkdownParser = MarkdownParser;
exports.Serializer = SerializerFactory;
exports.State = State;
exports.TABLE_ALIGN = TABLE_ALIGN;
exports.VOID = VOID;
