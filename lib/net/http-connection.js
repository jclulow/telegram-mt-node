//     telegram-mt-node
//     Copyright 2014 Enrico Stara 'enrico.stara@gmail.com'
//     Released under the MIT License
//     https://github.com/enricostara/telegram-mt-node

//     HttpConnection class
//
// This class provides a HTTP transport to communicate with `Telegram` using `MTProto` protocol


var mod_http = require('http');

var mod_assert = require('assert-plus');
var mod_verror = require('verror');

var VE = mod_verror.VError;



function
HttpConnection(options)
{
	mod_assert.object(options, 'options');
	mod_assert.string(options.host, 'options.host');
	mod_assert.number(options.port, 'options.port');
	mod_assert.object(options.log, 'options.log');

	var self = this;

	self.htc_host = options.host;
	self.htc_port = options.port;
	self.htc_log = options.log;

	self.htc_connected = false;
	self.htc_outbound = new Buffer(0);
}

HttpConnection.prototype.connect = function
connect(callback)
{
	mod_assert.func(callback, 'callback');

	var self = this;

	if (self.htc_connected) {
		callback(VE('already connected'));
		return;
	}
	self.htc_connected = true;

	setImmediate(callback);
};

HttpConnection.prototype.close = function
close(callback)
{
	mod_assert.func(callback, 'callback');

	var self = this;

	if (!self.htc_connected) {
		callback(VE('not connected'));
		return;
	}
	self.htc_connected = false;

	setImmediate(callback);
};

HttpConnection.prototype.write = function
write(data, callback)
{
	mod_assert.ok(Buffer.isBuffer(data), 'data (Buffer)');
	mod_assert.func(callback, 'callback');

	var self = this;

	if (!self.htc_connected) {
		callback(VE('must be connected'));
		return;
	}

	self.htc_outbound = Buffer.concat([ self.htc_outbound, data ]);

	setImmediate(callback);
};

HttpConnection.prototype.read = function
read(callback)
{
	mod_assert.func(callback, 'callback');

	var self = this;

	var reqopts = {
		host: self.htc_host,
		port: self.htc_port,
		path: '/apiw1',
		headers: {
			'host': self.htc_host + ':' + self.htc_port,
			'connection': 'keep-alive',
		},
		method: 'GET'
	};

	if (self.htc_outbound.length > 0) {
		reqopts.headers['content-length'] =
		    '' + self.htc_outbound.length;
		reqopts.method = 'POST';
	}

	var req = mod_http.request(reqopts);

	if (self.htc_outbound.length > 0) {
		req.write(self.htc_outbound);
		self.htc_outbound = new Buffer(0);
	}

	var ended = false;
	var fail = function (err, res) {
		if (ended) {
			return;
		}
		ended = true;

		callback(err, res);
	};

	req.on('error', function (err) {
		fail(VE(err, 'HTTP req failure'));
	});

	req.on('response', function (res) {
		var inbound = new Buffer(0);

		res.on('readable', function () {
			var d;

			while ((d = res.read()) !== null) {
				inbound = Buffer.concat([ inbound, d ]);
			}
		});

		res.on('error', function (err) {
			fail(VE(err, 'HTTP res failure'));
		});

		res.on('end', function () {
			if (res.statusCode === 200) {
				fail(null, inbound);
				return;
			}

			fail(VE('HTTP failure (status %d)', res.statusCode));
		});
	});

	req.end();
};

module.exports = exports = HttpConnection;
/* vim: set ts=8 sts=8 sw=8 noet: */
