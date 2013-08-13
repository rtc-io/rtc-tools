var browserify = require('browserify');

browserify()
  .add('./index.js')
  .bundle({
    standalone: 'rtc',
    insertGlobalVars: {
      process: function() {
        return {
          id: 'process',
          source: 'return {}'
        };
      },

      global: function() {
        return {
          id: 'global',
          source: 'return {}'
        };
      }
    }
  }).pipe(process.stdout);