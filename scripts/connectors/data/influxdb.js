// Copyright (c) 1992-2016 TomTom N.V. All rights reserved.
// This software is the proprietary copyright of TomTom N.V. and its subsidiaries and may be
// used for internal evaluation purposes or commercial use strictly subject to separate
// licensee agreement between you and TomTom. If you are the licensee, you are only permitted
// to use this Software in accordance with the terms of your license agreement. If you are
// not the licensee then you are not authorised to use this software in any manner and should
// immediately return it to TomTom N.V.
define(["core/metadata", "core/testrun"], function(MetaData, TestRun)
{
    function InfluxDBConnector(url, username, password)
    {
        var _maps = {};
        var _tests = {};
        
        /**
         * Submit a raw query to influxdb.
         * @param query the query to execute.
         * @param callback the callback to call when the data has been read.
         */
        function query(query, callback) {
            $.ajax({
                url: url,
                data: {
                    epoch: 'u',	// Return time in microseconds
                    p: password,
                    q: query,
                    u: username
                }
            }).done(function(result) {
                callback(null, result);
            }).fail(function(xhr, errorMsg, errorThrown) {
                callback( (errorMsg || "Request failed") + " [HTTP " + xhr.status + "]: " + (errorThrown || "unknown error") );
            });
        };

        /**
         * Constructs a textual boolean expression valid for use in an InfluxDB query
         * that is true if 'time' is within the begin and end time range.
         * Note: this filter might not be *exact*, so always use a conditional
         * on the retrieved data to be sure.
         * 
         * @param beginTime the begin time, in microseconds.
         * @param endTime the end time, in microseconds.
         */
        function createTimeFilter(beginTime, endTime)
        {
            // Construct the time filter. InfluxDB supports only > and < (no >= or <=), 
            // so we seem to have to expand by 1.
            var conditions = [];
            if (beginTime) conditions.push('time > ' + (beginTime - 1) + 'u');
            if (endTime) conditions.push('time < ' + (endTime + 1) + 'u');
            return conditions.join(' and ');
        };

        /**
         * Creates a new MetaData object from a raw key
         * 
         * @param rawKey the raw series name to parse for meta data.
         */
        function createMetaData(rawKey)
        {
            // Key format:
            // event,device=B6,deviceType=Nav4,functionalArea=Locations,mapId=Europe-945.6240,mapType=TTC,os=Android,stream=dev-15.6-bugfix,
            //       testCase=test_01_GetIconList_MultipleIcons_Parallel,testSuite=IconAssetDataFemalePerformanceTest,testType=Interface

            var keyParts = rawKey.split(',');
            var measurementName = keyParts.shift();
            var tags = {};
            _.each(keyParts, function(keyPart) {
                var indexEqual = keyPart.indexOf('=');
                var key = keyPart.substring(0, indexEqual);
                var value = keyPart.substring(indexEqual + 1);
                tags[key] = value;
            });

            return MetaData.create(tags);
        }
        
        /**
         * Returns a where-clause expression from the current filter to be
         * used in further queries to influxdb.
         * 
         * @param filter the MetricsFilter to create a where-clause for.
         */
        function createFilterClause(filter) {
            function or(key, opts) {
                if ($.isArray(opts) && opts.length > 0) {
                    opts = _.map(opts, function(opt) {
                        return key + "='" + opt + "'";
                    });
                    return '(' + opts.join(' or ') + ')';
                }
            }
            
            // Turn the map filter into a concrete list of map IDs
            var mapIds = [];
            _.each(filter.mapName, function(mapName) {
                if (_.isArray(_maps[mapName])) {
                    mapIds = mapIds.concat(_maps[mapName]);
                }
            });

            var clause = '';
            _.each(MetaData.getTags(), function(key) {
                if (filter[key]) {
                    if (clause !== '') {
                        clause += ' and ';
                    }
                    clause += or(key, filter[key]);
                }
            });
            if (mapIds.length) {
                clause += ' and ' + or('mapId', mapIds);
            }

            return clause;
        };

        /**
         * Returns a where-clause expression from the current metadata that may be
         * used in further queries to influxdb.
         * 
         * @param metadata   the metadata of the test run to create a where-clause for.
         */
        function createMetaDataClause(metadata) {
            var clause = '';
            _.each(MetaData.getTags(), function(tag) {
                if (clause !== '') {
                    clause += ' and ';
                }
                clause += tag + "='" + metadata[tag] + "'";
            });

            return clause;
        };

        /**
         * Retrieves test runs.
         * The returned value (passed through the callback), will be a list
         * of objects, one per configuration, containing a {@link MetaData}
         * object and a list of {@link TestRun} objects.
         * 
         * @param filter the metrics filter to apply.
         * @param beginTime only retrieve test runs after the beginTime (in milliseconds).
         * @param callback the callback to call when done.
         */
        this.getTestRuns = function(filter, beginTime, callback)
        {
            var configs = {};
                    
            query('show series from "event" where ' + createFilterClause(filter), function(err, result) {

                // {"results":[{"series":[{"columns":["key"],"values":[
                //		["event,device=Italia,stream=dev-nks,testCase=test01,testSuite=SuiteTest,testType=Interface"],
                //		["event,device=Samsung,stream=dev-nks,testCase=test01,testSuite=SuiteTest,testType=Interface"]]}]}]}

                if (err) {
                    return callback(err);
                }

                // Map each series name into a query for counters/timers
                var selectQueries = _.map(result.results[0].series[0].values, function(value) {
                    var metadata = createMetaData(value[0]);
                    var metaDataClause = createMetaDataClause(metadata);
                    return {
                        metadata: metadata,
                        query: 'select time,deviceId,revision,run,val from "event" where (time > ' + Math.floor((beginTime - 1) / 1000) + 's) and '
                            + metaDataClause + " and (val='Begin' or val='End') order by time desc"
                    };
                });
                
                // Execute ';'-separated list of queries 
                query(_.pluck(selectQueries, 'query').join(' ; '), function(err, result) {
                    var timeIndex = 0;
                    var deviceIdIndex = 1;
                    var revisionIndex = 2;
                    var runIndex = 3;
                    var valIndex = 4;
                    
                    if (err) {
                        return callback(err);
                    }

                    //{"results": [
                    //    {},
                    //    {"series": [{"name": "event",
                    //        "columns": ["time", "revision", "run", "val"],
                    //        "values": [
                    //            [1484886631335966, "p4:2570949.SHELVED-2573193", "qb:9234958", "End"],
                    //            [1484886599003879, "p4:2570949.SHELVED-2573193","qb:9234958","Begin"],
                    //            [1484760126520153, "p4:2570752.SHELVED-2567185", "qb:9229219", "End"],
                    //            [1484760093836181, "p4:2570752.SHELVED-2567185", "qb:9229219", "Begin"]]}]},
                    //    {"series": [{"name": "event",
                    //        "columns": ["time", "revision", "run", "val"],
                    //        "values": [
                    //            [1484891561836239, "p4:2570949.SHELVED-2573193", "qb:9234958", "End"],
                    //            [1484891529570192, "p4:2570949.SHELVED-2573193", "qb:9234958", "Begin"]]}]}]}
                    for (var queryIndex = 0; queryIndex < selectQueries.length; ++queryIndex) {
                        var metadata = selectQueries[queryIndex].metadata;
                        var series = result.results[queryIndex].series;

                        if (!series || !series[0] || !series[0].values) {
                            console.log("No results found for series with metadata " + metadata + ". Skipping");
                            continue;
                        }

                        var points = series[0].values;

                        var runs = {};
                        for (var i = 0; i < points.length - 1; ++i)
                        {
                            var end = points[i+0];
                            var begin = points[i+1];
                            if (begin[valIndex] === 'Begin' && end[valIndex] === 'End')
                            {
                                var buildId = begin[runIndex];
                                if (buildId) {
                                    var run = TestRun.create(buildId, begin[timeIndex], end[timeIndex], begin[revisionIndex], begin[deviceIdIndex], metadata);
                                    runs[run.runId] = run;
                                }
                            }
                        }

                        var mdid = metadata.getId();
                        configs[mdid] = configs[mdid] || {metadata: metadata, runs: {}};
                        $.extend(configs[mdid].runs, runs);
                    }

                    callback(null, _.values(configs));
                });
            });
        };
        
        /**
         * Initializes the connector by fetching all metadata from the DB.
         * This method must be called first, before any other methods are to
         * be called.
         * 
         * @param callback the callback that is called when the connector has
         *              been initialized.
         */
        this.initialize = function(callback)
        {
            // All the tests will at least start with an /event/... metric, so by limiting
            // the query to only events it's possible to get a list of metrics from a shorter
            // list of keys
            query('show series from "event"', function(err, result)
            {
                if (err) {
                    return callback(err);
                }

                // {"results":[{"series":[{"columns":["key"],"values":[
                //		["event,device=Italia,stream=dev-nks,testCase=test01,testSuite=SuiteTest,testType=Interface"],
                //		["event,device=Samsung,stream=dev-nks,testCase=test01,testSuite=SuiteTest,testType=Interface"]]}]}]}

                var maps = {};
                var tests = {};
                _.each(result.results[0].series[0].values, function(val) {
                    var k = createMetaData(val[0]);

                    var id = k.getTestId();
                    if (_.isUndefined(tests[id])) {
                        tests[id] = [];
                    }
                    tests[id].push(k);
                    
                    if (_.isUndefined(maps[k.mapName])) {
                        maps[k.mapName] = [];
                    }
                    maps[k.mapName].push(k.mapId);
                });
                
                _tests = tests;
                _maps = _.mapObject(maps, function(m) {
                    return _.uniq(m);
                });
                
                callback(null);
            }.bind(this));
        };
        
        /**
         * Returns a list of all test cases and their configurations,
         * grouped by test ID (test type + test suite + test case).
         */
        this.getTestConfigurations = function()
        {
            return $.extend(true, {}, _tests);
        };

        /**
         * Retrieves all metrics data for a list of {@link TestRuns}.
         * 
         * The format of the returned metrics:
         * [
         *   // Data for first test run
         *   {
         *     "metric A": {
         *       data: [[t1, y1], [t2, y2], ...],
         *       expected: 4.0,
         *       aggregations: { min: {value: 2.0, expected: 5.0}, ... }
         *     },
         *     "metric B": { ... },
         *     ...
         *   },
         *   
         *   // Data for second test run
         *   ...
         * ]
         * 
         * @param runs the TestRuns to get the metrics data for.
         * @param callbackMetricsData callback that will be called with the data.
         */
        this.getMetricsData = function(runs, callbackMetricsData)
        {
            // Create separate requests per testrunFilterClause.
            var groupedRuns = _.groupBy(runs, function(run) {
                // This is the testrunFilterClause with all metadata.
                // This excludes the ProcessName, MetricType, MetricName, and Aggregation.
                return createMetaDataClause(run.metadata);
            });
            
            var testrunFilterClauses = _.keys(groupedRuns);

            async.map(testrunFilterClauses, function(testrunFilterClause, callbackSelectData) {

                // Create the time filter
                var groupedRunsForFilter = groupedRuns[testrunFilterClause];
                var beginTime = _.min(_.pluck(groupedRunsForFilter, "beginTime"));
                var endTime = _.max(_.pluck(groupedRunsForFilter, "endTime"));
                var timeFilter = createTimeFilter(beginTime, endTime);

                query('select time,val,expected,process from /^(timer|counter)/ where ' + timeFilter + ' and ' + testrunFilterClause + ' order by time asc', callbackSelectData);

            }, function(err, results) {
                if (err) {
                    return callbackMetricsData(err);
                }

                var data = {};

                var timeIndex = 0;
                var valIndex = 1;
                var expectedIndex = 2;
                var processNameIndex = 3;

                _.each(_.object(testrunFilterClauses, results), function(result, testrunFilterClause) {

                    //{"results": [{"series": [
                    //    {   "name": "counter.MapMatching.ADAS.ResetPathCount.None",
                    //        "columns": ["time", "val", "expected"],
                    //        "values": [
                    //            [1484877348072927, "1", ""]]},
                    //    {   "name": "counter.MapMatching.ADAS.ResetPathCount.Sum",
                    //        "columns": ["time", "val", "expected"],
                    //        "values": [
                    //            [1484877378624161, "1", ""]]},
                    //    {   "name": "timer.MapMatching.ADAS.ResetPath.None",
                    //        "columns": ["time", "val", "expected"],
                    //        "values": [
                    //            [1484877348095087, "7087", ""]]}]}]}
                    _.each(result.results[0].series, function(metric) {

                        var parts = metric.name.split('.');
                        var aggregation = parts.pop().toLowerCase();                     // Retrieve/strip aggregation in lowercase
                        parts[0] = parts[0].charAt(0).toUpperCase() + parts[0].slice(1); // Capitalize first letter of counter/timer
                        var metricName = parts.join('.');
                        
                        _.each(metric.values, function (point) {
                            var timestamp = point[timeIndex];
                            var value = point[valIndex];
                            var expected = point[expectedIndex];
                            var processName = point[processNameIndex];
                            
                            var processMetricName = [ processName, metricName].join('.');

                            // Find the run this point belongs to
                            var run = _.find(runs, function(run) {
                                return timestamp >= run.beginTime && timestamp <= run.endTime;
                            });

                            if (run) {
                                var rundata = data[run.runId] = data[run.runId] || {};
                                var metric = rundata[processMetricName] = rundata[processMetricName] || { data: [], aggregations: {} };

                                if (aggregation === 'none') {
                                    var usOffset = timestamp - run.beginTime;
                                    metric.expected = expected;
                                    metric.data.push([Math.round(usOffset / 1000), value]);
                                } else {
                                    metric.aggregations[aggregation] = {
                                            value: value,
                                            expected: expected
                                    };
                                }
                            }
                        });
                    });
                });

                callbackMetricsData(null, data);
            });
        };
        
        /**
         * Retrieves the checkpoint data for a specific {@link TestRun}.
         * The format of the returned checkpoints:
         * [
         *   [time, name],
         *   ...
         * ]
         * 
         * @param run the TestRun to get the checkpoint data for.
         * @param callback callback that will be called with the data.
         */
        this.getCheckpointData = function(run, callback)
        {
            // This is the filter clause that filters on all metadata that identifies a test run.
            var testrunFilterClause = createMetaDataClause(run.metadata);
            var timeFilter = createTimeFilter(run.beginTime, run.endTime);

            var timeIndex = 0;
            var checkpointNameIndex = 1;
            var processNameIndex = 2;
            
            query('select time,val,process from "checkpoint" where ' + timeFilter + ' and ' + testrunFilterClause + ' order by time asc', function(err, result)
            {
                if (err) {
                    return callback(err);
                }

                //{"results": [{"series": [{"name": "checkpoint",
                //    "columns": [
                //        "time",
                //        "val",
                //        "process"
                //    ],
                //    "values": [
                //        [
                //            1457476548341941,
                //            "Engines.System.Start",
                //            "NavKitStartupPerformanceTest.test_NavKitAndMapViewerStart"
                //        ],
                //        [
                //            1457476557380189,
                //            "MapVis.SceneRendererSdk.AllTilesAreRendered",
                //            "NavKitStartupPerformanceTest.test_NavKitAndMapViewerStart"
                //        ]
                //    ]}]}]}

                // Construct the checkpoints from the metrics
                var checkpoints = [];
                
                if (!result || !result.results || !result.results[0] || !result.results[0].series || !result.results[0].series[0] || !result.results[0].series[0].values) {
                    console.log("No checkpoint data");
                } else {
                    _.each(result.results[0].series[0].values, function (point) {
                        var timestamp = point[timeIndex];
                        if (timestamp >= run.beginTime && timestamp <= run.endTime) {
                            var usOffset = timestamp - run.beginTime;
                            checkpoints.push([usOffset, point[processNameIndex] + '.' + point[checkpointNameIndex]]);
                        }
                    });
                }

                callback(null, checkpoints);
            });
        };
    
        return this;
    }
    
    return {
        create: function (url, username, password)
        {
            return new InfluxDBConnector(url, username, password);
        }
    };
});
