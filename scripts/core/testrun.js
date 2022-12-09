// Copyright (c) 1992-2016 TomTom N.V. All rights reserved.
// This software is the proprietary copyright of TomTom N.V. and its subsidiaries and may be
// used for internal evaluation purposes or commercial use strictly subject to separate
// licensee agreement between you and TomTom. If you are the licensee, you are only permitted
// to use this Software in accordance with the terms of your license agreement. If you are
// not the licensee then you are not authorised to use this software in any manner and should
// immediately return it to TomTom N.V.
define(function()
{
    function TestRun(buildId, beginTime, endTime, revisionId, deviceId, metadata)
    {
        this.buildId = buildId;
        this.beginTime = beginTime;
        this.endTime = endTime;
        this.revisionId = revisionId;
        this.deviceId = deviceId;
        this.metadata = metadata;
        this.runId = this.metadata.getId() + "@" + this.buildId + "-" + this.beginTime;
        
        return this;
    }
    
    return {
        /**
         * Creates a new TestRun object.
         * 
         * @param buildId unique ID of the build that this test ran for.
         * @param beginTime begin time of the test run.
         * @param endTime end time of the test run.s
         * @param revisionId unique ID of the source revision that this test ran for.
         * @param deviceId device identification where the test ran.
         * @param metadata metadata associated with the test run.
         */
        create: function(buildId, beginTime, endTime, revisionId, deviceId, metadata)
        {
            return new TestRun(buildId, beginTime, endTime, revisionId, deviceId, metadata);
        }
    };
});
