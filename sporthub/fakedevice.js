'use strict';

/**********************************************
* Emulation of a Fakedevice to be able to test
* without the need of real hardware.
*
* @autor : Klaas Nebuhr
* @since : 2017-06-28
*
***********************************************/

const util = require('./mqtt-device-util.js')

console.log(util.byteToHexString(util.STOP_SESSION_CMD));

