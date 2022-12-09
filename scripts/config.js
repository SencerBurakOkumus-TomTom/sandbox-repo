// Copyright (c) 1992-2016 TomTom N.V. All rights reserved.
// This software is the proprietary copyright of TomTom N.V. and its subsidiaries and may be
// used for internal evaluation purposes or commercial use strictly subject to separate
// licensee agreement between you and TomTom. If you are the licensee, you are only permitted
// to use this Software in accordance with the terms of your license agreement. If you are
// not the licensee then you are not authorised to use this software in any manner and should
// immediately return it to TomTom N.V.
/**
 * Configuration file for the application
 */
define({
    // Data connector
    dataConnector: {
        // Type of the connector. Supported connectors: influx-db.
        type: 'influx-db',
        url: 'http://localhost:8086/query?db=default-db',
        username: 'reader',
        password: 'reader'
    }
});
