// Config used for tests files
module.exports = {
    presets: [
        [
            '@babel/preset-env',
            {
                targets: {
                    // Only browsers with support of async/await are supported
                    // List based on the GitHub preset: https://github.com/github/babel-preset-github/blob/master/index.js
                    browsers: [
                        'last 8 Chrome versions',
                        'last 4 Firefox versions',
                        'last 3 Safari versions',
                        'last 4 Edge versions',
                        'Firefox ESR',
                        'Chrome >= 55',
                        'Firefox >= 63',
                        'Safari >= 10.3',
                        'Edge >= 15',
                        'Opera >= 42'
                    ]
                },
                loose: true,
                modules: false,
                useBuiltIns: 'usage',
                corejs: 3
            }
        ],
        '@babel/preset-react'
    ]
};
