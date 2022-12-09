// Copyright (c) 1992-2016 TomTom N.V. All rights reserved.
// This software is the proprietary copyright of TomTom N.V. and its subsidiaries and may be
// used for internal evaluation purposes or commercial use strictly subject to separate
// licensee agreement between you and TomTom. If you are the licensee, you are only permitted
// to use this Software in accordance with the terms of your license agreement. If you are
// not the licensee then you are not authorised to use this software in any manner and should
// immediately return it to TomTom N.V.
define(function() {

    // Color for faded (non-highlighted) series
    var FADED_SERIES_COLOR = '#eee';
    
    /**
     * Finds the series that the position lies on (with margin).
     * 
     * @param plot the plot object.
     * @param pos  the position from the plothover event.
     * @returns the found series, if any, otherwise undefined.
     */
    function findHitSeries(plot, pos)
    {
        // Distance (in canvas unit) to a line that counts as a hit
        var LINE_HIT_DISTANCE = 4.0;
        
        function sqr(x) {
            return x * x;
        }
        
        // To find the series we need to calculate the distance between the 
        // hover position and the line segment of the series.
        var minSeries = null;
        var minDistance = Number.MAX_VALUE;
        _.each(plot.getData(), function(series) {
            if (series.lines.show || series.dashes.show) {
                // Find the data point index where the hover position's X value is.
                var index = _.sortedIndex(_.pluck(series.data, 0), pos.x);
                if (index > 0 && index < series.data.length) {
                    // Calculate distance to line segment
                    var x = series.xaxis.p2c(pos.x);
                    var y = series.yaxis.p2c(pos['y'+series.yaxis.n]);
                    var x1 = series.xaxis.p2c(series.data[index - 1][0]);
                    var x2 = series.xaxis.p2c(series.data[index][0]);
                    var y1 = series.yaxis.p2c(series.data[index - 1][1]);
                    var y2 = series.yaxis.p2c(series.data[index][1]);
                    var dx = x2 - x1;
                    var dy = y2 - y1;
                    var lengthSq = sqr(dy) + sqr(dx);
                    
                    var t = 0;
                    if (lengthSq > 0.000001) {
                        // Determine position along line of projection of pos onto line
                        t = (dx * (x - x1) + dy * (y - y1)) / lengthSq;
                        // Bound by line segment
                        t = Math.max(0,Math.min(1,t));
                    }
                    var px = x1 + t * dx;
                    var py = y1 + t * dy;
                    var distance = Math.sqrt(sqr(px - x) + sqr(py - y));
                    
                    // Find the series with the smallest distance
                    if (distance < minDistance) {
                        minSeries = series;
                        minDistance = distance;
                    }
                }
            }
        });
        
        // If the closest series we're to is close enough, return it
        if (minSeries && minDistance < LINE_HIT_DISTANCE) {
            return minSeries;
        }
    }


    /**
     * Binds a MetricsManager to a graph, causing the series' visibility
     * in the graph to be updated if a metric's state changes.
     * 
     * @param metricsMgr the metrics manager to bind to.
     * @param plot the graph to update.
     */
    function bindMetricManagerToGraph(metricsMgr, plot)
    {
        var updatedMetrics = [];
        
        function updateGraph()
        {
            var data = plot.getData();
            var axisUsage = {};
            _.each(data, function(series)
            {
                if (_.indexOf(updatedMetrics, series.metricName) !== -1)
                {
                    var visible = metricsMgr.isMetricVisible(series.metricName);
                    series.show = visible;
                    _.each(['lines','dashes','points'], function(prop) {
                        series[prop].show = visible && !series[prop].alwaysHide;
                    });
                }
                if (_.isUndefined(series.show) || series.show) {
                    var axisName = (series.yaxis.n > 1) ? "y" + series.yaxis.n + "axis" : "yaxis";
                    axisUsage[axisName] = true;
                }
            });
            updatedMetrics.length = 0;
            
            var axes = plot.getAxes();
            _.each(axes, function(axis, axisName) {
                if (axis.direction === "y") {
                    axis.options.show = Boolean(axisUsage[axisName]);
                }
            });
            plot.setData(data);
            plot.setupGrid();
            plot.draw();
        }
        
        var data = plot.getData();
        _.each(data, function(series) {
            function handler() {
                if (_.size(updatedMetrics) === 0) {
                    setTimeout(updateGraph, 10);
                }
                updatedMetrics.push(series.metricName);
            }
            metricsMgr.addMetricChangeHandler(series.metricName, handler);
            handler();
        });
    }


    /**
     * Returns a handler for the "plothover" event that hides unrelated series.
     * 
     * @param plot the graph to hide the series for.
     */
    function bindPlotHoverHideSeries(plot)
    {
        var highlightedMetric = "";
        var highlightedAggregation = "";
        var originalColors = {};
        
        function highlightMetric(metricName, aggregationName)
        {
            if (highlightedMetric !== metricName || highlightedAggregation !== aggregationName) {
                var data = plot.getData();

                if (highlightedMetric) {
                    // Un-highlight the metric
                    _.each(data, function(series) {
                        series.color = originalColors[series.metricName] || series.color;
                    });
                }

                highlightedMetric = metricName;
                highlightedAggregation = aggregationName;

                if (highlightedMetric) {
                    // Highlight the metric / aggregation
                    var foreground = [];
                    _.each(data, function(series) {
                        var match = false;
                        if (series.metricName === highlightedMetric) {
                            if (!highlightedAggregation || series.aggregationName === highlightedAggregation) {
                                match = true;
                            }
                        }

                        if (match) {
                            foreground.push(series);
                        } else {
                            originalColors[series.metricName] = series.color;
                            series.color = FADED_SERIES_COLOR;                            
                        }
                    });

                    // Bring the selected metrics to the foreground
                    _.each(foreground, function(fg) {
                        data = _.without(data, fg);
                        data.push(fg);
                    });
                }

                plot.setData(data);
                plot.draw();
            }
        }

        plot.getPlaceholder().bind("plothover", function(event, pos, item) {
            var series = null;
            if (item) {
                series = item.series;
            } else {
                series = findHitSeries(plot, pos);
                if (series) {
                    plot.showTooltip({
                        dataIndex: 0,
                        series: series,
                        hideValue: !series.isConstant
                    }, pos);
                }
            }

            var metricName = null, aggregationName = null;
            if (series) {
                metricName = series.metricName;
                aggregationName = series.aggregationName;
            }
            highlightMetric(metricName, aggregationName);
        });
    }
    
    return {
        bindMetricManagerToGraph: bindMetricManagerToGraph,
        bindPlotHoverHideSeries: bindPlotHoverHideSeries
    };
});
