#! /usr/bin/env node
/* eslint-disable no-console */
const { Value } = require('slate');
const { default: hyperprint } = require('slate-hyperprint');
const { transform } = require('./helper');

transform(document => {
    const state = Value.create({ document });
    console.log(hyperprint(state));
});
