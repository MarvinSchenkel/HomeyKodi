'use strict'

class Song {
    
    constructor (id, title, artist) {
        this.id = id
        this.title = title
        this.artist = artist        
    }

    getParamId () {
        return {
            songid: this.id
        }
    }

    getParamFlow () {
        return {
            artist: this.artist,
            song_title: this.title
        }
    }

    toString () {
        return (this.artist || 'Unknown artist') + ' - ' + (this.title || 'Unknown song')
    }
}
module.exports = Song