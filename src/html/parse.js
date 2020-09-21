import detectNewLine from 'detect-newline';
import { Parser } from 'htmlparser2';
import htmlclean from 'htmlclean';
import { List, Stack, Set } from 'immutable';
import { Block, Document, Inline, Mark, Text } from 'slate';
import { BLOCKS, INLINES, MARKS, CONTAINERS, VOID, LEAFS } from '../constants';

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
    return attribs.id ? { id: attribs.id } : {};
}

/**
 * Flatten a block node into a list of inline nodes.
 * @param  {Node} node
 * @return {List<Node>} nodes
 */
function selectInlines(node) {
    if (node.object !== 'block') {
        return List([node]);
    }

    const { nodes } = node;
    return nodes.reduce(
        (result, child) => result.concat(selectInlines(child)),
        List()
    );
}

/**
 * Get all marks from a class name.
 * @param {String} className
 * @return {Array<Mark>}
 */
function getMarksForClassName(className = '') {
    const classNames = className.split(' ');
    const result = [];

    classNames.forEach(name => {
        const type = MARK_CLASSNAME[name];
        if (!type) {
            return;
        }

        const mark = Mark.create({
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
function splitLines(text, sep = detectNewLine(text) || '\n') {
    return List(text.split(sep));
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
    let { nodes } = parent;

    // If parent is not a block container
    if (!isBlockContainer(parent) && node.object == 'block') {
        // Discard all blocks
        nodes = nodes.concat(selectInlines(node));
    }

    // Wrap node if type is not allowed
    else if (
        isBlockContainer(parent) &&
        (node.object !== 'block' || !canContain(parent, node))
    ) {
        const previous = parent.nodes.last();
        if (previous && canContain(previous, node)) {
            // Reuse previous block if possible
            nodes = nodes
                .pop()
                .push(previous.set('nodes', previous.nodes.push(node)));
        } else {
            // Else insert a default wrapper
            const wrapper = Block.create({
                type: defaultBlockType(parent),
                nodes: [node]
            });

            nodes = nodes.push(wrapper);
        }
    } else {
        nodes = nodes.push(node);
    }

    return setNode(stack, parent.merge({ nodes }));
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
    const cleanedUpStr = htmlclean(str);

    // For convenience, starts with a root node
    const root = Document.create({});
    // The top of the stack always hold the current parent
    // node. Should never be empty.
    let stack = Stack().push(root);
    // The current marks
    let marks = Set();

    const parser = new Parser(
        {
            onopentag(tagName, attribs) {
                if (BLOCK_TAGS[tagName]) {
                    const type = BLOCK_TAGS[tagName];
                    const block = Block.create({
                        data: getData(tagName, attribs),
                        isVoid: isVoid(type),
                        type
                    });

                    stack = pushNode(stack, block);
                } else if (INLINE_TAGS[tagName]) {
                    const type = INLINE_TAGS[tagName];
                    const inline = Inline.create({
                        data: getData(tagName, attribs),
                        isVoid: isVoid(type),
                        type
                    });

                    stack = pushNode(stack, inline);
                } else if (MARK_TAGS[tagName]) {
                    const mark = Mark.create({
                        data: getData(tagName, attribs),
                        type: MARK_TAGS[tagName]
                    });

                    marks = marks.add(mark);
                } else if (tagName == 'br') {
                    const textNode = Text.create({
                        text: '\n',
                        marks
                    });
                    stack = appendNode(stack, textNode);
                }
                // else ignore

                // Parse marks from the class name
                const newMarks = getMarksForClassName(attribs.class);
                marks = marks.concat(newMarks);
            },

            ontext(text) {
                const cleanText = sanitizeSpaces(text);
                const textNode = Text.create({ text: cleanText, marks });
                stack = appendNode(stack, textNode);
            },

            onclosetag(tagName) {
                if (BLOCK_TAGS[tagName] || INLINE_TAGS[tagName]) {
                    const parent = stack.peek();

                    // Special rule for code blocks that we must split in lines
                    if (parent.type === BLOCKS.CODE) {
                        let lines = splitLines(parent.text);
                        // Remove trailing newline
                        if (lines.last().trim() === '') {
                            lines = lines.skipLast(1);
                        }
                        stack = setNode(
                            stack,
                            parent.merge({
                                nodes: lines.map(line =>
                                    // Create a code line
                                    Block.create({
                                        type: BLOCKS.CODE_LINE,
                                        nodes: [Text.create(line)]
                                    })
                                )
                            })
                        );
                    }

                    stack = popNode(stack);
                } else if (MARK_TAGS[tagName]) {
                    const type = MARK_TAGS[tagName];
                    marks = marks.filter(mark => mark.type !== type);
                }
                // else ignore
            }
        },
        {
            decodeEntities: true
        }
    );

    parser.write(cleanedUpStr);
    parser.end();

    if (stack.size !== 1) {
        throw new Error(
            'Invalid HTML. A tag might not have been closed correctly.'
        );
    }

    return stack.peek();
}

export default parse;
