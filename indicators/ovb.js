
class OVB {
    calculatePreOVB (ticks) {
        let data = ticks.map(x => ({...x}));
        data.reverse();
        data[0].ovb = 0;

        for(let i = 1; i < data.length; i++) {
            data[i].ovb = this.calculateOVB(data[i - 1], data[i]);
        }

        return data.reverse();
    }

    calculateOVB (preTick, currentTick) {
        let currentPrice = currentTick.price;
        let prePrice = preTick.price;

        if (currentPrice > prePrice) {
            return preTick.ovb + currentTick.volume;
        }

        if (currentPrice < prePrice) {
            return preTick.ovb - currentTick.volume;
        }

        return preTick.ovb;
    }
};

module.exports = new OVB();
