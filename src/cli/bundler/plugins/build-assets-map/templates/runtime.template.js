var assets = JSON.parse(__ADNBN_VALUE__)[__ADNBN_ENVELOPE__];
var entries = __ADNBN_FULL_MAP__ ? Object.keys(assets).map(name => assets[name]) : [assets];

// realContentHash can merge multiple chunk filenames into one emitted file.
// Normalize after those substitutions, preserving the dependency order.
entries.forEach(entry => {
    entry.initial.js = Array.from(new Set(entry.initial.js));
    entry.initial.css = Array.from(new Set(entry.initial.css));
    var initial = new Set(entry.initial.js.concat(entry.initial.css));
    entry.async.js = Array.from(new Set(entry.async.js)).filter(file => !initial.has(file));
    entry.async.css = Array.from(new Set(entry.async.css)).filter(file => !initial.has(file));
});

__ADNBN_REQUIRE__[__ADNBN_PROPERTY__] = assets;
