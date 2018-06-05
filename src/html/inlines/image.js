const { Serializer, INLINES } = require('../../');
const serializeTag = require('../serializeTag');

/**
 * Serialize an image to HTML
 * @type {Serializer}
 */
const serialize = Serializer()
    .matchType(INLINES.IMAGE)
    .then(serializeTag('img', {
        isSingleTag: true,
        getAttrs: (node) => {
            const align = node.data.get('align');
            const style = align ? { style: `margin: ${align === 'left' ? 0 : 'auto'};` } : {};

            return {
                src: node.data.get('src'),
                alt: node.data.get('alt'),
                ...style
            };
        }
    }));

module.exports = { serialize };
