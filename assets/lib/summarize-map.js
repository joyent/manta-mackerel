#!/usr/bin/env node
// Copyright (c) 2013, Joyent, Inc. All rights reserved.

var mod_carrier = require('carrier');
var computeTable = require('../etc/billingComputeTable.json').billingTable;
var Big = require('big.js');
var ERROR = false;

function summarizeStorage(record) {
        var bytes = new Big(0);
        Object.keys(record.storage).forEach(function (n) {
                bytes = bytes.plus(record.storage[n].bytes);
        });
        return ({
                owner: record.owner,
                byteHrs: bytes
        });
}

function summarizeRequest(record) {
        return ({
                owner: record.owner,
                requests: record.requests.type,
                bandwidth: {
                        in: record.requests.bandwidth.in,
                        out: record.requests.bandwidth.out
                }
        });
}

function summarizeCompute(record) {
        var jobs = record.jobs;
        var gbSeconds = 0;
        var bwin = new Big(0);
        var bwout = new Big(0);

        function billingLookup(usage) {
                var i;
                for (i = 0; i < computeTable.length; i++) {
                        if (usage['disk'] > computeTable[i]['disk'] ||
                                usage['memory'] > computeTable[i]['memory']) {
                                continue;
                        } else {
                                break;
                        }
                }
                return (computeTable[i].memory);
        }

        Object.keys(jobs).forEach(function (job) {
                var memoryGB;
                var seconds;
                Object.keys(jobs[job]).forEach(function (p) {
                        memoryGB = billingLookup(jobs[job][p]) / 1024;
                        seconds = jobs[job][p]['seconds'];
                        bwin = bwin.plus(jobs[job][p]['bandwidth']['in']);
                        bwout = bwout.plus(jobs[job][p]['bandwidth']['out']);
                        gbSeconds += (seconds * memoryGB);
                });
        });

        return ({
                owner: record.owner,
                computeGBSeconds: gbSeconds,
                bandwidth: {
                        in: bwin,
                        out: bwout
                }
        });
}

function main() {
        var carry = mod_carrier.carry(process.openStdin());
        var lineCount = 0;

         carry.on('line', function onLine(line) {
                lineCount++;
                try {
                        var record = JSON.parse(line, function (key, value) {
                                if (key === '') {
                                        return (value);
                                }
                                if (typeof (value) === 'string') {
                                        try {
                                                return (new Big(value));
                                        } catch (e) {
                                                return (value);
                                        }
                                }
                                return (value);
                        });
                } catch (e) {
                        console.warn('Error on line ' + lineCount + ': ' + e);
                        ERROR = true;
                        return;
                }

                var summary;

                if (typeof (record.storage) !== 'undefined') {
                        summary = summarizeStorage(record);
                } else if (typeof (record.requests) !== 'undefined') {
                        summary = summarizeRequest(record);
                } else if (typeof (record.jobs) !== 'undefined') {
                        summary = summarizeCompute(record);
                }

                console.log(JSON.stringify(summary, function (key, value) {
                        if (value instanceof Big) {
                                return (value.toString());
                        }
                        return (value);
                }));
        });
}

if (require.main === module) {
        process.on('exit', function onExit() {
                process.exit(ERROR);
        });

        main();
}
