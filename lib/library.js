'use strict'

const EventEmitter = require('events')
const Movie = require('../../lib/movie.js')
const Episode = require('../../lib/episode.js')
const Song = require('../../lib/song.js')
const Addon = require('../../lib/addon.js')
const Favourite = require('../../lib/favourite.js')
const Fuse = require('fuse.js')
const Homey = require('homey')

class Library extends EventEmitter {

    constructor(kodiConnection) {
        super()
        this._kodiConnection = kodiConnection

        // Register eventlisteners
        let library = this
        this._kodiConnection.notification('AudioLibrary.OnScanFinished', () => { library._onAudioScanFinished() })
        this._kodiConnection.notification('VideoLibrary.OnScanFinished', () => { library._onVideoScanFinished() })
    }

    _cleanup() {
        this.removeAllListeners();
    }

    // Actions

    searchMovie(movieTitle) {
        Homey.app.log('Library.searchMovie(', movieTitle, ')')
        return this._kodiConnection.run('VideoLibrary.GetMovies', {})
            .then((result) => {
                if (result.movies) {
                    // Create fuzzy search object
                    let fuseOptions = {
                        caseSensitive: false, // Don't care about case whenever we're searching titles by speech
                        includeScore: false, // Don't need the score, the first item has the highest probability
                        shouldSort: true, // Should be true, since we want result[0] to be the item with the highest probability
                        threshold: 0.4, // 0 = perfect match, 1 = match all..
                        location: 0,
                        distance: 100,
                        maxPatternLength: 64,
                        keys: ['label']
                    }
                    let fuse = new Fuse(result.movies, fuseOptions)
                    let searchResult = fuse.search(movieTitle.trim())

                    if (searchResult.length > 0) {
                        return new Movie(
                            searchResult[0].movieid, // Always use searchResult[0], this is the result with the highest probability (setting shouldSort = true)
                            searchResult[0].label
                        )
                    } else {
                        throw new Error(Homey.__('talkback.movie_not_found'))
                    }
                } else {
                    throw new Error(Homey.__('talkback.no_movies_in_library'))
                }
            })
    }

    searchMusic(searchType, searchQuery) {
        Homey.app.log('Library.searchMusic(', searchType, ',', searchQuery, ')')
        let searchMethod = ''
        let fuzzyLookupKey = ''
        switch (searchType) {
            case 'ARTIST':
                searchMethod = 'AudioLibrary.GetArtists'
                fuzzyLookupKey = 'artist'
                break
            case 'ALBUM':
                searchMethod = 'AudioLibrary.GetAlbums'
                break
        }
        return this._kodiConnection.run(searchMethod, {})
            .then((result) => {
                if (result[fuzzyLookupKey + 's']) { // Check if there is music in the library
                    // Parse the result and look for artist or album
                    // Set option for fuzzy search
                    let options = {
                        caseSensitive: false, // Don't care about case whenever we're searching titles by speech
                        includeScore: false, // Don't need the score, the first item has the highest probability
                        shouldSort: true, // Should be true, since we want result[0] to be the item with the highest probability
                        threshold: 0.4, // 0 = perfect match, 1 = match all..
                        location: 0,
                        distance: 100,
                        maxPatternLength: 64,
                        keys: [fuzzyLookupKey] // Set to either 'artist' or 'album'
                    }

                    // Create the fuzzy search object
                    let fuse = new Fuse(result[fuzzyLookupKey + 's'], options) // + 's' since the root tag is always plural (artistS and albumS)
                    let searchResult = fuse.search(searchQuery.trim())

                    // If there's a result
                    if (searchResult.length > 0) {
                        let artistOrAlbum = searchResult[0] // Always use searchResult[0], this is the result with the highest probability (setting shouldSort = true)

                        // Build parameter filter to obtain filtered songs
                        let params = {
                            filter: {},
                            properties: [
                                'file'
                                , 'track'
                            ]
                        }
                        params.filter[fuzzyLookupKey + 'id'] = artistOrAlbum.artistid

                        // Call Kodi for songs by artist/albums
                        return this._kodiConnection.run('AudioLibrary.GetSongs', params)
                            .then((result) => {
                                console.log(result)
                                // Return the array of songs
                                let songs = result.songs.map((song) => {
                                    return new Song(song.songid, song.label)
                                })
                                return songs
                            })
                    } else {
                        // Artist/Album not found
                        switch (searchType) {
                            case 'ARTIST':
                                throw new Error(Homey.__('talkback.artist_not_found'))
                                break
                            case 'ALBUM':
                                throw new Error(Homey.__('talkback.album_not_found'))
                                break
                        }
                    }
                } else {
                    // No music in library
                    throw new Error(Homey.__('talkback.no_music_in_library'))
                }
            })

    }

    getLatestUnwatchedEpisode(showTitle) {
        Homey.app.log('Library.getLatestUnwatchedEpisode (', showTitle, ' )')
        return this._kodiConnection.run('VideoLibrary.GetTVShows', {})
            .then((result) => {
                if (result.tvshows) { // Check whether there are TV shows in the library
                    // Parse the result and look for movieTitle
                    // Set option for fuzzy search
                    let options = {
                        caseSensitive: false, // Don't care about case whenever we're searching titles by speech
                        includeScore: false, // Don't need the score, the first item has the highest probability
                        shouldSort: true, // Should be true, since we want result[0] to be the item with the highest probability
                        threshold: 0.4, // 0 = perfect match, 1 = match all..
                        location: 0,
                        distance: 100,
                        maxPatternLength: 64,
                        keys: ['label']
                    }

                    // Create the fuzzy search object
                    let fuse = new Fuse(result.tvshows, options)
                    let searchResult = fuse.search(showTitle.trim())

                    // If there's a result
                    if (searchResult.length > 0) {
                        // e.g. { label: 'Narcos', tvshowid: 43 }
                        let seriesResult = searchResult[0] // Always use searchResult[0], this is the result with the highest probability (setting shouldSort = true)

                        // Build filter to search unwatched episodes
                        let param = {
                            tvshowid: seriesResult.tvshowid,
                            properties: ['playcount', 'showtitle', 'season', 'episode'],
                            // Sort the result so we can grab the first unwatched episode
                            sort: {
                                order: 'ascending',
                                method: 'episode',
                                ignorearticle: true
                            }
                        }
                        return this._kodiConnection.run('VideoLibrary.GetEpisodes', param)
                            .then((result) => {
                                // Check if there are episodes for this TV show
                                if (result.episodes) {
                                    // Check whether we have seen this episode already
                                    let firstUnplayedEpisode = result.episodes.filter((item) => {
                                        return item.playcount === 0
                                    })
                                    if (firstUnplayedEpisode.length > 0) {
                                        return new Episode(
                                            firstUnplayedEpisode[0].episodeid,
                                            firstUnplayedEpisode[0].label,
                                            firstUnplayedEpisode[0].season,
                                            firstUnplayedEpisode[0].showtitle,
                                            firstUnplayedEpisode[0].episode
                                        )
                                    } else {
                                        throw new Error(Homey.__('talkback.no_latest_episode_found'))
                                    }
                                } else {
                                    throw new Error(Homey.__('talkback.no_latest_episode_found'))
                                }
                            })
                    } else {
                        throw new Error(Homey.__('talkback.series_not_found'))
                    }
                } else {
                    // No TV Shows in the library
                    throw new Error(Homey.__('talkback.no_tvshows_in_library'))
                }
            })
    }

    searchAddon(addonName) {
        Homey.app.log('Library.searchAddon(', addonName, ')')
        return this._kodiConnection.run('Addons.GetAddons', { properties: ['name'] })
            .then((result) => {
                if (result.addons) { // Check whether there are TV shows in the library
                    // Parse the result and look for movieTitle
                    // Set option for fuzzy search
                    let options = {
                        caseSensitive: false, // Don't care about case whenever we're searching titles by speech
                        includeScore: false, // Don't need the score, the first item has the highest probability
                        shouldSort: true, // Should be true, since we want result[0] to be the item with the highest probability
                        threshold: 0.4, // 0 = perfect match, 1 = match all..
                        location: 0,
                        distance: 100,
                        maxPatternLength: 64,
                        keys: ['name']
                    }

                    // Create the fuzzy search object
                    let fuse = new Fuse(result.addons, options)
                    let addonNameResult = fuse.search(addonName.trim())

                    // If there's a result
                    if (addonNameResult.length > 0) {
                        return new Addon(
                            addonNameResult[0].addonid, // Always use searchResult[0], this is the result with the highest probability (setting shouldSort = true)
                            addonNameResult[0].name
                        )
                    } else {
                        throw new Error(Homey.__('talkback.addon_not_found'))
                    }
                } else {
                    // No TV Shows in the library
                    throw new Error(Homey.__('talkback.no_addons_installed'))
                }
            })
    }

    scanVideoLibrary() {
        Homey.app.log('Library.scanVideoLibrary()')
        return this._kodiConnection.run('VideoLibrary.Scan')
    }

    scanAudioLibrary() {
        Homey.app.log('Library.scanAudioLibrary()')
        return this._kodiConnection.run('AudioLibrary.Scan')
    }

    getFavourites(searchQuery) {
        Homey.app.log('Library.getFavourites()')
        let params = {
            properties: ['window', 'windowparameter', 'thumbnail', 'path']
        }
        return this._kodiConnection.run('Favourites.GetFavourites', params)
            .then((result) => { 
                if (result.favourites) { 
                    let favs = result.favourites.map((item) => { 
                        return {
                            image: item.thumbnail,
                            name: item.title,
                            favourite: new Favourite(
                                item.path || item.windowparameter,
                                item.title,
                                item.thumbnail
                            )
                        }                                     
                    })
                    // Filter results based on user query
                    return Promise.resolve(favs.filter(favourite => (!searchQuery || favourite.name.toLowerCase().includes(searchQuery.toLowerCase()))))
                }
            })
    
    }



    // Events
    _onAudioScanFinished() {
        Homey.app.log('Library._onAudioScanFinished()')
        this.emit('audio_scan_finished')
    }

    _onVideoScanFinished() {
        Homey.app.log('Library._onVideoScanFinished()')
        this.emit('video_scan_finished')
    }
}
module.exports = Library
