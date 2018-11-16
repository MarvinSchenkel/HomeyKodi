'use strict'

class Movie {

    constructor (id, title, artUrl) {
        this.id = id
        this.title = title
        this.artUrl = artUrl
    }
    
    getParamId () {
        return {
            item: {
                movieid: this.id
            }
        }
    }

    getParamFlow () {
        return {
            movie_title: this.title
        }
    }

    toString () {
        return this.title || 'Unknown movie'
    }
}
module.exports = Movie