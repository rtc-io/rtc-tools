module.exports = function(target, prefixes) {
    var prefixIdx, prefix, testName;

    // initialise to default prefixes (reverse order as we use a decrementing for loop)
    prefixes = (prefixes || ['ms', 'o', 'moz', 'webkit']).concat('');

    // iterate through the prefixes and return the class if found in global
    for (prefixIdx = prefixes.length; prefixIdx--; ) {
        prefix = prefixes[prefixIdx];

        // construct the test class name
        // if we have a prefix ensure the target has an uppercase first character
        // such that a test for getUserMedia would result in a search for webkitGetUserMedia
        testName = prefix + (prefix ? 
                                target.charAt(0).toUpperCase() + target.slice(1) :
                                target);

        if (typeof this[testName] == 'function') {
            return this[testName];
        }
    }
};