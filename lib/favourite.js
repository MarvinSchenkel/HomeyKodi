'use strict'

class Favourite {

    constructor(id, title, artUrl) {
        this.id = id
        this.title = title
        this.artUrl = artUrl
    }

    getParamId() {
        return {
            item: {
                file: this.id
            }
        }
    }

    getArtworkUrl() {
        return this.artUrl
    }

    toString() {
        return this.title || 'Unknown favourite'
    }
}
module.exports = Favourite