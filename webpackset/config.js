const path = require('path');

const resolve = url => path.resolve(__dirname, url);

module.exports = {
  theme: {},
  resolve,
  port: 9000,
  host: '127.0.0.1',
  distPath: resolve('../dist'),
  srcPath: resolve('../src'),
  version: '1.0.0'
};
