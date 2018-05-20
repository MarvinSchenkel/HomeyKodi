'use strict'

// External libs
const Homey = require('homey')
const KodiGenericDriver = require('../kodiDriver')

class KodiDriver extends KodiGenericDriver {
    onPair (socket) {
        this.log('onPair()')
        // ARP Manager is not available on the front-end
        // Return mac address as id and use Homey.addDevice() on the
        // front end to add the device
        socket.on('get_driver_id', function( data, callback ) {    
            let ipAddress = data.ipAddress

            Homey.ManagerArp.getMAC(ipAddress)
                .then((mac) => {
                    callback(null, {mac: mac})
                })
                .catch( (err) => {
                    callback(Homey.__('pair.feedback.could_not_connect') + ' ' + err)
                })
        })
    }
}

module.exports = KodiDriver

