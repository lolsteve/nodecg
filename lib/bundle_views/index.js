'use strict';

var express = require('express');
var app = express();
var configHelper = require('../config');
var filteredConfig = configHelper.getFilteredConfig();
var cheerio = require('cheerio');
var fs = require('fs');
var path = require('path');
var util = require('util');
var log = require('../logger')('nodecg/lib/bundle_views');
var Bundles = require('../bundles');

require('string.prototype.endswith');

log.trace('Adding Express routes');

app.set('views', path.resolve(__dirname, '../..'));

app.get('/view/:bundleName*', function(req, res, next) {
    var bundleName = req.params.bundleName;

    var bundle = Bundles.find(bundleName);

    if (!bundle) {
        next();
        return;
    }

    // We start out assuming the user is trying to reach the index page
    var resName = 'index.html';

    //  We need a trailing slash for view index pages so that relatively linked assets can be reached as expected.
    if (!req.params[0] && !req.url.endsWith('/')) {
        res.redirect(req.url + '/');
        return;
    }

    // If the first param isn't just a slash, the user must be trying to resolve an asset and not the index page
    if (req.params[0] !== '/' && !req.url.endsWith('/')) {
        resName = req.params[0].substr(1);
    }

    var fileLocation = path.join(bundle.dir, 'view', resName);

    // Check if the file exists
    if (!fs.existsSync(fileLocation)) {
        next();
        return;
    }

    // If it's a HTML file, inject the viewsetup script and serve that
    // otherwise, send the file unmodified
    if (resName.endsWith('.html')) {
        var file = fs.readFileSync(fileLocation);
        var $ = cheerio.load(file);

        var scripts = '<script src="/socket.io/socket.io.js"></script>' +
            '<script src="/nodecg-api.js"></script>' +
            '<script>var socket = io("//%s/");' +
            'window.nodecg = new NodeCG("%s", %s, %s, socket);</script>';

        scripts = util.format(scripts, filteredConfig.baseURL, bundle.name,
            JSON.stringify(bundle.config), JSON.stringify(filteredConfig));

        var currentHead = $('head').html();
        $('head').html(scripts + currentHead);

        res.send($.html());
    } else {
        res.sendFile(fileLocation);
    }
});

app.get('/view/:bundle/components/*', function(req, res, next) {
    var bundleName = req.params.bundle;

    var bundle = Bundles.find(bundleName);

    if (!bundle) {
        next();
        return;
    }

    var resName = req.params[0];

    var fileLocation = path.join(bundle.dir, 'bower_components', resName);

    // Check if the file exists
    if (!fs.existsSync(fileLocation)) {
        next();
        return;
    }

    res.sendFile(fileLocation);
});

module.exports = app;
