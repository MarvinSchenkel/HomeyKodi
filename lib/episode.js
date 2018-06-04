'use strict'

class Episode {

    constructor (id, title, showTitle, seasonNo, episodeNo) {
        this.id = id
        this.title = title
        this.showTitle = showTitle
        this.seasonNo = seasonNo
        this.episodeNo = episodeNo
    }

    getParamId () {
        return {
            item: {
                episodeid: this.id
            }
        }
    }

    getParamFlow () {
        return {
            tvshow_title: this.showTitle,
            episode_title: this.title,
            season: this.seasonNo.toString(),
            episode: this.episodeNo.toString()
        }
    }

    toString () {
        return this.showTitle 
            + ' - S' + this.seasonNo 
            + 'E' + this.episodeNo 
            + ' - ' + this.title
    }
}
module.exports = Episode