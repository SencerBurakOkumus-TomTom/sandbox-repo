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
     * Tags used in to identify an event series.
     * They should be ordered alphabetically for optimal performance in InfluxDB
     */
    var METADATA_TAGS = ['device', 'deviceType', 'functionalArea', 'mapId', 'mapType', 'os', 'stream', 'testCase', 'testSuite', 'testType'];

    function MetaData(tags)
    {
        function getMapName(mapId)
        {
            if (mapId == undefined) {
                return "Other";
            }
            if ((mapId.indexOf("Europe") !== -1)||(mapId.indexOf("EUR") !== -1)) {
                return "Europe";
            }
            if ((mapId.indexOf("USA_Canada_and_Mexico") !== -1)||(mapId.indexOf("NAM") !== -1)) {
                return "USA, Canada & Mexico";
            }
            if (mapId.indexOf("MunichExtended") !== -1) {
                return "Munich (Extended)";
            }
            if (mapId.indexOf("MunichGarching") !== -1) {
                return "Munich & Garching";
            }
            if (mapId.indexOf("Andorra") !== -1) {
                return "Andorra";
            }
            if (mapId.indexOf("Online") !== -1) {
                return "Online";
            }
            return "Other";
        }
        
        // Require, but only store, the known tags.
        for (var i = 0; i < METADATA_TAGS.length; ++i) {
            var tag = METADATA_TAGS[i];
            this[tag] = tags[tag]; 
        }
        this.mapName = getMapName(this.mapId);

        /**
         * Returns the unique ID for the test described by this object.
         * This is some sort of combination of the test type, and test name.
         */
        this.getTestId = function() {
            return [this.testType, this.testSuite, this.testCase].join("/");
        };
        
        /**
         * Returns the unique ID for the entire configuration described by this object.
         * This is some sort of combination of all properties.
         */
        this.getId = function() {
            return [
                this.testType,
                this.testSuite,
                this.testCase,
                this.stream,
                this.deviceType,
                this.device,
                this.os,
                this.mapType,
                this.mapName,
                this.functionalArea
            ].join('/');
        };

        return this;
    }
    
    return {
        /**
         * Creates a new MetaData object.
         */
        create: function(tags)
        {
            return new MetaData(tags);
        },
        
        /**
         * Tags used in to identify an event series.
         * They should be ordered alphabetically for optimal performance in InfluxDB
         */
        getTags: function()
        {
            return METADATA_TAGS;
        }
    };
});
