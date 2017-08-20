//     telegram-mt-node
//     Copyright 2014 Enrico Stara 'enrico.stara@gmail.com'
//     Released under the MIT License
//     https://github.com/enricostara/telegram-mt-node

//     RpcChannel class
//
// This class provides a remote procedure call channel to `Telegram` through the given TCP|HTTP connection.
// This channel in not encrypted and therefore use PlainMessage objects to wrap the communication.
// According with the MTProto specification, only few methods can use unencrypted message, see:
// https://core.telegram.org/mtproto/description#unencrypted-messages

var mod_assert = require('assert-plus');

// Import dependencies
var message = require('../message');

// The constructor require a [Http|Tcp]Connection, the connection must be already open.
function RpcChannel(opts) {
    mod_assert.object(opts, 'opts');
    mod_assert.object(opts.conn, 'opts.conn');
    mod_assert.object(opts.log, 'opts.log');

    this._connection = opts.conn;
    this._log = opts.log;
    this._open = true;
    this._queue = [];

    setImmediate(this.__executor.bind(this));
}

RpcChannel.prototype.__executor = function () {
    var self = this;

    if (self._queue.length < 1)
        return;

    var task = self._queue.shift();
    self._executeCall(task.reqMsg, function (err, resObj, duration) {
        /*
         * Reschedule for the next tick:
         */
        setImmediate(self.__executor.bind(self));

        self._log.debug({
            err: err,
            resObj: resObj,
            duration: duration
        }, 'response');

        if (err) {
            task.callback(err);
            return;
        }

        task.callback(null, resObj, duration);
    });
};

// Execute remotely the given method (Type function) using the channel, call back with the response
RpcChannel.prototype.callMethod = function (method, callback) {
    mod_assert.object(method, 'method');
    mod_assert.func(callback, 'callback');

    var self = this;

    if (!self._open) {
        callback(new Error('Channel is closed'));
        return;
    }

    self._log.debug({ method: method }, 'rpc method call');

    var reqmsg = new message.PlainMessage({ message: method });
    self._call(reqmsg, callback);
};

/*
 * This method is overridden by the Encrypted RPC subclass.
 */
RpcChannel.prototype._call = function (reqMsg, callback) {
    mod_assert.object(reqMsg, 'reqMsg');
    mod_assert.func(callback, 'callback');

    var self = this;

    self._queue.push({
        reqMsg: reqMsg,
        callback: callback
    });
    setImmediate(self.__executor.bind(self));
};

// Execute the call (protected).
RpcChannel.prototype._executeCall = function (reqMsg, callback) {
    var self = this;

    var conn = self._connection;
    var start = new Date().getTime();

    conn.write(reqMsg.serialize(), function (ex) {
        if (ex) {
            self._log.debug({ err: ex }, 'rpc write error');
            callback(ex);
            return;
        }

        conn.read(function (ex2, response) {
            if (ex2) {
                self._log.debug({ err: ex2 }, 'rpc read error');
                callback(ex2);
                return;
            }

            var resObj;
            var duration;
            try {
                //if (logger.isDebugEnabled()) {
                    //logger.debug('response(%s): %s ', response.length, response.toString('hex'));
                //}
                resObj = self._deserializeResponse(response);
                duration = new Date().getTime() - start;
                //if (logger.isDebugEnabled()) {
                    //logger.debug('%s executed in %sms',
                        //(reqMsg.body ? reqMsg.body.getTypeName() : ''), duration);
                //}
            } catch (ex3) {
                self._log.debug({ error: ex3 }, 'rpc deserialise error');
                //logger.error('Unable to deserialize response %s from %s due to %s ',
                  //  response.toString('hex'), (reqMsg.body ? reqMsg.body.getTypeName() : ''), ex3.stack);
                callback(ex3);
                return;
            }

            callback(null, resObj, duration);
        });
    });
};

RpcChannel.prototype._deserializeResponse = function (response) {
    return new message.PlainMessage({buffer: response}).deserialize().body;
};

// Check if the channel is open.
RpcChannel.prototype.isOpen = function () {
    return this._open;
};

// Close the channel
RpcChannel.prototype.close = function () {
    this._log.debug('rpc channel close');
    this._open = false;
};

// Export the class
module.exports = exports = RpcChannel;
