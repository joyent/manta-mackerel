#!/usr/node/bin/node
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2014, Joyent, Inc.
 */

/* BEGIN JSSTYLED */
/*
 * sample object record:
 * {
 *   "dirname": "/cc56f978-00a7-4908-8d20-9580a3f60a6e/stor/logs/postgresql/2012/11/12/18",
 *   "key": "/cc56f978-00a7-4908-8d20-9580a3f60a6e/stor/logs/postgresql/2012/11/12/18/49366a2c.log.bz2",
 *   "headers": {},
 *   "mtime": 1352746869592,
 *   "owner": "cc56f978-00a7-4908-8d20-9580a3f60a6e",
 *   "type": "object",
 *   "contentLength": 84939,
 *   "contentMD5": "iSdRMW7Irsw1UwYoRDFmIA==",
 *   "contentType": "application/x-bzip2",
 *   "etag": "5fcc0345-1044-4b67-b7e8-98ee692001bc",
 *   "objectId": "5fcc0345-1044-4b67-b7e8-98ee692001bc",
 *   "sharks": [
 *     {
 *       "availableMB": 20477,
 *       "percentUsed": 1,
 *       "datacenter": "bh1-kvm1",
 *       "server_uuid": "44454c4c-4700-1034-804a-c7c04f354d31",
 *       "zone_uuid": "ef8b166a-ac3e-4d59-bb73-a65e2b17ba44",
 *       "url": "http://ef8b166a-ac3e-4d59-bb73-a65e2b17ba44.stor.bh1-kvm1.joyent.us"
 *     },
 *     {
 *       "availableMB": 20477,
 *       "percentUsed": 1,
 *       "datacenter": "bh1-kvm1",
 *       "server_uuid": "44454c4c-4700-1034-804a-c7c04f354d31",
 *       "zone_uuid": "59fb8bd3-67a7-4da2-bb68-287e2db01ec1",
 *       "url": "http://59fb8bd3-67a7-4da2-bb68-287e2db01ec1.stor.bh1-kvm1.joyent.us"
 *     }
 *   ]
 * }
 */

/*
 * sample directory record:
 * {
 *   "dirname": "/cc56f978-00a7-4908-8d20-9580a3f60a6e/stor/manatee_backups/1.moray.bh1-kvm1.joyent.us",
 *   "key": "/cc56f978-00a7-4908-8d20-9580a3f60a6e/stor/manatee_backups/1.moray.bh1-kvm1.joyent.us/2012-11-13-02-00-03",
 *   "headers": {},
 *   "mtime": 1352772004269,
 *   "owner": "cc56f978-00a7-4908-8d20-9580a3f60a6e",
 *   "type": "directory"
 * }
 */

/*
 * aggr format:
 * {
 *      owner: {
 *              "dirs": {
 *                      namespace: 0,
 *                      ...
 *              },
 *              "objects": {
 *                      objectId: {
 *                              namespace: 0, // count of # keys in this
 *                                            // namespace for this objectId
 *                              ...
 *                              _size: 0
 *                      },
 *                      ...
 *              }
 *      },
 *      ...
 * }
 */

/*
 * output format:
 * {
 *      "owner": owner,
 *      "namespace": namespace,
 *      "directories": directories,
 *      "keys": keys,
 *      "objects": objects,
 *      "bytes": bytes
 * }
 */

/* END JSSTYLED */

var mod_carrier = require('carrier');
var Big = require('big.js');
var ERROR = false;
var MIN_SIZE = +process.env['MIN_SIZE'] || 131072;

var LOG = require('bunyan').createLogger({
        name: 'storage-reduce1.js',
        stream: process.stderr,
        level: process.env['LOG_LEVEL'] || 'info'
});

var NAMESPACES = (process.env.NAMESPACES).split(' ');

function count(record, aggr) {
        var owner = record.owner;
        var type = record.type;
        var namespace;
        try {
                namespace = record.key.split('/')[2]; // /:uuid/:namespace/...
        } catch (e) {
                LOG.error(e, 'error getting namespace: ' + record.key);
                ERROR = true;
                return;
        }

        aggr[owner] = aggr[owner] || {
                dirs: {},
                objects: {}
        };

        aggr[owner].dirs[namespace] = aggr[owner].dirs[namespace] || 0;

        if (type === 'directory') {
                aggr[owner].dirs[namespace]++;
        } else if (type === 'object') {
                var index = aggr[owner].objects;
                var n;
                try {
                        var objectId = record.objectId;
                        var size = Math.max(record.contentLength, MIN_SIZE) *
                            record.sharks.length;
                } catch (e) {
                        console.warn(e);
                        return;
                }

                if (!index[objectId]) {
                        index[objectId] = {};
                        for (n in NAMESPACES) {
                                index[objectId][NAMESPACES[n]] = 0;
                        }
                }

                index[objectId][namespace]++;
                index[objectId]._size = size;
        } else {
                LOG.error(record, 'unrecognized object type: ' + type);
                ERROR = true;
        }
}

function printResults(aggr) {
        var n, dirs;
        Object.keys(aggr).forEach(function (owner) {
                var keys = {};
                var bytes = {};
                var objects = {};

                for (n in NAMESPACES) {
                        keys[NAMESPACES[n]] = 0;
                        bytes[NAMESPACES[n]] = new Big(0);
                        objects[NAMESPACES[n]] = 0;
                }

                Object.keys(aggr[owner].objects).forEach(function (object) {
                        var counted = false;
                        var objCounts = aggr[owner].objects[object];
                        for (n in NAMESPACES) {
                                if (!counted && objCounts[NAMESPACES[n]] > 0) {
                                        counted = true;
                                        var size = objCounts._size;
                                        bytes[NAMESPACES[n]] =
                                                bytes[NAMESPACES[n]].plus(size);
                                        objects[NAMESPACES[n]]++;
                                }
                                keys[NAMESPACES[n]] += objCounts[NAMESPACES[n]];
                        }
                });

                for (n in NAMESPACES) {
                        dirs = aggr[owner].dirs[NAMESPACES[n]] || 0;
                        console.log(JSON.stringify({
                                owner: owner,
                                namespace: NAMESPACES[n],
                                directories: dirs,
                                keys: keys[NAMESPACES[n]],
                                objects: objects[NAMESPACES[n]],
                                bytes: bytes[NAMESPACES[n]].toString()
                        }));
                }
        });
}


function main() {
        var carry = mod_carrier.carry(process.openStdin());

        var aggr = {};
        var lineCount = 0;
        carry.on('line', function onLine(line) {
                lineCount++;
                try {
                        var record = JSON.parse(line);
                } catch (e) {
                        LOG.error(e, 'Error on line ' + lineCount);
                        ERROR = true;
                        return;
                }

                if (!record.owner || !record.type) {
                        LOG.error(line, 'Missing owner or type field on line ' +
                                lineCount);
                        ERROR = true;
                        return;
                }

                count(record, aggr);
        });

        carry.on('end', function onEnd() {
                printResults(aggr);
        });
}

if (require.main === module) {
        process.on('exit', function onExit() {
                process.exit(ERROR);
        });

        main();
}
