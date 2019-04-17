
class OVB {
    calculatePreOVB (ticks) {
        if (ticks && ticks.length > 0) {
            let data = ticks.map(x => ({...x}));
            data.reverse();
            data[0].ovb = 0;

            for(let i = 1; i < data.length; i++) {
                data[i].ovb = this.calculateOVB(data[i - 1], data[i]);
            }

            return data.reverse();
        }

        return [];
    }

    calculateOVB (preTick, currentTick) {
        if (preTick && currentTick) {
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

        return 0;
    }
};

module.exports = new OVB();
