'use strict'

class Episode {

    constructor(id, title, showTitle, seasonNo, episodeNo, artUrl) {
        this.id = id
        this.title = title
        this.showTitle = showTitle
        this.seasonNo = seasonNo
        this.episodeNo = episodeNo
        this.artUrl = artUrl
    }

    getParamId() {
        return {
            item: {
                episodeid: this.id
            }
        }
    }

    getParamFlow() {
        return {
            tvshow_title: this.showTitle,
            episode_title: this.title,
            season: this.seasonNo.toString(),
            episode: this.episodeNo.toString()
        }
    }

    getFullEpisodeName() {
        return 'S' + this.seasonNo
            + 'E' + this.episodeNo
            + ' - ' + this.title
    }

    toString() {
        return this.showTitle
            + ' - '
            + this.getFullEpisodeName()
    }
}
module.exports = Episode