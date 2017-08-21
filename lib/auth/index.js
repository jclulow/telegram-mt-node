var mod_assert = require('assert-plus');
var mod_verror = require('verror');
var mod_vasync = require('vasync');

var VE = mod_verror.VError;

var AuthKey = require('./auth-key');
var RequestPQ = require('./request-pq');
var RequestDHParams = require('./request-dh-params');
var SetClientDHParams = require('./set-client-dh-params');

function
createAuthKey(opts, callback) {
	mod_assert.object(opts, 'opts');
	mod_assert.object(opts.channel, 'opts.channel');
	mod_assert.object(opts.log, 'opts.log');
	mod_assert.func(callback, 'callback');

	var log = opts.log.child({ func: 'createAuthKey' });
	var context;

	mod_vasync.waterfall([ function _request_pq(next) {
		log.info('RequestPQ');
		RequestPQ(function (err, _context) {
			if (err) {
				next(VE(err, 'RequestPQ'));
				return;
			}

			context = _context;
			setImmediate(next);

		}, opts.channel);

	}, function _request_dh_params(next) {
		log.info('RequestDHParams');
		RequestDHParams(function (err, _context) {
			if (err) {
				next(VE(err, 'RequestDHParams'));
				return;
			}

			context = _context;
			setImmediate(next);

		}, context);

	}, function _set_client_dh_params(next) {
		log.info('SetClientDHParams');
		SetClientDHParams(function (err, _context) {
			if (err) {
				next(VE(err, 'SetClientDHParams'));
				return;
			}

			context = _context;
			setImmediate(next);

		}, context);

	}], function (err) {
		if (err) {
			log.warn({ err: err }, 'createAuthKey failed ' +
			    '(retry)');
			setTimeout(function () {
				createAuthKey(opts, callback);
			}, 2 * 1000);
			return;
		}

		log.info('createAuthKey ok!');
		callback(null, context); /* XXX ? */
	});
}

module.exports = {
	AuthKey: AuthKey,

	createAuthKey: createAuthKey
};
/* vim: set ts=8 sts=8 sw=8 noet: */
