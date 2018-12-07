'use strict'

// External libs
const Homey = require('homey')
const KodiWs = require('node-kodi-ws')
const Player = require('../../lib/player.js')
const Library = require('../../lib/library.js')
const System = require('../../lib/system.js')

// Global config
const RECONNECT_INTERVAL = 10000

class KodiDevice extends Homey.Device {
    onInit() {
        this.log('init(', this.getData().id, ')')
        let host = this.getSetting('host')
        let tcpPort = this.getSetting('tcpport')

        this._connectKodi(host, tcpPort)

        // Register capabilities
        this.registerCapabilityListener('volume_set', this._onCapabilityVolumeSet.bind(this))
        this.registerCapabilityListener('volume_mute', this._onCapabilityVolumeMute.bind(this))
        this.registerCapabilityListener('speaker_prev', this._onCapabilitySpeakerPrev.bind(this))
        this.registerCapabilityListener('speaker_next', this._onCapabilitySpeakerNext.bind(this))
        this.registerCapabilityListener('speaker_playing', this._onCapabilitySpeakerPlaying.bind(this))
        this.registerCapabilityListener('speaker_track', this._onCapabilitySpeakerTrack.bind(this))


    }

    onAdded() {
        this.log('added()')
    }

    onDeleted() {
        this.log('deleted()')
        this._cleanup()
    }

    _cleanup() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
        }
        if (this._kodi) {
            // Remove listeners
            this._kodi.removeAllListeners()
            this._kodi.socket && this._kodi.socket.removeAllListeners()
        }
        ['_player', '_library', '_system'].forEach(k => this[k] && this[k]._cleanup())
    }

    async onSettings(oldSettings, newSettings, changedKeys, callback) {
        if (changedKeys.includes('host') || changedKeys.includes('tcpport')) {
            try {
                // Try to connect using new settings.
                let kodi = await KodiWs(newSettings.host, newSettings.tcpport)
                this.log('Connected to ', newSettings.host)

                // We got here so we were able to set up a new connection.
                // Clean up the old connection.
                this._cleanup()

                // Register the new connection.
                this._kodi = kodi
                this._registerNewConnection(newSettings.host, newSettings.tcpport)
            } catch (err) {
                return callback(err)
            }
        }
        return callback();
    }

    _handleDisconnect({ ipAddress, port, err } = {}) {
        this.log('got disconnected')
        if (this._kodi) {
            this.log('...cleaning up')
            this._cleanup()
        }
        if (err) {
            this.error(err)
        }
        this.setUnavailable(err || '')
        this.reconnectTimer && clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            this._connectKodi(ipAddress, port)
        }, RECONNECT_INTERVAL)
    }

    async _connectKodi(ipAddress, port) {
        this.log('_connectKodi (', ipAddress, ',', port, ')')
        this._kodi = null;
        try {
            this._kodi = await KodiWs(ipAddress, port)
            this.log('Connected to ', ipAddress)
        } catch (err) {
            this.log('got connect error', err)
            return this._handleDisconnect({ ipAddress, port, err })
        }

        // Delete the timer after succesful connection.
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
            // Trigger flow
            this.getDriver()._flowTriggerKodiReconnects.trigger(this, null, null)
        }

        // Register new connection.
        this._registerNewConnection(ipAddress, port)
    }

    _registerNewConnection(ipAddress, port) {
        // Register event listeners.
        this._kodi.on('close', () => {
            this.log('got conn close')
            this._handleDisconnect({ ipAddress, port })
        });
        this._kodi.on('error', err => {
            this.log('got conn error', err)
            this._handleDisconnect({ ipAddress, port, err })
        });

        // Register objects and events to interact with kodi
        this._player = new Player(this._kodi)
        this._player.on('pause', () => { this._onPause() })
        this._player.on('stop', () => { this._onStop() })
        this._player.on('episode_stop', (episode) => { this._onEpisodeStop(episode) })
        this._player.on('movie_stop', (movie) => { this._onMovieStop(movie) })
        this._player.on('play', () => { this._onPlay() })
        this._player.on('resume', () => { this._onResume() })
        this._player.on('movie_start', (movie) => { this._onMovieStart(movie) })
        this._player.on('episode_start', (episode) => { this._onEpisodeStart(episode) })
        this._player.on('song_start', (song) => { this._onSongStart(song) })

        this._library = new Library(this._kodi)
        this._library.on('audio_scan_finished', () => { this._onAudioScanFinished() })
        this._library.on('video_scan_finished', () => { this._onVideoScanFinished() })

        this._system = new System(this._kodi)
        this._system.on('shutdown', () => { this._onShutdown() })
        this._system.on('hibernate', () => { this._onHibernate() })
        this._system.on('reboot', () => { this._onReboot() })
        this._system.on('wake', () => { this._onWake() })
        this._system.on('screensaver_on', () => { this._onScreensaverOn() })
        this._system.on('screensaver_off', () => { this._onScreensaverOff() })

        this.setAvailable() // Make available to Homey
    }

    /************************************
        MOVIE
    ************************************/
    playMovie(movieTitle) {
        this.log('playMovie(', movieTitle, ')')
        return this._library.searchMovie(movieTitle)
            .then((movie) => {
                return this._player.playMovie(movie)
            })
    }

    /************************************
        EPISODES
    ************************************/
    playLatestUnwatchedEpisode(showTitle) {
        this.log('playLatestUnwatchedEpisode(', showTitle, ')')
        return this._library.getLatestUnwatchedEpisode(showTitle)
            .then((episode) => {
                return this._player.playEpisode(episode)
            })
    }
    /************************************
        MUSIC
    ************************************/
    playMusic(searchType, searchQuery, shuffle = true) {
        this.log('playMusic(', searchType, ',', searchQuery, ')')
        return this._library.searchMusic(searchType, searchQuery)
            .then((songs) => {
                return this._player.playMusic(songs, shuffle)
            })
    }

    setPartyMode() {
        this.log('setPartyMode()')
        return this._player.setPartyMode()
    }

    /************************************
        ADDONS
    ************************************/
    startAddon(addonName) {
        this.log('startAddon (', addonName, ')')
        return this._library.searchAddon(addonName)
            .then((addon) => {
                return this._player.startAddon(addon)
            })
    }

    /***********************************
        PLAYBACK
    ************************************/
    nextOrPrevious(nextOrPrevious) {
        this.log('previousOrNext(', nextOrPrevious, ')')
        return this._player.nextOrPrevious(nextOrPrevious)
    }

    setMute(onOff) {
        this.log('setMute(', onOff, ')')
        return this._player.setMute(onOff)
    }

    setSubtitle(onOff) {
        this.log('setSubtitle(', onOff, ')')
        return this._player.setSubtitle(onOff)
    }

    setVolume(volume) {
        this.log('setVolume(', volume, ')')
        return this._player.setVolume(volume)
    }

    pauseResume() {
        this.log('playPause()')
        return this._player.pauseResume()
    }

    stop() {
        this.log('stop()')
        return this._player.stop()
    }

    isPlaying(playingFilter) {
        this.log('isPlaying(', playingFilter, ')')
        this.log('playerstate', this._player.getState())
        switch (playingFilter) {
            case 'movie':
                return this._player.getState() === 'playing_movie'

            case 'episode':
                return this._player.getState() === 'playing_episode'

            case 'music':
                return this._player.getState() === 'playing_music'

            case 'anything':
                return (this._player.getState() !== 'paused' && this._player.getState() !== 'stopped')
        }
    }

    /***********************************
        LIBRARY
    ************************************/
    scanAudioLibrary() {
        this.log('scanAudioLibrary()')
        return this._library.scanAudioLibrary()
    }

    scanVideoLibrary() {
        this.log('scanVideoLibrary()')
        return this._library.scanVideoLibrary()
    }

    /************************************
        SYSTEM
    ************************************/
    reboot() {
        this.log('reboot()')
        return this._system.reboot()
    }

    hibernate() {
        this.log('hibernate()')
        return this._system.hibernate()
    }

    shutdown() {
        this.log('shutdown()')
        return this._system.shutdown()
    }

    sendNotification(message) {
        this.log('sendNotification()')
        return this._system.sendNotification(message)
    }

    /************************************
        EVENTS
    ************************************/
    _onPause() {
        this.log('_onPause()')
        let driver = this.getDriver()
        driver._flowTriggerKodiPause
            .trigger(this, null, null)

        this.setCapabilityValue('speaker_playing', false)
    }

    _onStop() {
        this.log('_onStop()')
        let driver = this.getDriver()
        driver._flowTriggerKodiStop
            .trigger(this, null, null)

        this.setCapabilityValue('speaker_playing', false)
        this.setCapabilityValue('speaker_track', null)
        if (this.artworkImage) {
            this.artworkImage.unregister()
                .then(() => {
                    console.log('unregistered')
                })
        }
    }

    _onEpisodeStop(episode) {
        this.log('_onEpisodeStop(', episode, ')')
        let driver = this.getDriver()
        driver._flowTriggerKodiEpisodeStop
            .trigger(this, episode.getParamFlow(), null)
    }

    _onMovieStop(movie) {
        this.log('_onMovieStop(', movie, ')')
        let driver = this.getDriver()
        driver._flowTriggerKodiMovieStop
            .trigger(this, movie.getParamFlow(), null)
    }

    _onPlay() {
        this.log('_onPlay()')
        let driver = this.getDriver()
        driver._flowTriggerKodiPlayingSomething
            .trigger(this, null, null)

        this.setCapabilityValue('speaker_playing', true)
    }

    _onResume() {
        this.log('_onResume()')
        let driver = this.getDriver()
        driver._flowTriggerKodiResume
            .trigger(this, null, null)

        this.setCapabilityValue('speaker_playing', true)
    }

    _onMovieStart(movie) {
        this.log('_onMovieStart(', movie, ')')
        let driver = this.getDriver()
        driver._flowTriggerKodiMovieStart
            .trigger(this, movie.getParamFlow(), null)

        this.setCapabilityValue('speaker_track', movie.toString())
        this.setImageByUrl(movie.getArtworkUrl())
    }

    _onEpisodeStart(episode) {
        this.log('_onEpisodeStart(', episode, ')')
        let driver = this.getDriver()
        driver._flowTriggerKodiEpisodeStart
            .trigger(this, episode.getParamFlow(), null)

        this.setCapabilityValue('speaker_artist', episode.getFullEpisodeName())
        this.setCapabilityValue('speaker_track', episode.showTitle)
        this.setImageByUrl(episode.artUrl)
        console.log('after')
    }

    _onSongStart(song) {
        this.log('_onSongStart(', song, ')')
        let driver = this.getDriver()
        driver._flowTriggerKodiSongStart
            .trigger(this, song.getParamFlow(), null)
    }

    _onShutdown() {
        this.log('_onShutdown()')
        let driver = this.getDriver()
        driver._flowTriggerKodiShutdown
            .trigger(this, null, null)
    }

    _onHibernate() {
        this.log('_onHibernate()')
        let driver = this.getDriver()
        driver._flowTriggerKodiHibernate
            .trigger(this, null, null)
    }

    _onReboot() {
        this.log('_onReboot()')
        let driver = this.getDriver()
        driver._flowTriggerKodiReboot
            .trigger(this, null, null)
    }

    _onWake() {
        this.log('_onWake()')
        let driver = this.getDriver()
        driver._flowTriggerKodiWake
            .trigger(this, null, null)
    }

    _onScreensaverOn() {
        this.log('_onScreensaverOn')
        let driver = this.getDriver()
        driver._flowTriggerKodiScreensaverOn
            .trigger(this, null, null)
    }

    _onScreensaverOff() {
        this.log('_onScreensaverOff')
        let driver = this.getDriver()
        driver._flowTriggerKodiScreensaverOff
            .trigger(this, null, null)
    }

    _onAudioScanFinished() {
        this.log('_onAudioScanFinished')
        let driver = this.getDriver()
        driver._flowTriggerKodiAudioScanFinished
            .trigger(this, null, null)
    }

    _onVideoScanFinished() {
        this.log('_onVideoScanFinished')
        let driver = this.getDriver()
        driver._flowTriggerKodiVideoScanFinished
            .trigger(this, null, null)
    }

    /************************************
        CAPABILITIES
    ************************************/
    _onCapabilityVolumeSet(value, opts) {
        this.log('_onCapabilityVolumeSet(', value, ',', opts, ')')
        // Homey reports between 0-1, Kodi expects between 0-100, rouded integers
        let volume = parseInt(value * 100)
        return this._player.setVolume(volume)
    }

    _onCapabilitySpeakerPlaying(value, opts) {
        this.log('_onCapabilitySpeakerPlaying(', value, ',', opts, ')')
        return this._player.pauseResume()
    }

    _onCapabilityVolumeMute(value, opts) {
        this.log('_onCapabilityVolumeMute(', value, ',', opts, ')')
        return this._player.setMute(value)
    }

    _onCapabilitySpeakerPrev(value, opts) {
        this.log('_onCapabilitySpeakerPrev(', value, ',', opts, ')')
        return this._player.nextOrPrevious('previous')
    }

    _onCapabilitySpeakerNext(value, opts) {
        this.log('_onCapabilitySpeakerNext(', value, ',', opts, ')')
        return this._player.nextOrPrevious('next')
    }

    _onCapabilitySpeakerTrack(value, opts) {
        this.log('_onCapabilitySpeakerTrack(', value, ',', opts, ')')
    }

    // Helper
    setImageByUrl(url) {
        if (url.startsWith('https')) {
            if (!this.artworkImage) {
                this.artworkImage = new Homey.Image('jpg')
                this.artworkImage.setUrl(url)
                this.artworkImage.register()
                    .then(() => {
                        this.setAlbumArtImage(this.artworkImage)
                    })
                    .catch((err) => { console.log('reg error', err) })
            } else {
                this.artworkImage.setUrl(url)
                this.artworkImage.update()
            }
        }
    }
}

module.exports = KodiDevice
