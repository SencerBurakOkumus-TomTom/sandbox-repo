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
     * The ColorAllocator is responsible for defining and allocating colors to metrics.
     */
    function ColorAllocator()
    {
        var _colorQueue = ['hsl(0,50%,50%)', 'hsl(120,50%,50%)', 'hsl(240,50%,50%)'];
        var _colorStep = 120;
        var _colors = {};
        
        function allocateColor()
        {
            if (_.size(_colorQueue) === 0) {
                // Allocate more colors. We do this by stepping over the hues at
                // smaller and smaller intervals. This ensures the greatest contrast
                // at the beginning.
                // To increase the palette of colors, we also generate the same hue
                // for a few different lightnesses and saturations.
                _.each(['33%','66%'], function(lightness) {
                    _.each(['50%','100%'], function(saturation) {
                        for (var i = _colorStep / 2; i < 120; i += _colorStep)
                        {
                            for (var j = i; j < 360; j += 120)
                            {
                                _colorQueue.push('hsl('+j+','+saturation+','+lightness+')');
                            }
                        }
                    });
                });
                _colorStep /= 2;
            }
            return _colorQueue.shift();
        };
        
        
        /**
         * Returns the color allocated to a metric. If this is the first time
         * this method is called for a metric, a new color is allocated for it.
         * 
         * @param metric the unique name of the metric to get the color for.
         * @returns the metric's color, as a CSS string.
         */
        this.getMetricColor = function(metric)
        {
            if (_.isUndefined(_colors[metric])) {
                _colors[metric] = allocateColor(metric);
            }
            return _colors[metric];
        };        
    }
    
    return {
        create: function() {
            return new ColorAllocator();
        }
    };
});
