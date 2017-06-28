const FAKE_DEVICE       = 0x01;
const REAL_DEVICE       = 0x00;
const START_SESSION_CMD = 0x01;
const STOP_SESSION_CMD  = 0x02;

// const clientID = "60:01:94:0B:DA:C7";



function getPayloadIntValue(payload, index) {
    return payload[index] << 8 | payload[index+1]
}

function getPayloadLongValue(payload, index) {
    return payload[index++] << 24 | payload[index++] << 16 | payload[index++] << 8 | payload[index]
}

function getWaterrowerDataObj(payload) {
    let data = {};
    data.sessionid = getPayloadIntValue(payload,0); 
    data.ticks     = getPayloadIntValue(payload,2); 
    data.seconds   = getPayloadIntValue(payload,4);
    data.speed     = getPayloadIntValue(payload,6) / 100;
    data.distance  = getPayloadLongValue(payload,8) / 100;
    data.max_speed = getPayloadIntValue(payload,12) / 100;
    data.avg_speed = getPayloadIntValue(payload,14) / 100;
    return data;        
}

const hex = '0123456789ABFDEF';

function byteToHexString(b) {
    let result = '';
    result += hex[(b >> 4) & 0x0F];
    result += hex[b & 0x0F];
    return result;   
}

var exports = module.exports =  {
    FAKE_DEVICE         : FAKE_DEVICE,
    REAL_DEVICE         : REAL_DEVICE,
    START_SESSION_CMD   : START_SESSION_CMD,
    STOP_SESSION_CMD    : STOP_SESSION_CMD,

    getPayloadIntValue  : getPayloadIntValue,
    getPayloadLongValue : getPayloadLongValue,
    byteToHexString     : byteToHexString
};

