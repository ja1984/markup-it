/** @jsx h */
import h from 'h';

export default (
    <document>
        <paragraph>Test regexp to not catch non-html</paragraph>
        <paragraph>{'<div<NOT HTML</div>'}</paragraph>
        <paragraph>{'<span>NOT HTML</div>'}</paragraph>
        <paragraph>TRUE HTML</paragraph>
    </document>
);
