// Copyright (c) 1992-2016 TomTom N.V. All rights reserved.
// This software is the proprietary copyright of TomTom N.V. and its subsidiaries and may be
// used for internal evaluation purposes or commercial use strictly subject to separate
// licensee agreement between you and TomTom. If you are the licensee, you are only permitted
// to use this Software in accordance with the terms of your license agreement. If you are
// not the licensee then you are not authorised to use this software in any manner and should
// immediately return it to TomTom N.V.
define(function()
{
    /**
     * Creates the legend for a graph.
     * 
     * @param metrics the list of metrics.
     * @param colorAllocator the color allocator to use for getting colors.
     * @param metricsMgr the metrics manager to handle visibility.
     * @returns the new legend container
     */
    function createLegend(metrics, colorAllocator, metricsMgr)
    {
        // Re-organize into groups
        var groups = {};
        _.each(metrics, function(metric) {
            var parts = metric.split(".");
            var process = "@" + parts.shift();
            var type = parts.shift();
            var name = parts.pop();
            parts.push(process);
            
            var group = groups;
            while (parts.length > 0) {
                var part = parts.shift();
                group[part] = group[part] || {};
                group = group[part];
            }
            
            group[name] = {type: type, name: metric};
        });
        
        // Flatten groups with only one member
        function flattenGroups(groups)
        {
            var result = {};
            _.each(groups, function(group, groupName) {
                if (groupName[0] !== '@')
                {
                    group = flattenGroups(group);
                    var keys = _.keys(group);
                    if (_.size(keys) === 1) {
                        group = group[keys[0]];
                        if (keys[0][0] === "@") {
                            groupName = groupName + " (" + keys[0].substring(1) + ")";
                        } else {
                            groupName = groupName + "." + keys[0];
                        }
                    }
                }
                else
                {
                    var keys = _.keys(group);
                    if (_.size(keys) === 1) {
                        groupName = keys[0] + " (" + groupName.substring(1) + ")";
                        group = group[keys[0]];
                    }
                }
                result[groupName] = group;
            });
            return result;
        }
        groups = flattenGroups(groups);
        
        function setMetricGroupsVisible(groups, visible)
        {
            _.each(groups, function(group, name) {
                if (_.isUndefined(group.type)) {
                    setMetricGroupsVisible(group, visible);
                } else {
                    metricsMgr.setMetricVisible(group.name, visible);
                }
            });
        }
        
        function determineMetricGroupsVisibility(groups)
        {
            var visibilities = {};
            _.each(groups, function(group, name) {
                var visibility;
                if (_.isUndefined(group.type)) {
                    visibility = determineMetricGroupsVisibility(group);
                } else {
                    visibility = metricsMgr.isMetricVisible(group.name) ? 'visible' : 'hidden';
                }
                visibilities[visibility] = true;
            });
            if (_.size(visibilities) > 1) {
                return 'partial';
            }
            return _.keys(visibilities)[0];
        }
        
        function createMetricGroups(groups, metricsChangedCallback)
        {
            var container = $('<div>');
            var metrics = {};
            _.each(groups, function(group, name) {
                if (_.isUndefined(group.type)) {
                    var input = $('<input>').attr('type','checkbox').prop("checked", true).uniqueId();
                    input.change(function() {
                        setMetricGroupsVisible(group, input.prop('checked'));
                    });
                    var label = $('<label>').attr('for',input.attr('id')).text(name);
                    var m = $('<div>').addClass('metric-group').append(input).append(label);
                    m.append(createMetricGroups(group, function() {
                        var visibility = determineMetricGroupsVisibility(group);
                        if (visibility === 'visible') {
                            input.prop('checked', true);
                            input.prop('indeterminate', false);
                        } else if (visibility === 'partial') {
                            input.prop('checked', false);
                            input.prop('indeterminate', true);
                        } else {
                            input.prop('checked', false);
                            input.prop('indeterminate', false);
                        }
                        
                        if ($.isFunction(metricsChangedCallback)) {
                            metricsChangedCallback();
                        }
                    }));
                    container.append(m);
                } else {
                    metrics[name] = group.name;
                }
            });
            
            // Determine the longest display name
            var maxDisplayNameLength = _.max(_.pluck(_.keys(metrics), 'length'));
            
            _.each(metrics, function(metricName, displayName) {
                var input = $('<div>').addClass('swatch').css('background', colorAllocator.getMetricColor(metricName));
                input.click(function(event) {
                    event.preventDefault();
                    metricsMgr.setMetricVisible(metricName, input.attr('disabled'));
                });
                function onMetricChangeHandler() {
                    var visible = metricsMgr.isMetricVisible(metricName);
                    input.attr('disabled', visible ? null : 'disabled');
                    if ($.isFunction(metricsChangedCallback)) {
                        metricsChangedCallback();
                    }
                }
                metricsMgr.addMetricChangeHandler(metricName, onMetricChangeHandler);
                onMetricChangeHandler();

                var m = $('<div>').addClass('metric').append(input).append(displayName);
                m.css('width', (maxDisplayNameLength * 0.8) + "em");
                container.append(m);
            });
            
            return container;
        }
        
        var legend = $('<div>').addClass('graph-legend');
        legend.append(createMetricGroups(groups));
        return legend;
    }
        
    return {
        create: createLegend
    };
});
