const expect = require('expect');
const { Block } = require('slate');
const State  = require('../src/models/state');

describe('State', () => {

    describe('.push()', () => {
        it('should add nodes in the stack', () => {
            const state = (new State())
                .push(Block.create({ type: 'heading' }))
                .push(Block.create({ type: 'paragraph' }));

            const types = state.nodes.map(n => n.type).toArray();
            expect(types).toEqual(['heading', 'paragraph']);
        });
    });

    describe('.peek()', () => {
        it('should return the first node', () => {
            const state = (new State())
                .push(Block.create({ type: 'heading' }))
                .push(Block.create({ type: 'paragraph' }));

            const node = state.peek();
            expect(node.type).toBe('heading');
        });
    });

    describe('.write()', () => {
        it('should add text to the buffer', () => {
            const state = (new State())
                .write('Hello')
                .write(' World');

            expect(state.text).toBe('Hello World');
        });
    });

    describe('.skip()', () => {
        it('should skip N characters from text', () => {
            const state = (new State())
                .write('Hello World')
                .skip(5);

            expect(state.text).toBe(' World');
        });
    });

    describe('.rules', () => {
        it('should return block rules by default', () => {
            const state = State.create({
                blocks: [ { deserialize: (st => st) } ]
            });

            expect(state.rules.size).toBe(1);
        });

        it('should return an empty list when no set', () => {
            const state = State.create();

            expect(state.rules.size).toBe(0);
        });
    });

    describe('.use', () => {
        it('should change the current set of rules', () => {
            const state = State.create({
                blocks: [ { deserialize: (st => st) } ]
            })
            .use('inlines');

            expect(state.rules.size).toBe(0);
        });
    });

    describe('.deserialize', () => {
        const deserialize = state => {
            const { text } = state;
            let nextLine = text.indexOf('\n');
            nextLine = nextLine < 0 ? text.length : nextLine + 1;
            const type = text.slice(0, nextLine);

            return state
                .skip(nextLine)
                .push(Block.create({ type }));
        };


        it('should change the current set of rules', () => {
            const state = State.create({
                blocks: [ { deserialize } ]
            });
            const nodes = state.deserialize('heading\nparagraph\ncode');

            expect(nodes.size).toBe(3);
        });
    });
});
