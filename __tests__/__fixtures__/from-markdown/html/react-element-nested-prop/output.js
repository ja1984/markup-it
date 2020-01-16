/** @jsx h */
import h from '../../../hyperscript';

// Edge case of React Element with another Element in its properties
// The HTML parser renders what's after the nested Element closing tag as text
// but it's better than crashing
export default (
    <document>
        <paragraph>Some content before</paragraph>
        <paragraph>} type="info"></paragraph>
        <unordered_list>
            <list_item>
                <unstyled>Item 1</unstyled>
            </list_item>
            <list_item>
                <unstyled>Item 2</unstyled>
            </list_item>
        </unordered_list>
        <paragraph>Some content after</paragraph>
    </document>
);
