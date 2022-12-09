// Copyright (c) 1992-2016 TomTom N.V. All rights reserved.
// This software is the proprietary copyright of TomTom N.V. and its subsidiaries and may be
// used for internal evaluation purposes or commercial use strictly subject to separate
// licensee agreement between you and TomTom. If you are the licensee, you are only permitted
// to use this Software in accordance with the terms of your license agreement. If you are
// not the licensee then you are not authorised to use this software in any manner and should
// immediately return it to TomTom N.V.
define(function()
{
    /*
     * The MetricsManager is responsible for managing the state of a
     * collection of metrics, including maintaining handlers for change events
     * on metrics.
     */
    function MetricsManager()
    {
        var _metrics = {};
        
        function fireMetricHandlerHandlers(handlers)
        {
            _.each(handlers, function(handler) {
                handler();
            });
        }

        /**
         * Adds a metric to the manager.
         * 
         * @param metric unique name of the metric
         */
        this.addMetric = function(metric) {
            if (_.isUndefined(_metrics[metric])) {
                _metrics[metric] = {
                    visible: true,
                    handlers: []
                };
            }
        };
        
        
        /**
         * Returns whether a specified metric is visible or not.
         * @param metric the unique name of the metric to query.
         */
        this.isMetricVisible = function(metric) {
            return _.isUndefined(_metrics[metric])
                ? true
                : _metrics[metric].visible;
        };
        
        
        /**
         * Sets a metric to visible or hidden.
         * 
         * @param metric the unique name of the metric to change.
         * @param visible true if the metric should be made visible, false otherwise.
         */
        this.setMetricVisible = function(metric, visible) {
            if (!_.isUndefined(_metrics[metric])) {
                visible = Boolean(visible);
                if (_metrics[metric].visible !== visible)
                {
                    _metrics[metric].visible = visible;
                    fireMetricHandlerHandlers(_metrics[metric].handlers);
                }
            };
        };
        
        
        /**
         * Registers a change handler to a metric. The change handler will be
         * fired when the state of the metric changes.
         * 
         * @param metric the unique name of the metric to register the handler on.
         * @param handler the handler function to add.
         */
        this.addMetricChangeHandler = function(metric, handler) {
            this.addMetric(metric);
            _metrics[metric].handlers = _.union(_metrics[metric].handlers, [handler]);
        };
        
        
        /**
         * Removes a previously added handler from a metric.
         * 
         * @param metric the unique name of the metric to remove the handler from.
         * @param handler the handler function to remove.
         */
        this.removeMetricChangeHandler = function(metric, handler) {
            if (!_.isUndefined(_metrics[metric])) {
                _metrics[metric].handlers = _.without(_metrics[metric].handlers, [handler]);
            }
        };
    }
    
    return {
        create: function() {
            return new MetricsManager();
        }
    };
});
