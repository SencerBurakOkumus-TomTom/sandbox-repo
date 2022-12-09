// Copyright (c) 1992-2016 TomTom N.V. All rights reserved.
// This software is the proprietary copyright of TomTom N.V. and its subsidiaries and may be
// used for internal evaluation purposes or commercial use strictly subject to separate
// licensee agreement between you and TomTom. If you are the licensee, you are only permitted
// to use this Software in accordance with the terms of your license agreement. If you are
// not the licensee then you are not authorised to use this software in any manner and should
// immediately return it to TomTom N.V.
define(function() {
    
    function createTestFilterView(filter)
    {
        var filterDiv = $('<div class="test-filter">');
        _.each(filter.getFields(), function(field, fieldKey) {
            var id = 'm.' + fieldKey;
            var fieldDiv = $('<div>').attr('class','field-filter');
            var fieldTitle = $('<div>').attr('class','field-title').text(field.title);
            fieldTitle.click(function() {
                fieldDiv.attr('collapsed', fieldDiv.attr('collapsed') ? null : true );
            });
            
            filter.addFilterChangeHandler(function() {
                fieldDiv.attr('selected', filter.isFieldFiltered(fieldKey) );
            });

            fieldDiv.append(fieldTitle);
            switch (field.type)
            {
            case 'option':
                var select = $('<select>').attr('id', id);
                _.each(field.values, function(value) {
                   select.append($('<option>').attr('value', value).text(value));
                });
                select.change(function() {
                    filter.setFiltered(fieldKey, select.val(), true);
                });
                filter.addFilterChangeHandler(function() {
                    var f = filter.getFieldFilter(fieldKey);
                    if (f.length >= 1) {
                        select.val(f[0]);
                    }
                });
                fieldDiv.append(select);
                
                var value = filter.getFieldFilter(fieldKey);
                if (value.length > 0) {
                    select.val(value[0]);
                }
                break;

            case 'multi-option':
                _.each(field.values, function(value) {
                    var option = $('<div>').attr('class','multi-option');
                    var input = $('<input>').attr({id: id, type:'checkbox'});
                    var countDiv = $('<span>').attr('class', 'filter-value').text("-");
                    option.append(input).append(value).append(countDiv);
                    input.change(function() {
                        filter.setFiltered(fieldKey, value, input.prop('checked'));
                    });
                    option.click(function(event) {
                        if (!$(event.target).is(input)) {
                            filter.setFiltered(fieldKey, value, !input.prop('checked'));
                        }
                    });
                    fieldDiv.append(option);

                    function updateCount() {
                        var count = filter.getValueTestCount(fieldKey, value);
                        option.attr('useless', count === 0 ? true : null);
                        countDiv.text(count);
                    }
                    
                    filter.addFilterChangeHandler(function() {
                        var filtered = filter.isFiltered(fieldKey, value);
                        input.prop('checked', filtered);
                        option.attr('selected', filtered);
                        updateCount();
                    });
                    
                    var values = filter.getFieldFilter(fieldKey);
                    input.prop('checked', _.contains(values, value) );
                    
                    updateCount();
                });
                break;
            }

            filterDiv.append(fieldDiv);
        });
        
        return filterDiv;
    }
    
    return {
        /**
         * Creates a new TestFilter view and return the root element.
         * 
         * @param filter the test filter to use
         */
        create: function(filter) {
            return createTestFilterView(filter);
        }
    };
});
