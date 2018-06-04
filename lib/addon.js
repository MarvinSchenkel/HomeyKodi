'use strict'

class Addon {

    constructor (id, name) {
        this.id = id
        this.name = name
    }

    getParamId () {
        return {
            addonid: this.id
        }
    }
}
module.exports = Addon