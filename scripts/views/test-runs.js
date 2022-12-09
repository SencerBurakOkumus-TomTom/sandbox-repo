// Copyright (c) 1992-2016 TomTom N.V. All rights reserved.
// This software is the proprietary copyright of TomTom N.V. and its subsidiaries and may be
// used for internal evaluation purposes or commercial use strictly subject to separate
// licensee agreement between you and TomTom. If you are the licensee, you are only permitted
// to use this Software in accordance with the terms of your license agreement. If you are
// not the licensee then you are not authorised to use this software in any manner and should
// immediately return it to TomTom N.V.
define(function() {
    
    // Keycode for the "enter" key
    var KEYCODE_ENTER = 13;
    
    // Field key for the number of days
    var FIELDKEY_DAYS = 'days';

	function createTestRunsView(filter)
	{
        var testRunsDiv = $('<div class="test-runs">');

        testRunsDiv.append("<h1>Test Runs</h1>");

        var inputDaysAgo = $('<input>').attr('size',5).uniqueId();
        testRunsDiv.append($('<span>').append(' up to ').append(inputDaysAgo).append(' days ago'));

        function onDaysAgoChange() {
            var days = Number(inputDaysAgo.val());
            filter.setFieldTestRuns(FIELDKEY_DAYS, days);
        }

        filter.addFilterChangeHandler(function() {
            inputDaysAgo.val(filter.getFieldTestRuns(FIELDKEY_DAYS));
        });
        
        inputDaysAgo.val(filter.getFieldTestRuns(FIELDKEY_DAYS));
        inputDaysAgo.keyup(function(e){
            if (e.keyCode === KEYCODE_ENTER) {
                e.preventDefault();
                onDaysAgoChange();
            }
        });

        return testRunsDiv;
	}
	
    return {
        /**
         * Creates a new TestRuns view and return the root element.
         * 
         * @param filter the test filter to use
         */
        create: function(filter) {
            return createTestRunsView(filter);
        }
    };
});
