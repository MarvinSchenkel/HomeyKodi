'use strict'

const EventEmitter = require('events')
const Movie = require('../../lib/movie.js')
const Episode = require('../../lib/episode.js')
const Song = require('../../lib/song.js')
const Homey = require('homey')
const Utils = require('../../lib/utils.js')

class Player extends EventEmitter {

    constructor(kodiConnection) {
        super()
        this._kodiConnection = kodiConnection

        // Pass events
        let player = this
        this._kodiConnection.notification('Player.OnPause', (result) => { player._onPause(result) })
        this._kodiConnection.notification('Player.OnStop', (result) => { player._onStop(result) })
        this._kodiConnection.notification('Player.OnPlay', (result) => { player._onPlay(result) })
        // New event in JSON RPC v9 > Resume
        if ('OnResume' in this._kodiConnection.Player) {
            this._kodiConnection.notification('Player.OnResume', (result) => { player._onResume(result) })
        }
    }

    _cleanup() {
        this.removeAllListeners();
    }

    // Player functions
    getState() {
        Homey.app.log('getState()')
        if (this._state === 'playing') {
            if (this._currentlyPlaying instanceof Movie) {
                return 'playing_movie'
            } else if (this._currentlyPlaying instanceof Episode) {
                return 'playing_episode'
            } else if (this._currentlyPlaying instanceof Song) {
                return 'playing_music'
            } else {
                return 'playing'
            }
        } else {
            return this._state
        }
    }

    getCurrentlyPlaying() {
        Homey.app.log('getCurrentlyPlaying')
        return this._currentlyPlaying
    }

    // Actions
    playMovie(movie) {
        Homey.app.log('Player.playMovie(', movie, ')')
        return this._kodiConnection.run('Player.Open', movie.getParamId())
    }

    playMusic(songs, shuffle) {
        Homey.app.log('Player.playMusic()')
        // Clear the play list
        return this._kodiConnection.run('Playlist.Clear', { playlistid: 0 })
            .then(() => {
                // Convert songs to list of param
                let songParams = songs.map((song) => {
                    return song.getParamId()
                })

                // Turn on shuffle
                if (shuffle) {
                    songParams = Utils.shuffle(songParams)
                }

                // Add songs to the playlist
                return this._kodiConnection.run('Playlist.Add', { playlistid: 0, item: songParams })
                    .then(() => {
                        // Play the playlist
                        let params = {
                            item: {
                                playlistid: 0
                            },
                            options: {
                                repeat: 'all'
                            }
                        }
                        return this._kodiConnection.run('Player.Open', params)
                    })
            })
    }

    playEpisode(episode) {
        Homey.app.log('Player.playEpisode (', episode, ')')
        return this._kodiConnection.run('Player.Open', episode.getParamId())
    }

    nextOrPrevious(previousOrNext) {
        Homey.app.log('Player.nextOrPreviousTrack(', previousOrNext, ')')
        return this._kodiConnection.run('Player.GetActivePlayers', {})
            .then((result) => {
                // Check whether there is an active player to perform next/previous
                if (result[0]) {
                    let params = {
                        playerid: result[0].playerid,
                        to: previousOrNext
                    }
                    return this._kodiConnection.run('Player.GoTo', params)
                }
            })
    }

    pauseResume() {
        Homey.app.log('Player.pauseResume()')
        return this._kodiConnection.run('Player.GetActivePlayers', {})
            .then((result) => {
                if (result[0]) { // Check whether there is an active player to stop
                    return this._kodiConnection.run('Player.PlayPause', { playerid: result[0].playerid })
                }
            })
    }

    stop() {
        Homey.app.log('Player.stop()')
        return this._kodiConnection.run('Player.GetActivePlayers', {})
            .then((result) => {
                if (result[0]) { // Check whether there is an active player to stop
                    return this._kodiConnection.run('Player.Stop', { playerid: result[0].playerid })
                }
            })
    }

    startAddon(addon) {
        Homey.app.log('Player.startAddon(', addon, ')')
        return this._kodiConnection.run('Addons.ExecuteAddon', addon.getParamId())
    }

    setPartyMode() {
        Homey.app.log('Player.setPartyMode()')
        let params = {
            item: {
                'partymode': 'music'
            }
        }
        return this._kodiConnection.run('Player.Open', params)
    }

    setMute(onOff) {
        Homey.app.log('setMute(', onOff, ')')
        return this._kodiConnection.run('Application.SetMute', onOff)
    }

    setSubtitle(onOff) {
        Homey.app.log('Player.setSubtitle(', onOff, ')')
        let onOffParam = (onOff) ? 'on' : 'off'
        return this._kodiConnection.run('Player.GetActivePlayers', {})
            .then((result) => {
                if (result[0]) { // Check whether there is an active player to set the subtitle
                    // Build request parameters and supply the player
                    let params = {
                        playerid: result[0].playerid,
                        subtitle: onOffParam
                    }
                    return this._kodiConnection.run('Player.SetSubtitle', params)
                }
            })
    }

    setVolume(volume) {
        Homey.app.log('setVolume(', volume, ')')
        return this._kodiConnection.run('Application.SetVolume', { volume: volume })
    }

    async setInitialState() {
        Homey.app.log('Player.setInitialState()')
        let activePlayer = await this._kodiConnection.run('Player.GetActivePlayers', {})
        // Check if something is playing
        if (activePlayer[0]) {
            this._state = 'playing'

            let mediaResult = await this._kodiConnection.run('Player.GetItem', {
                playerid: activePlayer[0].playerid
            })

            // Check whether a movie, an episode or music is playing:
            const mediaType = mediaResult.item.type

            // Movie
            if (mediaType === 'movie' || mediaType === 'movies') {
                this._currentlyPlaying = await this.getMovieDetailsById(mediaResult.item.id, mediaResult.item.title)
            } else if (mediaType === 'episode' || mediaType === 'episodes') {
                this._currentlyPlaying = await this.getEpisodeDetailsById(mediaResult.item.id, mediaResult.item.title)
            } else if (mediaType === 'song' || mediaType === 'songs') {
                this._currentlyPlaying = await this.getSongDetailsById(mediaResult.item.id)
            }

            console.log(mediaResult)
        }
    }

    // Contacts Kodi to build a Movie object
    // Movies started by addons such as Covenant do not exist in the library,
    // but a title is available on the player
    async getMovieDetailsById(movieId, movieTitle = '') {
        Homey.app.log('getMovieDetailsById(', movieId, ',', movieTitle, ')')
        try {
            let movieResult = await this._kodiConnection.run('VideoLibrary.GetMovieDetails', {
                movieid: movieId,
                properties: ['title', 'art']
            })
            let title = (movieResult.moviedetails.label) ? movieResult.moviedetails.label : movieTitle
            let artUrl = (movieResult.moviedetails.art.poster) ? this._parseArtworkUrl(movieResult.moviedetails.art.poster) : ''
            return new Movie(movieId, title, artUrl)
        } catch (e) {
            return new Movie(-1, movieTitle, null)
        }
    }

    // Contact kodi to build an Episode object
    // Episodes started bij addons such as Convenant do not exist
    // in the library but a title is available on the player
    async getEpisodeDetailsById(episodeId, episodeTitle = '') {
        Homey.app.log('getEpisodeDetailsById(', episodeId, ',', episodeTitle, ')')
        try {
            let episodeResult = await this._kodiConnection.run('VideoLibrary.GetEpisodeDetails', {
                episodeid: episodeId,
                properties: ['showtitle', 'season', 'episode', 'title', 'art', 'thumbnail']
            })
            let artWork = await this._kodiConnection.run('Files.PrepareDownload', {
                path: encodeURIComponent(episodeResult.episodedetails.thumbnail)
            })
            console.log('art', artWork)
            let tvshowTitle = (episodeResult.episodedetails.showtitle) ? episodeResult.episodedetails.showtitle : tvshowTitle
            let episodeTitle = (episodeResult.episodedetails.label) ? episodeResult.episodedetails.label : episodeTitle
            let season = (episodeResult.episodedetails.season) ? episodeResult.episodedetails.season : season
            let episode = (episodeResult.episodedetails.episode) ? episodeResult.episodedetails.episode : episode
            let artUrl = (episodeResult.episodedetails.art['season.poster']) ? this._parseArtworkUrl(episodeResult.episodedetails.art['season.poster']) : ''

            return new Episode(episodeId, episodeTitle, tvshowTitle, season, episode, artUrl)
        }
        catch (e) {
            console.log('err', e)
            return new Episode(-1, episodeTitle, '', '', '', '')
        }
    }

    // Get song details by id
    async getSongDetailsById(songId) {
        Homey.app.log('getSongDetailsById(', songId, ')')

        let songResult = await this._kodiConnection.run('AudioLibrary.GetSongDetails', {
            songid: songId,
            properties: ['artist', 'title', 'art']
        })
        let artUrl = (songResult.songdetails.art.thumb) ? this._parseArtworkUrl(songResult.songdetails.art.thumb) : ''
        return new Song(
            songId,
            songResult.songdetails.title,
            songResult.songdetails.artist[0],
            artUrl
        )
    }

    // Events
    async _onPlay(result) {
        Homey.app.log('Player._onPlay')
        this._state = 'playing'
        this.emit('play')

        let playerId = (result.data.player.playerid === -1) ? 1 : result.data.player.playerid // Convert -1 to 1 if player is an Addon (Exodus / Specto)

        // Grab the current playing item from the
        // Check if there's a new song/movie/episode playback or a resume action (player % > 1)
        // Build request parameters and supply the player
        let params = {
            playerid: playerId, // Convert -1 to 1 if player is an Addon (Exodus / Specto)
            properties: ['percentage']
        }

        this._kodiConnection.run('Player.GetProperties', params)
            .then((playerResult) => {
                console.log('respl', playerResult)
                // If the percentage is above 0.1 for eps/movies or above 1  for songs , we have a resume-action
                if (playerResult) {
                    if ((playerResult.percentage >= 0.1 && result.data.item.type !== 'song') || (playerResult.percentage >= 1 && result.data.item.type === 'song')) {
                        this.emit('resume')
                    } else {
                        // Get the current item from the Player to check whether we are dealing with a movie or an episode
                        this._kodiConnection.run('Player.GetItem', { playerid: playerId })
                            .then(async (resultGetItem) => {
                                console.log('res', resultGetItem)
                                // Check if we're dealing with a movie, episode or song
                                if (resultGetItem.item.type === 'movie' || resultGetItem.item.type === 'movies') {
                                    let movieObj = await this.getMovieDetailsById(resultGetItem.item.id, resultGetItem.item.label)
                                    this._currentlyPlaying = movieObj
                                    this.emit('movie_start', movieObj)
                                } else if (resultGetItem.item.type === 'episode' || resultGetItem.item.type === 'episodes') {
                                    // Trigger action kodi_episode_start
                                    let episodeObj = await this.getEpisodeDetailsById(resultGetItem.item.id, result.data.item.showtitle)
                                    this._currentlyPlaying = episodeObj
                                    this.emit('episode_start', episodeObj)
                                } else if (resultGetItem.item.type === 'song' || resultGetItem.item.type === 'songs') {
                                    // Get song details
                                    let songObj = await this.getSongDetailsById(result.data.item.id)
                                    this._currentlyPlaying = songObj
                                    this.emit('song_start', songObj)
                                }
                            })
                    }
                }
            })
    }

    _onPause(result) {
        Homey.app.log('Player._onPause')
        this._state = 'paused'
        this.emit('pause')
    }

    _onResume(result) {
        Homey.app.log('Player._onResume')
        this._state = 'playing'
        this.emit('resume')
    }

    _onStop(result) {
        Homey.app.log('Player._onStop')
        this._state = 'stopped'
        this.emit('stop')
        // Check if the user stopped a movie/episode halfway or whether the episode/movie actually ended
        if (result.data.end === true) {
            if (result.data.item.type === 'episode' || result.data.item.type === 'episodes') {
                // Episode ended
                let episodeId = result.data.item.id || -1
                let showTitle = result.data.item.showtitle || ''
                let episodeTitle = result.data.item.title || ''
                let seasonNo = result.data.item.season || ''
                let episodeNo = result.data.item.episode || ''

                // Get Episode details
                let episodeParams = {
                    episodeid: episodeId,
                    properties: ['showtitle', 'season', 'episode', 'title']
                }

                this._kodiConnection.run('VideoLibrary.GetEpisodeDetails', episodeParams)
                    .then((episodeResult) => {
                        episodeTitle = episodeResult.episodedetails.label
                        showTitle = episodeResult.episodedetails.showtitle
                        seasonNo = episodeResult.episodedetails.season
                        episodeNo = episodeResult.episodedetails.episode
                    })
                    .catch(() => {
                        // Above call will fail when a Covenant episode ends because of an unknown episode id
                        // We still have the details so not an issue
                    })
                    .then(() => {
                        // Trigger action kodi_episode_start
                        Homey.app.log('episode_stop (), tvshow_title: ', showTitle, 'episode_title: ', episodeTitle, 'season: ', seasonNo, 'episode: ', episodeNo)
                        this.emit('episode_stop', new Episode(
                            episodeId,
                            episodeTitle,
                            showTitle,
                            seasonNo,
                            episodeNo
                        )
                        )
                    })
            } else {
                // A movie ended
                let movieTitle = (result.data.item.title) ? result.data.item.title : ''
                let movieId = (result.data.item.id) ? result.data.item.id : -1
                let movieParams = {
                    movieid: movieId,
                    properties: ['title']
                }
                // Else get the title by id
                this._kodiConnection.run('VideoLibrary.GetMovieDetails', movieParams)
                    .then((movieResult) => {
                        movieTitle = movieResult.moviedetails.label
                    })
                    .catch(() => {
                        // Above call will fail when a Covenant movie ends because of an unknown movie id
                        // We still have the title so not an issue
                    })
                    .then(() => {
                        if (movieTitle !== '') {
                            Homey.app.log('movie_stop(), movie_title: ', movieTitle)
                            // Trigger event
                            this.emit('movie_stop', new Movie(movieId, movieTitle))
                        }
                    })
            }
        }
    }

    // Helper functions
    _parseArtworkUrl(url) {
        let artworkUrl = null

        // Handle external urls
        if (url.startsWith('image://http')) {
            artworkUrl = decodeURIComponent(url).replace('image://', '').replace('.jpg/', '.jpg').replace('http://', 'https://')
        }
        // Handle internal SMB urls
        else if (url.startsWith('image://')) {
            //artworkUrl = 'http://' + this.kodiConnection + '/image/' + decodeURIComponent(url)
        }
        return artworkUrl
    }
}




module.exports = Player
