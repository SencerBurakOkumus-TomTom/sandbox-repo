// Copyright (c) 1992-2016 TomTom N.V. All rights reserved.
// This software is the proprietary copyright of TomTom N.V. and its subsidiaries and may be
// used for internal evaluation purposes or commercial use strictly subject to separate
// licensee agreement between you and TomTom. If you are the licensee, you are only permitted
// to use this Software in accordance with the terms of your license agreement. If you are
// not the licensee then you are not authorised to use this software in any manner and should
// immediately return it to TomTom N.V.
require([
    "config", "connectors/data/influxdb",
    "core/data-provider",
    "core/test-filter",
    "views/runs", "views/test-filter", "views/test-runs"],
function(Config, InfluxData, DataProvider, TestFilter, RunsView, TestFilterView, TestRunsView)
{   
    var documentTitle = window.document.title;
    
    function createDataConnector(desc)
    {
        if (desc.type === 'influx-db') {
            return InfluxData.create(desc.url || '', desc.username || '', desc.password || '');
        } else {
            return "Unsupported data connector type";
        }
    }
    
    function setWindowTitle(title)
    {
        document.title = documentTitle + ' - ' + title;
    }
    
    /*
     * This is the main entry point for the application,
     * once the host page has been loaded!
     */
    
    // Create the connector
    var DATA_CONNECTOR = createDataConnector(Config.dataConnector);
    
    // Initialize the data connector
    async.series([
        function(callback) {
            DATA_CONNECTOR.initialize(callback);
        }
    ], function(err) {
        if (err) {
            $('#page-wrapper').empty().append('<div class="error">' + err + '</div>');
            return;
        }
        
        var DATA_PROVIDER = DataProvider.create(DATA_CONNECTOR);
        
        // Create the metrics filter
        var TEST_FILTER = TestFilter.create(DATA_PROVIDER);

        var PAGES = {
            "/": {
                title: "Test Runs",
                page: RunsView.create(DATA_PROVIDER, TEST_FILTER)
            }
        };
        
        var CURRENT_PAGE_ID = "";
        
        function showPage(pageId, params)
        {
            if (!_.isUndefined(params)) {
                TEST_FILTER.setParams(params);
            }
            
            if (CURRENT_PAGE_ID !== pageId)
            {
                CURRENT_PAGE_ID = pageId;
                
                // Clear the old page
                var container = $('#page-wrapper').empty();

                // Show the page
                var page = PAGES[pageId];
                if (_.isUndefined(page))
                {
                    return;
                }

                setWindowTitle(page.title);

                // Set up the filter sidebar
                TEST_FILTER.clearFilterChangeHandlers();

                TEST_FILTER.addFilterChangeHandler(function() {
                    var params = TEST_FILTER.getParams();

                    // Remove empty values (looks nicer in URL)
                    params = _.pick(params, _.identity);

                    // Replace arrays with comma-separated values
                    params = _.mapObject(params, function(value) {
                        return _.isArray(value) ? value.join(";") : value;
                    });
                    var query = $.param(params);

                    History.pushState(null, '', pageId + '?' + query);
                });

                $('body').append( TestRunsView.create(TEST_FILTER) );
                $('body').append( TestFilterView.create(TEST_FILTER) );
                $('body').append( $('<div>').addClass('filter-toggle').click(function() {
                    $('body').attr('filter-collapsed', $('body').attr('filter-collapsed') ? null : true);
                }));

                container.append( page.page.content );
            }
            PAGES[CURRENT_PAGE_ID].page.update();
        }

        function onStateChange()
        {
            // Decode the new state (path?query) into its path component and query parameters.
            var state = History.getState();

            function decode(s) {
                return decodeURIComponent(s.replace(/\+/g, " "));
            }

            var params = {};
            var pathname = state.hash;
            var q = state.hash.indexOf('?');
            if (q >= 0)
            {
                // Split query string into key=value pairs
                var match, search = /([^&=]+)=?([^&]*)/g;
                while (match = search.exec(state.hash.substring(q + 1)))
                {
                    params[decode(match[1])] = decode(match[2]).split(";");
                }
                pathname = pathname.substring(0, q);
            }

            // Remove special History.js argument before we pass it on
            delete params._suid;

            showPage(pathname, params);
        }
    
        // Bind and execute it (to effect the initial state)
        History.Adapter.bind(window, 'statechange', onStateChange);
        onStateChange();

        // Create up the site navigation
        _.each(PAGES, function(page, url)
        {
            var link = $('<a>').attr('href', url).text(page.title);
            link.click(function(event){
               event.preventDefault();
               History.pushState(null, '', url);
            });
            var item = $('<li>').append(link);
            $('#site-navigation').append(item);
        });
    });
});
