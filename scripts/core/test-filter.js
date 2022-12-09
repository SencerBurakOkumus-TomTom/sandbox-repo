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
     * Class that provides support for filtering tests.
     * 
     * @param dataConnector the connector for the data.
     */
    function TestFilter(dataConnector)
    {
        function SINGLE_OPTION(title, def) { return {type: 'option', default: def, title: title, values: []}; }
        function MULTI_OPTION(title)  { return {type: 'multi-option', title: title, values: []}; }
        
        this._fields = {
            stream: SINGLE_OPTION('Stream', 'main'),
            testType: MULTI_OPTION('Test Type'),
            functionalArea: MULTI_OPTION('Functional Area'),
            deviceType: MULTI_OPTION('Device Type'),
            device: MULTI_OPTION('Device'),
            os: MULTI_OPTION('Operating System'),
            mapType: MULTI_OPTION('Map Type'),
            mapName: MULTI_OPTION('Map Name')
        };

        this._testRuns = {
        	days: 7 	
        };
        
        this._filter = {};
        this._filterChangeHandlers = [];

        // Get the possible filter values
        this._tests = dataConnector.getTestConfigurations();

        // Get the unique set of metadata filter fields
        _.each(this._fields, function(field, fieldKey) {
            field.values = _.uniq(_.flatten(_.map(this._tests, function(metadatas) {
                    return _.compact(_.pluck(metadatas, fieldKey));
                }), true)).sort();
        }, this);
        
        this._onFilterChanged = function()
        {
            // Fire the handlers
            _.each(this._filterChangeHandlers, function(handler) {
                handler();
            });
        };

        /**
         * Returns the information about the fields that this filter supports.
         */
        this.getFields = function()
        {
            return $.extend(true, {}, this._fields);
        };
        
        /**
         * Updates the filter with new values.
         * 
         * @param filter the new filter
         */
        this.setFilter = function(filter)
        {
            var newFilter = {};
            _.each(this._fields, function(field, key)
            {
                switch (field.type)
                {
                case 'option':
                    var value;
                    if ($.isArray(filter[key])) {
                        value = _.find(filter[key], function(value) {
                            return _.contains(this._fields[key].values, value);
                        }, this);
                    }
                    if (!value) {
                        value = field.default;
                        if (!_.contains(field.values, value)) {
                            value = field.values[0];
                        }
                    }
                    newFilter[key] = [ value ];
                    break;

                case 'multi-option':
                    var values = _.filter(filter[key], function(value) {
                        return _.contains(this._fields[key].values, value);
                    }, this);
                    if ($.isArray(values) && values.length > 0) {
                        newFilter[key] = values;
                    }
                    break;
                }
            }, this);

            if (!_.isEqual(newFilter, this._filter)) {
                // Update filter
                this._filter = newFilter;
                
                this._onFilterChanged();
            }
        };
        
        /**
         * Returns the entire current filter.
         */
        this.getFilter = function()
        {
            return $.extend(true, {}, this._filter);
        };
        
        /**
         * Returns the filter for a particular field.
         * @param {string} field the field to return the filter for
         * @returns {Array} the selected filter values for the field.
         */
        this.getFieldFilter = function(field)
        {
            return $.isArray(this._filter[field])
                ? this._filter[field].slice()
                : [];
        };
        
        /**
         * Checks if a value is part of the filter for a field.
         * @param {type} field the field to check.
         * @param {type} value the value to check.
         * @returns {Boolean} true if the value is part of the filter for the field.
         */
        this.isFiltered = function(field, value)
        {
            return !_.isUndefined(this._filter[field]) && _.contains(this._filter[field], value);
        };
        
        /**
         * Checks if a particular field is in the filter.
         * @param {type} field the field to check.
         * @returns {boolean} true if the field is being filtered on.
         */
        this.isFieldFiltered = function(field)
        {
            return $.isArray(this._filter[field]) && this._filter[field].length > 0;
        };
        
        /**
         * Returns all test metadatas matching the filter.
         */
        this.getFilteredTestMetadata = function()
        {
            return _.flatten(_.map(this._tests, function(metadatas) {
                return _.filter(metadatas, function(md) {
                    return _.all(this._filter, function(fieldFilter, fieldKey) {
                        return _.contains(fieldFilter, md[fieldKey]);
                    });
                }, this);
            }, this), true);
        };
        
        /**
         * Sets the filtered state of a particular value for a particular field.
         * @param {type} field the field to change the filter for.
         * @param {type} value the value to add to or remove from the filter.
         * @param {type} filtered true if the value should be added to the filter, false if removed.
         */
        this.setFiltered = function(field, value, filtered)
        {
            if (!_.isUndefined(this._fields[field]) && _.contains(this._fields[field].values, value))
            {
                var changed = false;
                if (filtered) {
                    // Filter the value
                    if (_.isUndefined(this._filter[field])) {
                        this._filter[field] = [value];
                        changed = true;
                    } else if (!_.contains(this._filter[field], value)) {
                        switch (this._fields[field].type)
                        {
                        case 'option':
                            this._filter[field] = [value];
                            break;
                        case 'multi-option':
                            this._filter[field].push(value);
                            break;
                        }
                        changed = true;
                    }
                } else if (!_.isUndefined(this._filter[field]) && _.contains(this._filter[field], value)) {
                    // Unfilter the value
                    this._filter[field] = _.without(this._filter[field], value);
                    changed = true;
                    if (this._filter[field].length === 0) {
                        delete this._filter[field];
                    }
                }

                if (changed) {
                    this._onFilterChanged();
                }
            }
        };
        
        /**
         * Adds a handler for the FilterChange event.
         * @param {function} handler the callback handler. Takes no arguments.
         */
        this.addFilterChangeHandler = function(handler)
        {
            this._filterChangeHandlers = _.union(this._filterChangeHandlers, [handler]);
        };
        
        /**
         * Removes a handler for the FilterChange event.
         * @param {function} handler the callback handler. Takes no arguments.
         */
        this.removeFilterChangeHandler = function(handler)
        {
            this._filterChangeHandlers = _.without(this._filterChangeHandlers, handler);
        };
        
        /**
         * Clears all handlers for the FilterChange event.
         */
        this.clearFilterChangeHandlers = function()
        {
            this._filterChangeHandlers = [];
        };
        
        /**
         * Returns the number of test configurations matching the filter,
         * plus the specified value filtered as well.
         * Note that this method does not actually change the filter.
         * 
         * @param field the field to add to the filter
         * @param value the value to filter on
         * @returns the number of test configurations matching the filter if the specified field was added to it.
         */
        this.getValueTestCount = function(field, value)
        {
            // Validate the input
            if (_.isUndefined(this._fields[field]) || !_.contains(this._fields[field].values, value))
            {
                return 0;
            }
            
            // Check that the would-be filter matches
            var filter = _.clone(this._filter);
            filter[field] = [value];

            var counts = _.countBy(this._tests, function(metadatas) {
                return _.some(metadatas, function(md) {
                    return _.all(filter, function(fieldFilter, fieldKey) {
                        return _.contains(fieldFilter, md[fieldKey]);
                    });
                });
            });
            return counts['true'] || 0;
        };
        
        // Set defaults
        _.each(this._fields, function(field, fieldKey) {
            if (!_.isUndefined(field.default)) {
                var value = field.default;
                if (!_.contains(field.values, value)) {
                    value = field.values[0];
                }
                this.setFiltered(fieldKey, value, true);
            }
        }, this);
        
        /**
         * Updates the testRuns filter with new values.
         * 
         * @param params the parameters from the http address specifying what to filter
         */
        this.setTestRuns = function(params)
        {
            if (params['days'] && params['days'][0] && params['days'][0] > 0
                && params['days'][0] !== this._testRuns.days) {

                // Update testRuns filter
                this._testRuns.days = params['days'][0];
                
                this._onFilterChanged();
            }
        };
        
        /**
         * Updates the testRuns filter with a new field value.
         * 
         * @param fieldKey the key of the value to update
         * @param value the new value
         */
        this.setFieldTestRuns = function(fieldKey, value)
        {
            var params = {};
            params[fieldKey] = [ value ];
            this.setTestRuns(params);
        };

        /**
         * Returns the entire current testRuns filter.
         */
        this.getFieldTestRuns = function(fieldKey)
        {
            return this._testRuns[fieldKey];
        };
        
        /**
         * Updates the filter with new values.
         * 
         * @param params the parameters from the http address specifying what to filter
         */
        this.setParams = function(params)
        {
            this.setFilter(params);
            this.setTestRuns(params);
        };

        /**
         * Returns the entire current filter.
         */
        this.getParams = function()
        {
            params = $.extend(true, {}, this._filter);
            params['days'] = [ this._testRuns.days ];
            return params;
        };

        return this;
    }
   
    return {
        /**
         * Creates a new TestFilter.
         * 
         * @param dataConnector the connector for the data.
         */
        create: function(dataConnector) {
            return new TestFilter(dataConnector);
        }
    };
});
    
