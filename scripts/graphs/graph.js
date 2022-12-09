// Copyright (c) 1992-2016 TomTom N.V. All rights reserved.
// This software is the proprietary copyright of TomTom N.V. and its subsidiaries and may be
// used for internal evaluation purposes or commercial use strictly subject to separate
// licensee agreement between you and TomTom. If you are the licensee, you are only permitted
// to use this Software in accordance with the terms of your license agreement. If you are
// not the licensee then you are not authorised to use this software in any manner and should
// immediately return it to TomTom N.V.
define(["graphs/color-allocator", "utils/format-utils", "graphs/legend", "graphs/utils", "core/aggregations"],
function(ColorAllocator, FormatUtils, Legend, GraphUtils, Aggregations)
{
    // Milliseconds/Microseconds per day
    var MS_PER_DAY = 24*60*60*1000;
    var US_PER_DAY = 24*60*60*1000000;
    
    // Line width for data lines
    var DATA_LINE_WIDTH = 2;
    
    // Line width for threshold lines
    var THRESHOLD_LINE_WIDTH = 3;
    
    // Line width for aggregation lines
    var AGGREGATION_LINE_WIDTH = 1;
    
    // Line width for markings (checkpoints)
    var MARKING_LINE_WIDTH = 1;

    // Pretty names for the various aggregations
    var PRETTY_AGGREGATION_NAMES = {};
    PRETTY_AGGREGATION_NAMES[Aggregations.MEDIAN] = "Median";
    PRETTY_AGGREGATION_NAMES[Aggregations.AVERAGE] = "Average";
    PRETTY_AGGREGATION_NAMES[Aggregations.MAXIMUM] = "Maximum";
    PRETTY_AGGREGATION_NAMES[Aggregations.MINIMUM] = "Minimum";
    PRETTY_AGGREGATION_NAMES[Aggregations.SUM] = "Sum";

    // Metrics we try to give the same color
    var FIXED_COLOR_METRICS = [
        'NavKit.Counter.System.CPU.Usage',
        'NavKit.Counter.System.Memory.PSS',
        'MapViewer.Counter.System.CPU.Usage',
        'MapViewer.Counter.System.Memory.PSS'
    ];
    
    // Metrics we never want to see in graphs
    var OMIT_METRICS = [
        'Test.Timer.Duration'
    ];

    /**
     * Creates a set of Y-axes based on the to-be-plotted series.
     * It creates a separate Y-axis per domain, assigning known series
     * to certain y-axes.
     * 
     * Note: this function modifies the input series by setting their 'yaxis' property
     * to the correct index.
     * 
     * @param series the series to be plotted.
     * @param maxValues the maximum values, per domain
     * @returns an array of y-axis descriptors
     */
    function createYAxes(series, maxValues)
    {
        // Creates an axis for bytes
        function createBytesAxis(series, maxValue)
        {
            var LABELS = ["Bytes", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];
            
            // Determine order of magnitude of data
            var maxMemory = _.max(_.pluck(series, 'max'));
            if (!_.isUndefined(maxValue)) {
                maxMemory = Math.max(maxMemory, maxValue);
            }
            var mag = Math.floor(Math.log(maxMemory) / Math.log(1024));
            mag = Math.min(mag, LABELS.length - 1);
            
            return {
                min: 0,
                axisLabel: LABELS[mag],
                multiplier: Math.pow(1024, mag),
                tooltipFormatter: function(value) {
                    return value.toFixed(2) + LABELS[mag];
                }
            };
        }

        // Creates an axis for percentages
        function createPercentAxis(series, maxValue)
        {
            return {
                min: 0,
                axisLabel: "%",
                tooltipFormatter: function(value) {
                    return value.toFixed(2) + '%';
                }
            };
        }
        
        /**
         *  Creates an axis for time durations
         *  
         *  @param series   array of points with the max time in microseconds  
         */
        //
        function createTimeDurationAxis(series, maxValue)
        {
            var LABELS = ["μs", "ms", "s"];
            
            // Determine order of magnitude of data
            var maxTime = _.max(_.pluck(series, 'max'));
            if (!_.isUndefined(maxValue)) {
                maxTime = Math.max(maxTime, maxValue);
            }
            var mag = Math.floor(Math.log(maxTime) / Math.log(1000));
            mag = Math.min(mag, LABELS.length - 1);
            
            return {
                min: 0,
                axisLabel: LABELS[mag],
                multiplier: Math.pow(1000, mag),
                tooltipFormatter: function(value) {
                    return value.toFixed(2) + LABELS[mag];
                }
            };
        }
        
        // Creates a default, unitless axis
        function createDefaultAxis(series, maxValue)
        {
            // Determine order of magnitude of data
            var max = _.max(_.pluck(series, 'max'));
            if (!_.isUndefined(maxValue)) {
                max = Math.max(max, maxValue);
            }
            var mag = Math.floor(Math.log(Math.abs(max)) / Math.log(1000));
            var multiplier = Math.pow(1000, mag);
            
            return {
                // Add thousands-separator 
                axisLabel: (multiplier > 1) ? "x"+multiplier.toLocaleString() : "",
                multiplier: multiplier,
                tooltipFormatter: function(value) {
                    return value * multiplier;
                }
            };
        }
        
        // Definition of domains
        var domains = {
            memory: {
                matcher: /\.Counter\.System\.Memory\./,
                series: [],
                create: createBytesAxis
            },
            cpu: {
                matcher: /\.Counter\.System\.CPU\.Usage/,
                series: [],
                create: createPercentAxis
            },
            timer: {
                matcher: /\.Timer\./,
                series: [],
                create: createTimeDurationAxis
            },
            other: {
                series: [],
                create: createDefaultAxis
            }
        };
        
        // Split the series into domains
        _.each(series, function(s)
        {
            var domain = _.find(domains, function(d)
            {
                return d.matcher && s.metricName.match(d.matcher);
            }) || domains.other;
            
            domain.series.push(s);
        });

        // Create a y-axis per domain
        var yaxes = [];
        _.each(domains, function(domain, domainId)
        {
            if (_.size(domain.series) > 0 && typeof domain.create === 'function')
            {
                var yaxis = domain.create(domain.series, maxValues[domainId]);
                yaxis.position = 'left';
                yaxis.domain = domainId;
                yaxis.dataMax = _.max(_.pluck(domain.series, 'max'));
                
                _.each(domain.series, function(s) {
                    s.yaxis = 1 + yaxes.length;
                });
                
                yaxes.push(yaxis);
            }
        });
        
        return yaxes;
    }
    
    /**
     * Determines the minimum and maximum of the data in an array of series.
     * Each series is seperately checked and has its "min" and "max" properties
     * set to the minimum and maximum of the data (including min/max deltas,
     * where relevant).
     * 
     * @param series the series to check and update
     */
    function determineSeriesRange(series)
    {
        _.each(series, function(s) {
            s.min = Number.MAX_VALUE;
            s.max = Number.MIN_VALUE;
            
            if (!_.isUndefined(s.data)) {
                _.each(s.data, function(data) {
                    s.min = Math.min(s.min, data[1]);
                    s.max = Math.max(s.max, data[1]);
                });
            }
        });
    }
    
    /**
     * Alters the data in the series to take the axis' multiplier into account.
     * For each series, this function divides its data by the series' axis' 
     * multiplier.
     * 
     * @param series array of series to update.
     * @param axes array of Y-axis used by the series.
     */
    function scaleSeriesToAxes(series, axes)
    {
        _.each(series, function (s) {
            var multiplier = axes[s.yaxis - 1].multiplier || 1;
            var data = _.map(s.data, function (data) {
                var d = data.slice();
                for (var i = 1; i < d.length; ++i) {
                    if ($.isNumeric(d[i])) {
                        d[i] /= multiplier;
                    }
                }
                return d;
            });
            s.data = data;
        });
    }
    
    
    /**
     * Returns a pretty-printable metric name.
     * @param metricName the metric name to beautify
     */
    function beautifyMetricName(metricName)
    {
        var parts = metricName.split(".");
        var processName = parts.shift();
        var metricType = parts.shift();
        return parts.join(".") + " (" + processName + ")";
    }
    
    
    function createColorAllocator(metrics)
    {
        var hasFixedColorMetrics = _.find(metrics, function(metric, metricName) {
            return _.indexOf(FIXED_COLOR_METRICS, metricName) !== -1;
        });

        var colorAllocator = ColorAllocator.create();
        if (hasFixedColorMetrics)
        {
            // Reserve colors for common metrics
            _.each(FIXED_COLOR_METRICS, function(metricName) {
                colorAllocator.getMetricColor(metricName);
            });
        }
        return colorAllocator;
    }
    

        
    /**
     * Creates a single graph with the data for a single test run,
     * for multiple test runs.
     * The graph will contain a UI element that allows for switching between
     * runs.
     * 
     * @param dataConnector the connector to use to fetch the data.
     * @param run the {@link TestRun} object to create the graph for.
     * @param callback the callback that is called with the graph, when the graph is loaded
     * 
     * @return jquery selector for a new graph container that will end up
     *  with the created graph once the data is loaded.
     */
    function fetchRunGraphData(dataConnector, run, callback)
    {
        // Get the data for this graph
        async.parallel({
            metrics: function(callback) {
                dataConnector.getMetricsData([run], callback);
            },
            checkpoints: function(callback) {
                dataConnector.getCheckpointData(run, callback);
            }
        }, function(err, result) {
            if (err) {
                return callback(err);
            }

            callback(null, {
                run: run,
                metrics: result.metrics[run.runId],
                checkpoints: result.checkpoints
            });
        });
    };


    /**
     * Creates a single graph with the data for a single test run.
     * The graph will contain a UI element that allows for switching between
     * runs.
     * 
     * @param container the container to create the graph in.
     * @param data the dataset to render. Use {@link #fetchRunsGraphData} to obtain the data.
     * @param metricsMgr the MetricsManager to manage the graphs's metrics with.
     * @param options options for graph creation.
     * @return relevant graph information about the data.
     * 
     * The options can contain:
     * - minDuration: the minimum duration that should be shown on the X axis.
     * - maxValues: a mapping containing the maximum value per domain.
     * 
     * The returned information contains:
     * - duration: the duration of the data set
     */
    function createRunGraph(container, data, metricsMgr, options)
    {
        // Configure the X-Axis
        var duration = Math.round((data.run.endTime - data.run.beginTime) / 1000);
        var xaxis = {
            position: "bottom",
            mode: "time",
            timeformat: "%M:%S",
            min: 0,
            max: Math.max(options.minDuration || 0, duration)
        };
        
        // Remove metrics that are always added and make no sense in
        // a single-run view.
        var metrics = _.omit(data.metrics, OMIT_METRICS);
        
        // Register all the metrics with the MetricsManager
        _.each(metrics, function(metric, metricName) {
            metricsMgr.addMetric(metricName);
        });

        // Create markings from checkpoints
        var markings = [];
        _.each(data.checkpoints, function (checkpoint)
        {
            var name = checkpoint[1];
            var timestamp = Math.round(checkpoint[0] / 1000);
            var title = name + " @ " + (timestamp / 1000) + "s";

            markings.push({
                // required by flot
                color: "#f44",
                lineWidth: MARKING_LINE_WIDTH,
                xaxis: {from: timestamp, to: timestamp},
                // custom
                div: $('<div class="marker" title="' + title + '">' + name + '</div>').css("top", "10px"),
                index: markings.length
            });
        });

        // Create an update function to re-position the markings
        var updateMarkings = function (plot)
        {
            _.each(markings, function (marking) {
                var o = plot.pointOffset({x: marking.xaxis.from, y: 0});
                marking.div.css("left", o.left + 4).css("top", 8 + marking.index * 12);
            });
        };

        var colorAllocator = createColorAllocator(metrics);
        
        var series = [];
        _.each(metrics, function(metric, metricName) {
            var color = colorAllocator.getMetricColor(metricName);

            series.push({
                data: _.sortBy(metric.data, 0),
                yaxis: metric.yaxis,
                color: color,
                shadowSize: 0,
                metricName: metricName,
                lines: { lineWidth: DATA_LINE_WIDTH },
                dashes: { alwaysHide: true },
                points: { show: true }
            });

            if ($.isNumeric(metric.expected)) {
                series.push({
                    data: [[xaxis.min, metric.expected], [xaxis.max, metric.expected]],
                    yaxis: metric.yaxis,
                    color: color,
                    shadowSize: 0,
                    isThreshold: true,
                    isConstant: true,
                    metricName: metricName,
                    lines: { show: false, alwaysHide: true },
                    dashes: { show: true, lineWidth: THRESHOLD_LINE_WIDTH },
                    points: { show: false, alwaysHide: true }
                });
            }
            
            if (_.isObject(metric.aggregations) && _.size(metric.aggregations) > 0) {
                _.each(metric.aggregations, function(aggregation, aggregationName) {
                    series.push({
                        data: [[xaxis.min, aggregation.value], [xaxis.max, aggregation.value]],
                        yaxis: metric.yaxis,
                        color: color,
                        shadowSize: 0,
                        metricName: metricName,
                        aggregationName: aggregationName,
                        isConstant: true,
                        lines: { lineWidth: AGGREGATION_LINE_WIDTH },
                        dashes: { alwaysHide: true },
                        points: { show: false, alwaysHide: true }
                    });
                    
                    if ($.isNumeric(aggregation.expected)) {
                        series.push({
                            data: [[xaxis.min, aggregation.expected], [xaxis.max, aggregation.expected]],
                            yaxis: metric.yaxis,
                            color: color,
                            shadowSize: 0,
                            isThreshold: true,
                            metricName: metricName,
                            aggregationName: aggregationName,
                            isConstant: true,
                            lines: { show: false, alwaysHide: true },
                            dashes: { show: true, lineWidth: THRESHOLD_LINE_WIDTH },
                            points: { show: false, alwaysHide: true }
                        });
                    }
                });
            }
        });

        determineSeriesRange(series);

        // Configure the chart options
        var plotOptions = {
            xaxis: xaxis,
            yaxes: createYAxes(series, options.maxValues),
            axisLabels: {
                show: true
            },
            series: {
                points: {show: true},
                lines: {show: true}
            },
            grid: {
                markings: markings,
                hoverable: true
            },
            legend: {
                show: false
            },
            hooks: {
                draw: [updateMarkings]
            },
            hoverable: true,
            tooltip: true,
            tooltipOpts: {
                content: function(label, xval, yval, item)
                {
                    var format = item.series.yaxis.options.tooltipFormatter;
                    if (!$.isFunction(format)) {
                        format = function(x) { return Math.round(x); };
                    }
                    var prettyMetricName = beautifyMetricName(item.series.metricName);
                    
                    var lines = [];
                    if (item.series.aggregationName) {
                        var prettyAggName = PRETTY_AGGREGATION_NAMES[item.series.aggregationName] || item.series.aggregationName;
                        
                        if (item.series.isThreshold) {
                            lines.push("<strong>Expected " + prettyAggName.toLowerCase() + "</strong> of " + prettyMetricName);
                            lines.push("Value: " + format(yval));
                        } else {
                            lines.push("<strong>" + prettyAggName + "</strong> of " + prettyMetricName);
                            lines.push("Value: " + format(yval));
                            var expected = metrics[item.series.metricName].aggregations[item.series.aggregationName].expected;
                            if ($.isNumeric(expected)) {
                                expected /= item.series.yaxis.options.multiplier;
                                lines.push("Expectation: " + format(expected));
                            }
                        }
                    } else {
                        if (item.series.isThreshold) {
                            lines.push("Expectation for " + prettyMetricName);
                            lines.push("Value: " + format(yval));
                        } else if (item.hideValue) {
                            lines.push(prettyMetricName);
                        } else {
                            var time = $.formatDateTime('ii:ss.uu', new Date(xval));
                            lines.push(prettyMetricName +" @ " + time);
                            lines.push("Value: " + format(yval));
                            var expected = metrics[item.series.metricName].expected;
                            if ($.isNumeric(expected)) {
                                expected /= item.series.yaxis.options.multiplier;
                                lines.push("Expectation: " + format(expected));
                            }
                        }
                    }
                    return lines.join("<br />");
                }
            }
        };
        
        // Add a hidden series for each domain with maximum as only data 
        // point. This forces flot to allocate enough space on the Y-axis,
        // regardless of what's shown or hidden.
        var chartSeries = series.slice();
        _.each(options.maxValues, function(maxValue, domainId) {
            var yaxis = _.findIndex(plotOptions.yaxes, function(yaxis) {
                            return yaxis.domain === domainId;
                        });
            if (yaxis >= 0) {
                chartSeries.push({
                    lines: { alwaysHide: true, show: false },
                    dashes: { alwaysHide: true, show: false },
                    points: { alwaysHide: true, show: false },
                    data: [[0,maxValue]],
                    yaxis: yaxis + 1
                });
            }
        });
            
        var maxValues = {};
        _.each(plotOptions.yaxes, function(yaxis) {
            maxValues[yaxis.domain] = Math.max(maxValues[yaxis.domain] || 0, yaxis.dataMax);
        });
        
        // Create the chart!
        var canvas = $('<div>').addClass('graph-canvas').appendTo(container);
        scaleSeriesToAxes(chartSeries, plotOptions.yaxes);
        var plot = $.plot(canvas, chartSeries, plotOptions);

        // Add the marking divs to the DOM and update them
        _.each(markings, function (marking) {
            canvas.append(marking.div);
        });
        updateMarkings(plot);
    
        // Create and append the legend
        container.append(Legend.create(_.keys(metrics), colorAllocator, metricsMgr));
        
        // Highligh series on hover
        GraphUtils.bindPlotHoverHideSeries(plot);
        
        // Bind metrics listener
        GraphUtils.bindMetricManagerToGraph(metricsMgr, plot);

        return {
            duration: duration,
            maxValues: maxValues
        };
    };
    

    var fetchHistoricalGraphData = function(dataConnector, runs, callback)
    {
        dataConnector.getMetricsData(runs, function(err, results)
        {
            if (err) {
                return callback(err);
            }
            var data = {};
            runs = _.object(_.pluck(runs, "runId"), runs);
            _.each(results, function(metrics, runId) {
                var run = runs[runId];
                data[run.runId] = {
                    run: run,
                    metrics: metrics
                };
            });
            callback(null, data);
        });
    };
    
    
    /**
     * Creates a single graph with the data for a multiple test runs,
     * assumed to shared the same metadata.
     * 
     * @param container the container to create the graph in.
     * @param runsData the dataset to render. Use {@link #fetchHistoricalGraphData} to obtain the data.
     * @param metricsMgr the MetricsManager to manage the graphs's metrics with.
     */
    var createHistoricalGraph = function(container, runsData, metricsMgr)
    {
        //
        // Configure the X-Axis
        //

        // Determine begin and end time of data in graph
        var beginTime = _.min(_.pluck(_.pluck(runsData, 'run'), 'beginTime'));
        var endTime   = _.max(_.pluck(_.pluck(runsData, 'run'), 'endTime'));
            
        var xaxis = {
            position: "bottom",
            mode: "time",
            // Round to days
            min: Math.floor(beginTime / US_PER_DAY) * MS_PER_DAY,
            max: Math.ceil(endTime / US_PER_DAY) * MS_PER_DAY,
            minTickSize: [1, "day"],
            timeformat: "%d/%m"
        };
        
        // Transform from per-run to per-series
        var metrics = {};
        _.each(runsData, function(runData)
        {
            var run = runData.run;
            _.each(runData.metrics, function(metric, metricName)
            {
                metrics[metricName] = metrics[metricName] || { average: [], aggregations: {} };
                
                if (_.isArray(metric.data) && metric.data.length > 0) {
                    var avg = _.reduce(metric.data, function(memo, p) {
                        return memo + Number(p[1]);
                    }, 0) / metric.data.length;
                    metrics[metricName].average.push([Math.round(run.beginTime / 1000), avg, run]);
                }
                
                _.each(metric.aggregations, function(aggregation, aggregationName) {
                    metrics[metricName].aggregations[aggregationName] = metrics[metricName].aggregations[aggregationName] || {value: [], expected: []};
                    var agg = metrics[metricName].aggregations[aggregationName];
                    agg.value.push([Math.round(run.beginTime / 1000), aggregation.value, run]);
                    if ($.isNumeric(aggregation.expected))
                    {
                        agg.expected.push([Math.round(run.beginTime / 1000), aggregation.expected, run]);
                    }
                });
            });
        });
        
        // Provide default aggregation for metrics without aggregations
        _.each(metrics, function(metric) {
            if (_.size(metric.aggregations) === 0) {
                metric.aggregations[Aggregations.AVERAGE] = { value: metric.average };
            }
        });
        
        var colorAllocator = createColorAllocator(metrics);
        
        var series = [];
        _.each(metrics, function(metric, metricName)
        {
            var color = colorAllocator.getMetricColor(metricName);
            
            _.each(metric.aggregations, function(aggregation, aggregationName) {
                series.push({
                    data: _.sortBy(aggregation.value, 0),
                    color: color,
                    shadowSize: 0,
                    metricName: metricName,
                    aggregationName: aggregationName,
                    lines: { lineWidth: DATA_LINE_WIDTH },
                    dashes: { alwaysHide: true },
                    points: { show: true }
                });

                if ($.isArray(aggregation.expected) && aggregation.expected.length > 0) {
                    series.push({
                        data: _.sortBy(aggregation.expected, 0),
                        color: color,
                        shadowSize: 0,
                        isThreshold: true,
                        metricName: metricName,
                        aggregationName: aggregationName,
                        lines: { show: false, alwaysHide: true },
                        dashes: { show: true, lineWidth: THRESHOLD_LINE_WIDTH },
                        points: { show: true }
                    });
                }
            });
        });

        var TOOLTIP_DATE_FORMAT = "%d %b %Y, %H:%M:%S";

        determineSeriesRange(series);

        // Configure the chart options
        var options = {
            xaxis: xaxis,
            yaxes: createYAxes(series, {}),
            axisLabels: {
                show: true
            },
            series: {
                points: {show: true},
                lines: {show: true}
            },
            grid: {
                hoverable: true
            },
            legend: {
                show: false
            },
            tooltip: true,
            tooltipOpts: {
                xDateFormat: TOOLTIP_DATE_FORMAT,
                content: function(label, xval, yval, item)
                {
                    var format = item.series.yaxis.options.tooltipFormatter;
                    if (!$.isFunction(format)) {
                        format = function(x) { return Math.round(x); };
                    }
                    var prettyMetricName = beautifyMetricName(item.series.metricName);
                    var prettyAggName = PRETTY_AGGREGATION_NAMES[item.series.aggregationName] || item.series.aggregationName;
                    var prettyDate = $.plot.formatDate(new Date(xval), TOOLTIP_DATE_FORMAT);
                                       
                    var htmlName;
                    if (item.series.isThreshold) {
                        htmlName = "<strong>Expected " + prettyAggName.toLowerCase() + "</strong> of " + prettyMetricName;
                    } else {
                        htmlName = "<strong>" + prettyAggName + "</strong> of " + prettyMetricName;
                    }
                    
                    var lines = [];
                    if (item.hideValue) {
                        lines.push(htmlName);
                    } else {
                        var run = item.series.data[item.dataIndex][2];
                        lines.push(htmlName + " @ " + prettyDate);
                        lines.push("Value: " + format(yval));
                        lines.push("");
                        lines.push("Build: " + FormatUtils.createPrettyBuildId(run.buildId));
                        lines.push("Revision: " + FormatUtils.createPrettyRevisionId(run.revisionId));
                        lines.push("DeviceID: " + (run.deviceId ? run.deviceId : "(unknown)"));
                    }                    
                    
                    return lines.join("<br/>");
                }
            }
        };

        // Create the chart!
        var canvas = $('<div>').addClass('graph-canvas').appendTo(container);
        scaleSeriesToAxes(series, options.yaxes);
        var plot = $.plot(canvas, series, options);
        container.append(Legend.create(_.keys(metrics), colorAllocator, metricsMgr));
        
        // Highligh series on hover
        GraphUtils.bindPlotHoverHideSeries(plot);
        
        // Bind metrics listener
        GraphUtils.bindMetricManagerToGraph(metricsMgr, plot);
    };
    
    return {
        fetchRunGraphData: fetchRunGraphData,
        createRunGraph: createRunGraph,
        fetchHistoricalGraphData: fetchHistoricalGraphData,
        createHistoricalGraph: createHistoricalGraph
    };
});
