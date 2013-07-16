/* jshint node: true */

'use strict';

/**
# rtc/media

This is a convenience import of the `rtc-media` package into the `rtc`
package. For example, both of the following `require` statements return
equivalent modules:

```js
var media;

// use the rtc/media entry point
media = require('rtc/media');

// use rtc-media directly
media = require('rtc-media');
```

In most cases we would recommend importing `rtc` into your application and
using that.  In a case that you are writing a web application that does not
require the full WebRTC suite but only want to work with getUserMedia then
you may consider using `rtc-media` directly.

For the full rtc-media reference see:

<http://rtc.io/modules/media>
**/

module.exports = require('rtc-media');