'use strict'

const Homey = require('homey')
const bonjour = require('bonjour')()
const net = require('net')

class KodiDriver extends Homey.Driver {

  onInit() {
    // Register flow triggers
    this._flowTriggerKodiMovieStart = new Homey.FlowCardTriggerDevice('kodi_movie_start')
      .register()

    this._flowTriggerKodiMovieStop = new Homey.FlowCardTriggerDevice('kodi_movie_stop')
      .register()

    this._flowTriggerKodiSongStart = new Homey.FlowCardTriggerDevice('kodi_song_start')
      .register()

    this._flowTriggerKodiEpisodeStart = new Homey.FlowCardTriggerDevice('kodi_episode_start')
      .register()

    this._flowTriggerKodiEpisodeStop = new Homey.FlowCardTriggerDevice('kodi_episode_stop')
      .register()

    this._flowTriggerKodiPlayingSomething = new Homey.FlowCardTriggerDevice('kodi_playing_something')
      .register()

    this._flowTriggerKodiReconnects = new Homey.FlowCardTriggerDevice('kodi_reconnects')
      .register()

    this._flowTriggerKodiPause = new Homey.FlowCardTriggerDevice('kodi_pause')
      .register()

    this._flowTriggerKodiResume = new Homey.FlowCardTriggerDevice('kodi_resume')
      .register()

    this._flowTriggerKodiStop = new Homey.FlowCardTriggerDevice('kodi_stop')
      .register()

    this._flowTriggerKodiHibernate = new Homey.FlowCardTriggerDevice('kodi_hibernate')
      .register()

    this._flowTriggerKodiReboot = new Homey.FlowCardTriggerDevice('kodi_reboot')
      .register()

    this._flowTriggerKodiShutdown = new Homey.FlowCardTriggerDevice('kodi_shutdown')
      .register()

    this._flowTriggerKodiWake = new Homey.FlowCardTriggerDevice('kodi_wake')
      .register()

    // Register flow conditions
    new Homey.FlowCardCondition('is_playing')
      .register()
      .registerRunListener( (args, state) => {
        let device = args.kodi
        return Promise.resolve(device.isPlaying(args.playing_item))
      })

    // Register flow actions
    new Homey.FlowCardAction('play_movie_kodi')
      .register()
      .registerRunListener( (args, state) => {
        let device = args.kodi
        return device.playMovie(args.movie_title)
      })

    new Homey.FlowCardAction('play_latest_episode_kodi')
      .register()
      .registerRunListener( (args, state) => {
        let device = args.kodi
        return device.playLatestUnwatchedEpisode(args.series_title)
      })    

    new Homey.FlowCardAction('start_addon_kodi')
      .register()
      .registerRunListener( (args, state) => {
        let device = args.kodi
        return device.startAddon(args.addon_name)
      })    
      
    new Homey.FlowCardAction('play_music_by_artist')
      .register()
      .registerRunListener( (args, state) => {
        let device = args.kodi
        return device.playMusic('ARTIST', args.artist)
      })

    new Homey.FlowCardAction('next_track')
      .register()
      .registerRunListener( (args, state) => {
        let device = args.kodi
        return device.nextOrPrevious('next')
      })

    new Homey.FlowCardAction('previous_track')
      .register()
      .registerRunListener( (args, state) => {
        let device = args.kodi
        return device.nextOrPrevious('previous')
      })

    new Homey.FlowCardAction('set_volume')
      .register()
      .registerRunListener( (args, state) => {
        let device = args.kodi
        return device.setVolume(args.volume)
      })

    new Homey.FlowCardAction('pause_resume_kodi')
      .register()
      .registerRunListener( (args, state) => {
        let device = args.kodi
        return device.pauseResume()
      })

    new Homey.FlowCardAction('stop_kodi')
      .register()
      .registerRunListener( (args, state) => {
        let device = args.kodi
        return device.stop()
      })
    
    new Homey.FlowCardAction('hibernate_kodi')
      .register()
      .registerRunListener( (args, state) => {
        let device = args.kodi
        return device.hibernate()
      })

    new Homey.FlowCardAction('reboot_kodi')
      .register()
      .registerRunListener( (args, state) => {
        let device = args.kodi
        return device.reboot()
      })

    new Homey.FlowCardAction('shutdown_kodi')
      .register()
      .registerRunListener( (args, state) => {
        let device = args.kodi
        return device.shutdown()
      })

    new Homey.FlowCardAction('mute_kodi')
      .register()
      .registerRunListener( (args, state) => {
        let device = args.kodi
        return device.setMute(true)
      })

    new Homey.FlowCardAction('unmute_kodi')
      .register()
      .registerRunListener( (args, state) => {
        let device = args.kodi
        return device.setMute(false)
      })

    new Homey.FlowCardAction('party_mode_kodi')
      .register()
      .registerRunListener( (args, state) => {
        let device = args.kodi
        return device.setPartyMode()
      })

    new Homey.FlowCardAction('subtitle_on')
      .register()
      .registerRunListener( (args, state) => {
        let device = args.kodi
        return device.setSubtitle(true)
      })

    new Homey.FlowCardAction('subtitle_off')
      .register()
      .registerRunListener( (args, state) => {
        let device = args.kodi
        return device.setSubtitle(false)
      })
  }

  // Pairing functionality
  onPairListDevices (data, callback) {
    this.log('onPairListDevices')      

    let devices = []

    // Find local kodi devices.
    bonjour.find({type: 'xbmc-jsonrpc', protocol: 'tcp'}, function(kodiDevice){
      Homey.ManagerArp.getMAC(kodiDevice.addresses[0]) // Find mac address for device ID
        .then((mac) => {
          devices.push(
            {
              name: kodiDevice.name,
              data: {
                id: mac
              },
              settings: {
                host: kodiDevice.addresses[0],
                tcpport: kodiDevice.port
              }
            }        
          )
        })
    })    
    
    // Call the frontend, use timeout to make sure devices are filled because bonjour searches asynchronously
    setTimeout( () => {
        callback(null, devices)
    }, 5000)
  }
}

module.exports = KodiDriver

