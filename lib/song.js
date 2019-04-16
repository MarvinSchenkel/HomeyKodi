'use strict'

class Song {

    constructor(id, title, artist, artUrl) {
        this.id = id
        this.title = title
        this.artist = artist
        this.artUrl = artUrl
    }

    getParamId() {
        return {
            songid: this.id
        }
    }

    getParamFlow() {
        return {
            artist: this.artist,
            song_title: this.title
        }
    }

    toString() {
        return (this.artist || 'Unknown artist') + ' - ' + (this.title || 'Unknown song')
    }

    getArtworkUrl() {
        return (!this.artUrl.startsWith('https') ? null : this.artUrl)
    }

}
module.exports = Song