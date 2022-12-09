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
     * Creates a new DataProvider.
     * 
     * A DataProvider should be used as the main entry point for fetching data
     * from the server. The DataProvider can implement intelligent caching or
     * apply certain transformations to the data fetched from the server.
     * 
     * @param dataConnector the data connector to use for fetching the data
     */
    function DataProvider(dataConnector)
    {
        function ItemCache(loadItemFunction)
        {
            var _cache = {};

            this.getItems = function(itemDescs, callback)
            {
                function allItemsLoaded()
                {
                    var itmcnt = 0;
                    var errcnt = 0;
                    for(var itemKey in itemDescs) {
                        itmcnt++;
                        if(!_.isUndefined(_cache[itemKey].error)){
                            errcnt++;
                        }
                    }
                    var errorKey = _.find(_.keys(itemDescs), function(itemKey) {
                        return !_.isUndefined(_cache[itemKey].error);
                    });

                    if (itmcnt == errcnt) {
                        callback(_cache[errorKey].error);
                    } else {
                        var result = _.mapObject(itemDescs, function(itemDesc, itemKey) {
                            return _cache[itemKey].data;
                        });
                        callback(null, result);
                    }
                }

                var toLoad = [];
                _.each(itemDescs, function(itemDesc, itemKey) {
                    if (_.isUndefined(_cache[itemKey])) {
                        _cache[itemKey] = { callbacks: [] };
                    }
                    var entry = _cache[itemKey];

                    if (_.isUndefined(entry.data) && _.isUndefined(entry.error)) {
                        toLoad.push(itemKey);
                        entry.callbacks.push(function()
                        {
                            toLoad = _.without(toLoad, itemKey);
                            if (toLoad.length === 0) {
                                // Last item was loaded
                                allItemsLoaded();
                            }
                        });
                    }
                });

                if (toLoad.length === 0) {
                    return allItemsLoaded();
                }

                var itemsDescsToLoad = _.object(toLoad, _.map(toLoad, function(itemKey) { return itemDescs[itemKey]; }));
                loadItemFunction(itemsDescsToLoad, function(err, items) {
                    if (err)
                    {
                        // Something went wrong during the load
                        _.each(itemsDescsToLoad, function(itemDesc, itemKey) {
                            var entry = _cache[itemKey];
                            entry.error = err;

                            _.each(entry.callbacks, function(callback) {
                                callback();
                            });
                            delete entry.callbacks;
                        });
                    }
                    else
                    {
                        // Load succeeded!
                        _.each(_.keys(itemsDescsToLoad), function(itemKey) {
                            var entry = _cache[itemKey];
                            entry.data = items[itemKey];
                            if (_.isUndefined(entry.data))
                            {
                                entry.error = "No data returned from server";
                            }

                            _.each(entry.callbacks, function(callback) {
                                callback();
                            });
                            delete entry.callbacks;
                        });
                    }
                });
            };
        }
        
        var _metrics = new ItemCache(function(items, callback) {
            return dataConnector.getMetricsData(items, callback);
        });
        
        this.getTestConfigurations = function() {
            return dataConnector.getTestConfigurations();
        };
        
        this.getTestRuns = function(filter, beginTime, callback) {
            return dataConnector.getTestRuns(filter, beginTime, callback);
        };
        
        this.getMetricsData = function(runs, callback)
        {
            return _metrics.getItems(_.object(_.pluck(runs, "runId"), runs), callback);
        };
        
        this.getCheckpointData = function(run, callback) {
            return dataConnector.getCheckpointData(run, callback);
        };
    }
    
    return {
        create: function(dataConnector) {
            return new DataProvider(dataConnector);
        }
    };
});
