// Copyright (c) 1992-2016 TomTom N.V. All rights reserved.
// This software is the proprietary copyright of TomTom N.V. and its subsidiaries and may be
// used for internal evaluation purposes or commercial use strictly subject to separate
// licensee agreement between you and TomTom. If you are the licensee, you are only permitted
// to use this Software in accordance with the terms of your license agreement. If you are
// not the licensee then you are not authorised to use this software in any manner and should
// immediately return it to TomTom N.V.
define(["graphs/graph", "graphs/metrics-manager", "utils/format-utils"],
function(Graph, MetricsManager, FormatUtils)
{
    function RunsView(dataConnector, filter)
    {
        // Milliseconds/Microseconds per day       
        var MS_PER_DAY = 24*60*60*1000;
        var US_PER_DAY = 24*60*60*1000000;
 
        // Datetime format for when the run ran.
        var DATEFORMAT_INVIDIDUAL_RUN_BEGIN = 'dd M yy, hh:ii:ss';
        
        // Datetime format when the duration of the run.
        var DATEFORMAT_INVIDIDUAL_RUN_DURATION = 'ii:ss.uu';

        // Number of milliseconds to wait to assume the browser has rendered recent changes
        var TIMEOUT_RENDER_MS = 50;
        
        // The main content page
        this.content = $('<div>').attr('class','page');
        
        // The current collapse state of the various sections
        this.collapsedState = {};
        
        this._createCollapsableContainer = function(className, id, titleText, defaultCollapsed, contentProvider)
        {
            var container = $('<div>').addClass(className);
            var title = $('<div>').addClass('title').append(titleText).appendTo(container);
            
            var collapsed = this.collapsedState[id];
            if (_.isUndefined(collapsed)) {
                collapsed = defaultCollapsed;
            }
            if (collapsed) {
                container.attr('collapsed',true);
            }
            
            var loaded = false;
            title.click(function() {
                var collapsed = !container.attr('collapsed');
                container.attr('collapsed', collapsed ? true : null);
                this.collapsedState[id] = collapsed;
                if (!loaded) {
                    container.append(contentProvider());
                    loaded = true;
                }
            }.bind(this));
            
            if (!collapsed) {
                container.append(contentProvider());
                loaded = true;
            }
            
            return container;
        };
        
        function createSingleRunTab(runs, metricsManager)
        {
            var sortedRuns = _.values(runs).sort(function(a,b) {
                return b.beginTime - a.beginTime;
            });
                        
            var select = $('<select>');
            _.each(sortedRuns, function(run) {
                var prettyBuildId = FormatUtils.createPrettyBuildId(run.buildId);
                var prettyDate = $.formatDateTime(DATEFORMAT_INVIDIDUAL_RUN_BEGIN, new Date(Math.round(run.beginTime / 1000)));
                var prettyDuration = $.formatDateTime(DATEFORMAT_INVIDIDUAL_RUN_DURATION, new Date(Math.round((run.endTime - run.beginTime) / 1000)));
                var prettyRevision = FormatUtils.createPrettyRevisionId(run.revisionId);
                var optionName = prettyBuildId + " — " + prettyDate + ' (' + prettyDuration + ') — ' + prettyRevision 
                              + " — " + run.metadata.mapId;
                if (run.deviceId) {
                    optionName += " — " + run.deviceId;
                }
                select.append($('<option>').attr('value',run.runId).text(optionName));
            });
            
            select.val(sortedRuns[0].runId);
            var container = $('<div>');
            container.append($('<span>').append('Run: ').append(select));
            var canvas = $('<div>').addClass('graph-container').appendTo(container);
            
            var maxDuration = 0;
            var maxValues = {};
            var graphData = {};
            
            function onRunChange() {
                
                var runId = select.val();
                
                function createGraph() {
                    var options = {
                        minDuration: maxDuration * 1.1,   // Add some margin to test end
                        maxValues: maxValues
                    };
                    // Create the graph after a small delay to ensure the page's rendered.
                    setTimeout(function() {
                        var data = Graph.createRunGraph(canvas, graphData[runId], metricsManager, options);
                        maxDuration = _.max([maxDuration, data.duration]);
                        _.each(data.maxValues, function(maxValue, domain) {
                            maxValues[domain] = _.max([maxValues[domain] || 0, maxValue]);
                        });
                    }, TIMEOUT_RENDER_MS);
                }
                
                canvas.empty();
                if (!graphData[runId]) {
                    graphData[runId] = null;
                    canvas.attr('loading','true');
                    Graph.fetchRunGraphData(dataConnector, runs[runId], function(err, data) {
                        if (err) {
                            if (select.val() === runId) {
                                canvas.removeAttr('loading');
                                canvas.append($('<div>').addClass('error').text(err));
                            }
                        } else {
                            graphData[runId] = data;
                            if (select.val() === runId) {
                                canvas.removeAttr('loading');
                                createGraph();
                            }
                        }
                    });
                } else {
                    createGraph();
                }
            }
            select.change(onRunChange);
            onRunChange();
            
            return container;
        }
        
        function createHistoricalTab(runs, metricsManager)
        {
            var container = $('<div>');
            var canvas = $('<div>').addClass('graph-container').appendTo(container);
           
            var graphData = {};
            
            var daysAgo = filter.getFieldTestRuns('days');
            var now = Date.now();

            var relevantRuns = _.pick(runs, function(run) {
                var dayNow = now / MS_PER_DAY;
                var dayRun = run.beginTime / US_PER_DAY;
                return dayNow - dayRun <= daysAgo;
            });

            function createGraph() {
                var data = _.pick(graphData, _.keys(relevantRuns));
                // Create the graph after a small delay to ensure the page's rendered.
                setTimeout(function() {
                    Graph.createHistoricalGraph(canvas, _.values(data), metricsManager);
                }, 50);
            }
            
            var fetchRuns = _.omit(relevantRuns, _.keys(graphData));
            
            canvas.empty();
            if (_.size(fetchRuns) > 0) {
                canvas.attr('loading','true');
                Graph.fetchHistoricalGraphData(dataConnector, _.values(fetchRuns), function(err, runsData) {
                    if (err) {
                        canvas.removeAttr('loading');
                        canvas.append($('<div>').addClass('error').text(err));
                    } else {
                        $.extend(graphData, runsData);
                        canvas.removeAttr('loading');
                        createGraph();
                    }
                });
            } else {
                createGraph();
            }
            
            return container;
        }
        
        function createConfigurationSection(config, metricsManager)
        {
            var md = config.metadata;
            var prettyDevice = md.device
                ? md.device + " (" + md.deviceType + ", " + md.os + ")"
                : md.deviceType + " (" + md.os + ")";
                
            var prettyMetaData = prettyDevice + " — " + md.mapName + " (" + md.mapType + ")";
                        
            var container = $('<div>').addClass('test-configuration');
            container.append($('<h4>').text(prettyMetaData));
            
            var tabTitles = $('<ul>');
            var tabPanel = $('<div>');
            tabPanel.append(tabTitles);
            var tabLatest = $('<div>').uniqueId().appendTo(tabPanel);
            var tabHistorical = $('<div>').uniqueId().appendTo(tabPanel);
            tabTitles.append($('<li>').append($('<a>').attr('href','#'+tabLatest.attr('id')).text('Individual Runs')));
            tabTitles.append($('<li>').append($('<a>').attr('href','#'+tabHistorical.attr('id')).text('Historical')));
            container.append(tabPanel);
            
            tabLatest.append( createSingleRunTab(config.runs, metricsManager) );
                       
            tabPanel.tabs({
                activate: function(event, ui) {
                    if (ui.newPanel.attr('id') === tabHistorical.attr('id') && tabHistorical.children().length === 0) {
                        // Historical panel first time activated
                        tabHistorical.append( createHistoricalTab(config.runs, metricsManager) );
                    }
                }
            });
            return container;
        }
        
        /**
         * Creates a section for a test.
         * The section contains a graph for every run of the test in a different configuration.
         * @param configs the configurations
         * @param metricsManager the MetricsManager to manage the graphs's metrics with.
         */
        function createTestConfigs(configs, metricsManager)
        {
            var md = configs[0];
            
            // Copy the filter settings and add the test ID
            var f = filter.getFilter();
            f['testType']  = [md.testType];
            f['testSuite'] = [md.testSuite];
            f['testCase']  = [md.testCase];

            var beginTime = Date.now() - filter.getFieldTestRuns('days') * MS_PER_DAY;

            var content = $('<div>');
            content.attr('loading','true');

            dataConnector.getTestRuns(f, beginTime, function(err, configs) {
                if (err) {
                    content.append($('<div>').addClass('error').text(err));
                } else if (configs.length === 0) {
                    content.append($('<div>').addClass('nodata').text("No Data"));
                } else {              
                    _.each(configs, function(config) {
                        content.append(createConfigurationSection(config, metricsManager));
                    });
                }
                content.removeAttr('loading');
            });
            return content;
        }
        
        this._createTestCaseSections = function(testCaseMap, metricsManager)
        {
            var content = $('<div>').addClass('test-cases');
            var keys = Object.keys(testCaseMap).sort();
            _.each(keys, function(testCase) {
                this._createCollapsableContainer('test-case', 'tc:'+testCase, testCase, true, function() {
                    return createTestConfigs(testCaseMap[testCase], metricsManager);
                }.bind(this)).appendTo(content);
            }, this);
            return content;
        };
        
        this._createTestSuiteSections = function(testSuiteMap, metricsManager)
        {
            var content = $('<div>').attr('class','test-suites');
            var keys = Object.keys(testSuiteMap).sort();
            _.each(keys, function(testSuite) {
                this._createCollapsableContainer('test-suite', 'ts:'+testSuite, testSuite, true, function() {
                    return this._createTestCaseSections(testSuiteMap[testSuite], metricsManager);
                }.bind(this)).appendTo(content);
            }, this);
            return content;
        };
        
        this._createTestTypeSections = function(testTypeMap, metricsManager)
        {
            var content = $('<div>').attr('class','test-types');
            var keys = Object.keys(testTypeMap).sort();
            _.each(keys, function(testType) {
                this._createCollapsableContainer('test-type', 'tt:'+testType, testType, false, function() {
                    return this._createTestSuiteSections(testTypeMap[testType], metricsManager);
                }.bind(this)).appendTo(content);
            }, this);
            return content;
        };

        this.update = function()
        {
            // Reorganize into configurations per testsuite and testcase
            var tests = {};
            _.each(filter.getFilteredTestMetadata(), function(md) {
                if (_.isUndefined(tests[md.testType])) {
                    tests[md.testType] = {};
                }
                if (_.isUndefined(tests[md.testType][md.testSuite])) {
                    tests[md.testType][md.testSuite] = {};
                }
                if (_.isUndefined(tests[md.testType][md.testSuite][md.testCase])) {
                    tests[md.testType][md.testSuite][md.testCase] = [];
                }
                tests[md.testType][md.testSuite][md.testCase].push(md);
            });
            
            // Create a section per test suite
            var container = this.content.empty();
            var metricsManager = MetricsManager.create();
            container.append( this._createTestTypeSections(tests, metricsManager) );
        };
    }

    return {
        create: function(dataConnector, filter) {
            return new RunsView(dataConnector, filter);
        }
    };
});
