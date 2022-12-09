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
     * Returns a human-readable string representation of a build ID.
     * @param buildId the build ID
     */
    function createPrettyBuildId(buildId) {
        var col = buildId.indexOf(':');
        if (col !== -1) {
            var data = buildId.substring(col + 1);
            switch (buildId.substring(0, col)) {
            case 'qb':
                return 'QB#' + data;
            }
        }
        // Unknown format, return as-is
        return buildId;
    }
    

    /**
     * Returns a human-readable string representation of a revision ID.
     * @param revisionId the revision ID
     */
    function createPrettyRevisionId(revisionId) {
        var col = revisionId.indexOf(':');
        if (col !== -1) {
            var data = revisionId.substring(col + 1);
            switch (revisionId.substring(0, col)) {
            case 'p4':
                return 'CL#' + data;
            }
        }
        // Unknown format, return as-is
        return revisionId;
    }

   return {
        createPrettyBuildId: createPrettyBuildId,
        createPrettyRevisionId: createPrettyRevisionId
   } ;
});
