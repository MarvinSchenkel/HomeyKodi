'use strict'

const EventEmitter = require('events')
const Homey = require('homey')

class System extends EventEmitter {

    constructor (kodiConnection) {
        super()
        this._kodiConnection = kodiConnection

        // Register events
        let system = this
        this._kodiConnection.notification('System.OnQuit', () => { system._onShutdown() })
        this._kodiConnection.notification('System.OnSleep', () => { system._onHibernate() })
        this._kodiConnection.notification('System.OnRestart', () => { system._onReboot() })
        this._kodiConnection.notification('System.OnWake', () => { system._onWake() })
        this._kodiConnection.notification('GUI.OnScreensaverActivated', () => { system._onScreensaverOn() })
        this._kodiConnection.notification('GUI.OnScreensaverDeactivated', () => { system._onScreensaverOff() })
    }

    _cleanup() {
        this.removeAllListeners();
    }

    // Actions
    shutDown () {
        Homey.app.log('System.shutDown()')
        return this._kodiConnection.run('System.Shutdown')
    }

    reboot () {
        Homey.app.log('System.reboot()')
        return this._kodiConnection.run('System.Reboot')
    }

    hibernate () {
        Homey.app.log('System.hibernate()')
        return this._kodiConnection.run('System.Hibernate')
    }

    sendNotification (message) {
        Homey.app.log('System.sendNotification(' + message + ')')
        let params = {
            title: 'Homey Kodi',
            message: message
        }
        return this._kodiConnection.run('GUI.ShowNotification', params)
    }

    // Events
    _onShutdown () {
        Homey.app.log('System._onShutdown()')
        this.emit('shutdown')
    }

    _onReboot () {
        Homey.app.log('System._onReboot()')
        this.emit('reboot')
    }

    _onHibernate () {
        Homey.app.log('System._onHibernate()')
        this.emit('hibernate')
    }

    _onWake () {
        Homey.app.log('System._onWake()')
        this.emit('wake')
    }

    _onScreensaverOn () {
        Homey.app.log('System._onScreensaverOn()')
        this.emit('screensaver_on')
    }

    _onScreensaverOff () {
        Homey.app.log('System._onScreensaverOff()')
        this.emit('screensaver_off')
    }
}
module.exports = System
